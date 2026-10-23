"""
AquaSentinel: real-data aquaculture water-quality service
========================================================

Real data source:
Fish Welfare Initiative, "FWI Farm Data - India", CC BY 4.0
https://github.com/fish-welfare-initiative/fwi-farm-data-india
Raw CSV:
https://raw.githubusercontent.com/fish-welfare-initiative/fwi-farm-data-india/main/data/water_quality.csv

IMPORTANT DATA LIMITATIONS:
- This real pond dataset measures DO, pH, temperature and ammonia, but its
  "Turbidity (in cm)" field is a transparency/depth-style measure, NOT NTU.
  This script preserves it as source_turbidity_cm and does not pretend it is NTU.
- The dataset does not contain salinity. Salinity is therefore None for replayed
  historical rows. The live predict_water() function accepts salinity when a
  sensor actually supplies it, but does not invent historical salinity values.
- The public field data mainly represents Indian freshwater carp ponds. The
  species threshold profiles for shrimp and tilapia are configurable starting
  points, not validated by this dataset.
- Labels are generated from transparent thresholds, not supplied expert labels.
  Model accuracy is therefore only agreement with those rules, not proof of
  real-world predictive accuracy. Validate thresholds with an aquaculture expert.

Install:
    pip install pandas numpy scikit-learn joblib

Run:
    python pollution_module.py --train
    python pollution_module.py --replay --interval 1
    python pollution_module.py --predict-demo
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional
from urllib.request import urlopen

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "real_aquaculture_water_quality.csv"
MODEL_PATH = BASE_DIR / "water_quality_rf.joblib"

DATA_URL = (
    "https://raw.githubusercontent.com/"
    "fish-welfare-initiative/fwi-farm-data-india/main/data/water_quality.csv"
)

# The model uses only measurements that can be meaningfully mapped from the
# real source dataset. Salinity and NTU turbidity are not present in that source.
MODEL_FEATURES = ["ph", "do", "temp", "ammonia"]
SPECIES_CODES = {"carp": 0, "shrimp": 1, "tilapia": 2}
RISK_RANK = {"safe": 0, "watch": 1, "critical": 2}

# Operational starting points, not universal regulatory limits.
# pH, DO mg/L, temperature °C, ammonia mg/L.
SPECIES_THRESHOLDS = {
    "carp": {
        "ph": (6.5, 8.5), "do_min": 5.0, "temp": (20.0, 30.0),
        "ammonia_max": 0.05, "turbidity_ntu_max": 50.0, "salinity_max": 5.0,
    },
    "shrimp": {
        "ph": (7.5, 8.5), "do_min": 5.0, "temp": (26.0, 32.0),
        "ammonia_max": 0.05, "turbidity_ntu_max": 40.0, "salinity_range": (5.0, 35.0),
    },
    "tilapia": {
        "ph": (6.5, 9.0), "do_min": 4.0, "temp": (25.0, 32.0),
        "ammonia_max": 0.05, "turbidity_ntu_max": 50.0, "salinity_max": 10.0,
    },
}


def download_real_dataset(force: bool = False) -> Path:
    """Download the public real pond dataset from its published GitHub source."""
    if DATASET_PATH.exists() and not force:
        return DATASET_PATH

    print("Downloading real pond water-quality dataset...")
    try:
        with urlopen(DATA_URL, timeout=45) as response:
            content = response.read()
    except Exception as exc:
        raise RuntimeError(
            "Could not download the real dataset. Check your internet connection "
            "or download water_quality.csv from the source URL and save it as "
            f"{DATASET_PATH.name} beside this script. Details: {exc}"
        ) from exc

    if not content.startswith(b"pond_id,"):
        raise RuntimeError("Downloaded file did not look like the expected CSV.")
    DATASET_PATH.write_bytes(content)
    print(f"Saved dataset to: {DATASET_PATH}")
    return DATASET_PATH


def _combine_date_time(df: pd.DataFrame) -> pd.Series:
    date_col = df.get("Date of data collection")
    time_col = df.get("Time of data collection")
    if date_col is None:
        return pd.Series(pd.NaT, index=df.index)
    combined = date_col.astype(str)
    if time_col is not None:
        combined = combined + " " + time_col.fillna("00:00").astype(str)
    # Source dates are written as MM/DD/YYYY.
    return pd.to_datetime(combined, errors="coerce", dayfirst=False, utc=True)


def clean_dataset(path: Optional[str | Path] = None) -> pd.DataFrame:
    """
    Clean the real source CSV and map its columns to canonical service fields.

    Output columns include:
      timestamp, farm_id, species, ph, do, temp, ammonia,
      source_turbidity_cm, salinity
    `salinity` is intentionally missing because the source does not measure it.
    """
    path = Path(path) if path else download_real_dataset()
    df = pd.read_csv(path, low_memory=False)
    required = ["DO (mg/L)", "pH", "Temp (in °C)"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Real dataset is missing expected columns: {missing}")

    out = pd.DataFrame(index=df.index)
    out["timestamp"] = _combine_date_time(df)
    out["farm_id"] = df.get("pond_id", pd.Series("UNKNOWN-POND", index=df.index)).astype(str)

    # Map the known source measurements.
    out["do"] = pd.to_numeric(df["DO (mg/L)"], errors="coerce")
    out["ph"] = pd.to_numeric(df["pH"], errors="coerce")
    out["temp"] = pd.to_numeric(df["Temp (in °C)"], errors="coerce")

    # Prefer the measured NH3-N concentration; fall back to NH3 if that is
    # the only recorded ammonia column. These are chemically different forms,
    # so the selected column is also documented in the output.
    ammonia_n = "Ammonia—TAN (NH3-N) (mg/L)"
    ammonia_nh3 = "Ammonia—NH3 (mg/L)"
    if ammonia_n in df.columns:
        ammonia = pd.to_numeric(df[ammonia_n], errors="coerce")
        ammonia_source = pd.Series(ammonia_n, index=df.index)
        if ammonia_nh3 in df.columns:
            fallback = pd.to_numeric(df[ammonia_nh3], errors="coerce")
            use_fallback = ammonia.isna()
            ammonia.loc[use_fallback] = fallback.loc[use_fallback]
            ammonia_source.loc[use_fallback & fallback.notna()] = ammonia_nh3
    elif ammonia_nh3 in df.columns:
        ammonia = pd.to_numeric(df[ammonia_nh3], errors="coerce")
        ammonia_source = pd.Series(ammonia_nh3, index=df.index)
    else:
        ammonia = pd.Series(np.nan, index=df.index)
        ammonia_source = pd.Series("unavailable", index=df.index)

    out["ammonia"] = ammonia
    out["ammonia_source_column"] = ammonia_source

    # Source calls this measurement "Turbidity (in cm)". Centimetres are not
    # NTU, so keep its actual source name/unit instead of silently converting.
    if "Turbidity (in cm)" in df.columns:
        out["source_turbidity_cm"] = pd.to_numeric(
            df["Turbidity (in cm)"], errors="coerce"
        )
    else:
        out["source_turbidity_cm"] = np.nan

    # No salinity column exists in this real dataset.
    out["salinity"] = np.nan
    out["species_source"] = df.get("Species", pd.Series("", index=df.index)).fillna("").astype(str)

    def map_species(value: str) -> str:
        text = str(value).lower()
        if any(word in text for word in ("shrimp", "prawn")):
            return "shrimp"
        if "tilapia" in text:
            return "tilapia"
        # This field dataset primarily contains Indian major carp.
        return "carp"

    out["species"] = out["species_source"].map(map_species)

    out = out.replace([np.inf, -np.inf], np.nan)
    out = out.dropna(subset=["timestamp", "ph", "do", "temp"]).copy()
    out = out[
        out["ph"].between(0, 14)
        & out["do"].between(0, 30)
        & out["temp"].between(-2, 60)
    ]
    # Do not delete rows just because ammonia was not measured: they can still
    # be replayed, but the classifier is trained only on rows with ammonia.
    out = out.sort_values("timestamp").reset_index(drop=True)
    return out


def threshold_risk(readings: dict, species: str = "carp") -> tuple[str, list[str]]:
    """Calculate water-quality risk; missing optional sensors are informational only."""
    species = str(species).lower()
    if species not in SPECIES_THRESHOLDS:
        raise ValueError("species must be carp, shrimp, or tilapia")

    t = SPECIES_THRESHOLDS[species]
    critical: list[str] = []
    watch: list[str] = []
    info: list[str] = []

    # pH
    ph = float(readings["ph"])
    ph_lo, ph_hi = t["ph"]
    if ph < ph_lo - 0.5 or ph > ph_hi + 0.5:
        critical.append(
            f"pH critically outside operating band ({ph_lo - 0.5:g}–{ph_hi + 0.5:g})"
        )
    elif ph < ph_lo or ph > ph_hi:
        watch.append(f"pH outside preferred range ({ph_lo:g}–{ph_hi:g})")

    # Temperature
    temp = float(readings["temp"])
    temp_lo, temp_hi = t["temp"]
    if temp < temp_lo - 2 or temp > temp_hi + 2:
        critical.append("Temperature critically outside operating band")
    elif temp < temp_lo or temp > temp_hi:
        watch.append("Temperature outside preferred range")

    # Dissolved oxygen
    do = float(readings["do"])
    if do < t["do_min"] * 0.6:
        critical.append(f"Dissolved oxygen critically low (<{t['do_min'] * 0.6:g} mg/L)")
    elif do < t["do_min"]:
        watch.append(f"Dissolved oxygen below target ({t['do_min']:g} mg/L)")

    # Ammonia
    ammonia = readings.get("ammonia")
    if ammonia is not None and np.isfinite(float(ammonia)):
        ammonia = float(ammonia)
        if ammonia > t["ammonia_max"] * 2:
            critical.append(f"Ammonia critically high (>{t['ammonia_max'] * 2:g} mg/L)")
        elif ammonia > t["ammonia_max"]:
            watch.append(f"Ammonia above target ({t['ammonia_max']:g} mg/L)")
    else:
        info.append("Ammonia measurement unavailable; collect a reading")

    # Turbidity: only compare a supplied NTU value, never source transparency in cm.
    turbidity = readings.get("turbidity")
    if turbidity is not None and np.isfinite(float(turbidity)):
        turbidity = float(turbidity)
        if turbidity > t["turbidity_ntu_max"] * 1.5:
            critical.append("Turbidity critically high")
        elif turbidity > t["turbidity_ntu_max"]:
            watch.append("Turbidity above target")
    else:
        info.append(
            "Turbidity in NTU unavailable; source transparency in cm is not equivalent"
        )

    # Salinity
    salinity = readings.get("salinity")
    if salinity is not None and np.isfinite(float(salinity)):
        salinity = float(salinity)
        if species == "shrimp":
            lo, hi = t["salinity_range"]
            if salinity < lo - 2 or salinity > hi + 2:
                critical.append(
                    f"Salinity critically outside shrimp range ({lo:g}–{hi:g} ppt)"
                )
            elif not lo <= salinity <= hi:
                watch.append(
                    f"Salinity outside shrimp target range ({lo:g}–{hi:g} ppt)"
                )
        else:
            limit = t["salinity_max"]
            if salinity > limit * 1.5:
                critical.append(f"Salinity critically high (>{limit * 1.5:g} ppt)")
            elif salinity > limit:
                watch.append("Salinity above target")
    else:
        info.append("Salinity unavailable; no salinity sensor value was supplied")

    # Missing optional sensor data is reported but does not by itself increase risk.
    if critical:
        return "critical", critical + watch + info
    if watch:
        return "watch", watch + info
    if info:
        return "safe", info
    return "safe", ["All supplied readings are within configured species thresholds"]


def _training_label(row: pd.Series) -> str:
    """Create model labels from the four available measured features only."""
    t = SPECIES_THRESHOLDS[str(row["species"]).lower()]
    risk = "safe"
    ph = float(row["ph"])
    ph_lo, ph_hi = t["ph"]
    temp = float(row["temp"])
    temp_lo, temp_hi = t["temp"]
    do = float(row["do"])
    ammonia = float(row["ammonia"])

    critical = (
        ph < ph_lo - 0.5 or ph > ph_hi + 0.5
        or temp < temp_lo - 2 or temp > temp_hi + 2
        or do < t["do_min"] * 0.6
        or ammonia > t["ammonia_max"] * 2
    )
    watch = (
        ph < ph_lo or ph > ph_hi
        or temp < temp_lo or temp > temp_hi
        or do < t["do_min"]
        or ammonia > t["ammonia_max"]
    )
    if critical:
        risk = "critical"
    elif watch:
        risk = "watch"
    return risk


def train_classifier(
    dataset_path: Optional[str | Path] = None,
    model_path: Optional[str | Path] = None,
) -> dict:
    """Train Random Forest from the prepared SAFE/UNSAFE AquaSense dataset."""
    source_path = (
        Path(dataset_path)
        if dataset_path
        else BASE_DIR / "water_quality_training.csv"
    )

    if not source_path.exists():
        raise FileNotFoundError(
            f"Training dataset not found: {source_path}. "
            "Create water_quality_training.csv first."
        )

    df = pd.read_csv(source_path)
    required = MODEL_FEATURES + ["label"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(
            f"Training dataset is missing columns: {missing}"
        )

    train_df = df[required].copy()
    for feature in MODEL_FEATURES:
        train_df[feature] = pd.to_numeric(
            train_df[feature], errors="coerce"
        )

    train_df["label"] = train_df["label"].astype(str).str.strip().str.upper()
    train_df = train_df.dropna(subset=required)
    train_df = train_df[
        train_df["label"].isin(["SAFE", "UNSAFE"])
    ].copy()

    class_counts = train_df["label"].value_counts()
    if len(class_counts) != 2 or class_counts.min() < 2:
        raise ValueError(
            "Training data must contain at least two SAFE and two UNSAFE rows. "
            f"Found: {class_counts.to_dict()}"
        )

    X = train_df[MODEL_FEATURES]
    y = train_df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=250,
        random_state=42,
        class_weight="balanced",
        min_samples_leaf=2,
    )
    model.fit(X_train, y_train)

    accuracy = float(accuracy_score(y_test, model.predict(X_test)))
    destination = Path(model_path) if model_path else MODEL_PATH
    joblib.dump(
        {
            "model": model,
            "features": MODEL_FEATURES,
            "source": str(source_path),
            "note": (
                "Trained on the dataset's SAFE/UNSAFE labels. "
                "Performance is not proof of real-world safety."
            ),
        },
        destination,
    )

    return {
        "model_path": str(destination),
        "source_dataset": str(source_path),
        "complete_rows_used": int(len(train_df)),
        "class_counts": {
            str(label): int(count)
            for label, count in class_counts.items()
        },
        "holdout_accuracy": round(accuracy, 4),
        "label_source": "label column in water_quality_training.csv",
        "features_used": MODEL_FEATURES,
    }


def _load_model(model_path: Optional[str | Path] = None):
    destination = Path(model_path) if model_path else MODEL_PATH
    if not destination.exists():
        train_classifier(model_path=destination)
    return joblib.load(destination)



def predict_water(readings: dict, model_path: Optional[str | Path] = None) -> dict:
    """
    Predict water-quality risk using the Random Forest model
    and species-specific threshold rules.
    """

    missing = [key for key in ("ph", "do", "temp") if key not in readings]
    if missing:
        raise ValueError(f"Missing required reading fields: {missing}")

    species = str(readings.get("species", "carp")).lower()
    if species not in SPECIES_THRESHOLDS:
        raise ValueError("species must be one of: carp, shrimp, tilapia")

    values = {}
    for key in ("ph", "do", "temp", "ammonia", "turbidity", "salinity"):
        raw = readings.get(key)

        if raw is None:
            values[key] = None
        else:
            number = float(raw)
            values[key] = number if np.isfinite(number) else None

    rule_readings = {
        "ph": values["ph"],
        "do": values["do"],
        "temp": values["temp"],
        "ammonia": values["ammonia"],
        "turbidity": values["turbidity"],
        "salinity": values["salinity"],
    }

    rule_risk, reasons = threshold_risk(rule_readings, species)

    # Get the Random Forest prediction and its UNSAFE probability.
    ml_risk = None
    ml_unsafe_probability = None

    if all(values[key] is not None for key in MODEL_FEATURES):
        bundle = _load_model(model_path)
        model = bundle["model"]

        x = pd.DataFrame(
            [[values[key] for key in MODEL_FEATURES]],
            columns=MODEL_FEATURES,
        )

        ml_label = str(model.predict(x)[0]).upper()
        ml_risk = "critical" if ml_label == "UNSAFE" else "safe"

        probabilities = model.predict_proba(x)[0]
        classes = [str(label).upper() for label in model.classes_]

        if "UNSAFE" in classes:
            unsafe_index = classes.index("UNSAFE")
            ml_unsafe_probability = float(probabilities[unsafe_index])

    # Keep whichever assessment indicates greater risk.
    risk = rule_risk

    if ml_risk is not None and RISK_RANK[ml_risk] > RISK_RANK[risk]:
        risk = ml_risk
        reasons.append(f"Random Forest escalated risk to {ml_risk}")

    timestamp = readings.get("timestamp") or datetime.now(timezone.utc).isoformat()

    return {
        "timestamp": str(timestamp),
        "module": "water_quality",
        "farm_id": str(readings.get("farm_id", "UNKNOWN-POND")),
        "readings": {**values, "species": species},
        "risk": risk,
        "risk_score": ml_unsafe_probability,
        "reason": reasons,
        "alert": risk in ("watch", "critical"),
    }




def replay_day(
    dataset_path: Optional[str | Path] = None,
    day: Optional[str] = None,
    interval_seconds: float = 1.0,
    loop: bool = False,
) -> Iterator[dict]:
    """
    Yield real source readings one by one for one UTC date.
    The default day is the first date available in the cleaned dataset.
    """
    if interval_seconds < 0:
        raise ValueError("interval_seconds cannot be negative")
    df = clean_dataset(dataset_path)
    if df.empty:
        raise ValueError("No usable rows found in the real dataset")
    selected_day = day or df["timestamp"].dt.strftime("%Y-%m-%d").iloc[0]
    day_df = df[df["timestamp"].dt.strftime("%Y-%m-%d") == selected_day]
    if day_df.empty:
        raise ValueError(f"No dataset rows found for UTC day {selected_day}")

    while True:
        for _, row in day_df.iterrows():
            payload = {
                "timestamp": row["timestamp"].isoformat(),
                "farm_id": row["farm_id"],
                "species": row["species"],
                "ph": float(row["ph"]),
                "do": float(row["do"]),
                "temp": float(row["temp"]),
                "ammonia": (
                    float(row["ammonia"]) if pd.notna(row["ammonia"]) else None
                ),
                "turbidity": None,  # no NTU value in this source
                "salinity": None,   # not measured in this source
            }
            event = predict_water(payload)
            event["source_turbidity_cm"] = (
                float(row["source_turbidity_cm"])
                if pd.notna(row["source_turbidity_cm"]) else None
            )
            event["data_source"] = "Fish Welfare Initiative field measurements"
            yield event
            if interval_seconds:
                time.sleep(interval_seconds)
        if not loop:
            break


def main():
    parser = argparse.ArgumentParser(description="Real-data aquaculture water-quality service")
    parser.add_argument("--download", action="store_true", help="download/refresh the real dataset")
    parser.add_argument("--train", action="store_true", help="train and save the Random Forest")
    parser.add_argument("--replay", action="store_true", help="stream one day of real readings")
    parser.add_argument("--day", help="UTC date YYYY-MM-DD for replay")
    parser.add_argument("--interval", type=float, default=1.0, help="seconds between replay rows")
    parser.add_argument("--predict-demo", action="store_true", help="run one example live-sensor prediction")
    args = parser.parse_args()

    if args.download:
        download_real_dataset(force=True)
    if args.train or not MODEL_PATH.exists():
        print(json.dumps(train_classifier(), indent=2))
    if args.predict_demo:
        example = {
            "farm_id": "DEMO-POND-01",
            "species": "carp",
            "ph": 7.6,
            "do": 6.2,
            "temp": 27.0,
            "ammonia": 0.02,
            "turbidity": None,
            "salinity": None,
        }
        print(json.dumps(predict_water(example), indent=2))
    if args.replay:
        try:
            for event in replay_day(day=args.day, interval_seconds=args.interval):
                print(json.dumps(event, indent=2))
                print("-" * 60)
        except KeyboardInterrupt:
            print("\nReplay stopped.")


if __name__ == "__main__":
    main()

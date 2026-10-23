"""Two-step inference for the disease service. The farmer just takes a photo.

Step 1 decides which animal is in the photo (finfish, shrimp, seaweed, bivalve).
By default this uses CLIP zero-shot (a general image-text model, needs
`pip install transformers torch`), which works on real-world photos. Set the
environment variable ANIMAL_DETECTOR=tier1 to use the small model trained on the
datasets instead (it was unreliable on real photos).
Step 2 runs the Stage-2 model for that animal, which gives the health or disease
label, mapped to a risk level.

Expected layout next to this file (names = the NAME values used in prepare_data.py):

    model/finfish/fish_model.keras + class_names.json
    model/shrimp/...   model/seaweed/...   (one folder per trained category)
    model/tier1/...                        (only needed when ANIMAL_DETECTOR=tier1)

Contract (shared with the water and core services):

    predict_disease(image_bytes, farm_id="farm_01", category=None) -> {
        # category: leave None (the farmer does nothing); an app may pass it to override
        "timestamp": ISO string,
        "module": "disease",
        "farm_id": str,
        "category": str,              # finfish / shrimp / ... or "unknown"
        "label": str,                 # disease or health label, "uncertain", "no_health_model"
        "confidence": float,          # confidence of the label (Stage 2)
        "category_confidence": float, # confidence of the animal detection (1.0 if overridden)
        "category_source": "farmer" | "auto",   # "auto" = detected from the photo
        "risk": "low" | "medium" | "high" | "unknown",
        "alert": bool,
    }

"unknown" risk only appears when a category has no health check (e.g. oysters when
CLIP is not installed); the dashboard should show it as grey / "no health check available".
Oysters are checked with an open/closed shell rule: "Closed shell" = low risk,
"Open shell (gaping)" = high risk.
"""
import io
import json
import math
import os
import re
from datetime import datetime

import numpy as np
from PIL import Image

MODEL_ROOT = os.environ.get(
    "DISEASE_MODEL_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")
)
IMG_SIZE = (224, 224)
DETECTOR = os.environ.get("ANIMAL_DETECTOR", "clip")  # "clip" (recommended) or "tier1"
CLIP_NAME = "openai/clip-vit-base-patch32"
CLIP_MIN = 0.6    # below this we cannot tell what animal it is
# Prompts per category; the model scores the photo against each and we average per category.
# "other" catches photos of people, scenery, objects, so those are rejected, not misrouted.
CATEGORY_PROMPTS = {
    "finfish": ["a photo of a fish", "a close-up photo of a freshwater carp",
                "a photo of a sick fish with red sores or ulcers",
                "a photo of a fish from an aquaculture pond"],
    "shrimp": ["a photo of a shrimp", "a photo of prawns",
               "a close-up photo of a shrimp with white spots",
               "a photo of farmed shrimp from a pond"],
    "seaweed": ["a photo of seaweed", "a photo of farmed seaweed on ropes in the sea",
                "a close-up photo of red algae seaweed branches", "a photo of kelp"],
    "bivalve": ["a photo of an oyster", "a photo of oysters on a shell farm",
                "a photo of an open oyster shell", "a photo of a clam or mussel"],
}
OTHER_PROMPTS = ["a photo of a person", "a photo of a landscape or building",
                 "a photo of an everyday object", "a screenshot or a document"]
# Bivalves (oysters) have no trained health model: the dataset has no open/closed labels.
# Rule instead: closed shell = healthy, open / half-open (gaping) = unhealthy, using CLIP.
# Shell gaping is a recognised stress / mortality sign for oysters photographed out of water.
SHELL_PROMPTS = {
    "Closed shell": ["a photo of a closed oyster", "an oyster with its shell tightly shut",
                     "a photo of several closed oysters"],
    "Open shell (gaping)": ["a photo of an open oyster", "an oyster with its shell gaping open",
                            "a half-open oyster shell", "a dead oyster with an open shell"],
    # Shucked / half-shell oysters with the meat visible (e.g. served on ice). They are open
    # on purpose, so they are neither "closed" nor "gaping"; the shell rule cannot judge them.
    "Shucked (meat visible)": ["a photo of shucked oysters on ice",
                               "an oyster on the half shell with the meat visible",
                               "an opened oyster served on crushed ice"],
}
TIER1_MIN = 0.6   # (tier1 detector) below this we cannot tell what animal it is
STAGE2_MIN = 0.5  # below this we ask for a clearer photo
# A "healthy" verdict needs at least this much confidence, otherwise it is reported as
# medium risk ("not sure it is healthy, please check") instead of reassuring the farmer.
# Missing a disease costs more than a false alarm. Pick the value with evaluate.py.
HEALTHY_MIN = 0.75
# Friendly names the app may send for the category.
CATEGORY_ALIASES = {"fish": "finfish", "prawn": "shrimp", "oyster": "bivalve",
                    "oysters": "bivalve", "bivalves": "bivalve"}

# Keyword rules, matched on the lowercase label. Edit to match your datasets' labels.
HEALTHY_RE = re.compile(r"\b(healthy|normal|good|clean)\b")  # \b so "unhealthy" is NOT healthy
HIGH_WORDS = (
    "disease", "eus", "ulcer", "columnaris", "aeromonas", "bacterial", "white spot", "wssv",
    "white tail", "black gill", "vibrio", "necrosis", "ice ice", "severe", "heavy",
)
# Exact label (lowercase, underscores as spaces) -> risk. Wins over the keyword rules.
# "bg" is the shrimp dataset's gill-disease class; check its README for the full name.
# Seaweed classes: Ice-Ice Disease is caught by HIGH_WORDS; Endophytes and Epiphytic
# filamentous algae fall through to "medium" on purpose.
RISK_OVERRIDES = {"bg": "high", "bacteria": "high"}

_cache = {}


def _get(name):
    """Load (model, class_names) for 'tier1' or a category. None if not trained."""
    if name in _cache:
        return _cache[name]
    folder = os.path.join(MODEL_ROOT, name)
    path = os.path.join(folder, "fish_model.keras")
    if not os.path.isfile(path):
        _cache[name] = None
        return None
    import tensorflow as tf  # imported lazily so the API starts fast

    model = tf.keras.models.load_model(path)
    with open(os.path.join(folder, "class_names.json")) as f:
        class_names = json.load(f)
    _cache[name] = (model, class_names)
    return _cache[name]


def clean_label(label):
    """'2. BG' -> 'BG' (some datasets number their class folders)."""
    return re.sub(r"^\s*\d+\s*[.)_-]?\s*", "", label).strip() or label


def risk_for_label(label):
    key = clean_label(label).lower().replace("_", " ").replace("-", " ")
    if key in RISK_OVERRIDES:
        return RISK_OVERRIDES[key]
    if HEALTHY_RE.search(key):
        return "low"
    if any(w in key for w in HIGH_WORDS):
        return "high"
    return "medium"


def _top(model, class_names, batch):
    probs = model.predict(batch, verbose=0)[0]
    idx = int(np.argmax(probs))
    return class_names[idx], float(probs[idx])


def _result(farm_id, category, label, conf, cat_conf, risk):
    return {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "module": "disease",
        "farm_id": farm_id,
        "category": category,
        "label": label,
        "confidence": round(conf, 3),
        "category_confidence": round(cat_conf, 3),
        "risk": risk,
        # Only confirmed high-risk results page the farmer.
        "alert": risk == "high",
    }


_clip_state = None


def _clip():
    global _clip_state
    if _clip_state is None:
        import torch  # imported lazily so the API starts fast
        from transformers import CLIPModel, CLIPProcessor

        _clip_state = (torch, CLIPModel.from_pretrained(CLIP_NAME).eval(),
                       CLIPProcessor.from_pretrained(CLIP_NAME))
    return _clip_state


def _clip_probs(img, groups=None):
    """Probability that the photo matches each group of prompts (default: which animal)."""
    groups = groups or {**CATEGORY_PROMPTS, "other": OTHER_PROMPTS}
    prompts = [p for ps in groups.values() for p in ps]
    owners = [g for g, ps in groups.items() for _ in ps]
    torch, model, proc = _clip()
    inputs = proc(text=prompts, images=img, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(**inputs).logits_per_image[0].tolist()  # one score per prompt
    by_cat = {}
    for owner, lg in zip(owners, logits):
        by_cat.setdefault(owner, []).append(lg)
    means = {k: sum(v) / len(v) for k, v in by_cat.items()}
    top = max(means.values())
    exps = {k: math.exp(v - top) for k, v in means.items()}
    total = sum(exps.values())
    return {k: v / total for k, v in exps.items()}


def _detect(orig, batch):
    """Which animal is in the photo? Returns (category or None, confidence)."""
    if DETECTOR == "clip":
        try:
            probs = _clip_probs(orig)
        except ImportError:
            print("transformers/torch not installed, falling back to the Tier-1 model")
        else:
            cat = max(probs, key=probs.get)
            if cat == "other" or probs[cat] < CLIP_MIN:
                return None, probs[cat]
            return cat, probs[cat]
    tier1 = _get("tier1")
    if tier1 is None:
        raise FileNotFoundError(f"No Tier-1 model in {MODEL_ROOT}/tier1")
    cat, conf = _top(*tier1, batch)
    return (cat, conf) if conf >= TIER1_MIN else (None, conf)


def _bivalve(orig, farm_id, cat_conf):
    """Shell check for oysters: closed = healthy, open or half-open = unhealthy."""
    if DETECTOR != "clip":
        return _result(farm_id, "bivalve", "no_health_model", 0.0, cat_conf, "unknown")
    try:
        probs = _clip_probs(orig, SHELL_PROMPTS)
    except ImportError:
        return _result(farm_id, "bivalve", "no_health_model", 0.0, cat_conf, "unknown")
    closed, opened = probs["Closed shell"], probs["Open shell (gaping)"]
    shucked = probs["Shucked (meat visible)"]
    if shucked >= max(closed, opened):  # open on purpose, cannot be judged from the shell
        return _result(farm_id, "bivalve", "uncertain", shucked, cat_conf, "medium")
    if closed >= HEALTHY_MIN:
        return _result(farm_id, "bivalve", "Closed shell", closed, cat_conf, "low")
    if opened >= 0.5:
        return _result(farm_id, "bivalve", "Open shell (gaping)", opened, cat_conf, "high")
    return _result(farm_id, "bivalve", "uncertain", max(closed, opened), cat_conf, "medium")


def _predict(image_bytes, farm_id, category):
    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = orig.resize(IMG_SIZE)
    # MobileNetV2 scaling is inside the saved models, so pass raw 0-255 pixels.
    batch = np.expand_dims(np.asarray(img, dtype="float32"), axis=0)

    if category:  # an app may pass this to override the automatic detection
        category = category.strip().lower()
        category = CATEGORY_ALIASES.get(category, category)
        cat_conf = 1.0
    else:
        category, cat_conf = _detect(orig, batch)
        if category is None:
            return _result(farm_id, "unknown", "uncertain", cat_conf, cat_conf, "medium")

    stage2 = _get(category)
    if stage2 is None:
        if category == "bivalve":  # no trained model: use the open/closed shell rule
            return _bivalve(orig, farm_id, cat_conf)
        return _result(farm_id, category, "no_health_model", 0.0, cat_conf, "unknown")

    label, conf = _top(*stage2, batch)
    label = clean_label(label)
    if conf < STAGE2_MIN:
        return _result(farm_id, category, "uncertain", conf, cat_conf, "medium")
    risk = risk_for_label(label)
    if risk == "low" and conf < HEALTHY_MIN:
        risk = "medium"
    return _result(farm_id, category, label, conf, cat_conf, risk)


def predict_disease(image_bytes, farm_id="farm_01", category=None):
    """Normal use: predict_disease(photo_bytes, farm_id). The animal is detected from
    the photo. Pass category (finfish / shrimp / seaweed / bivalve) only to override."""
    result = _predict(image_bytes, farm_id, category)
    result["category_source"] = "farmer" if category else "auto"
    return result


if __name__ == "__main__":
    import sys

    # python predict.py photo.jpg [category]
    with open(sys.argv[1], "rb") as f:
        category = sys.argv[2] if len(sys.argv) > 2 else None
        print(json.dumps(predict_disease(f.read(), category=category), indent=2))

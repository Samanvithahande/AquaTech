from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4
import os

from fastapi import FastAPI, Query, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# Database persistence layer (zero-dependency SQLite)
try:
    from .database import (
        init_db, save_alert, fetch_alerts, save_reading, fetch_readings, save_assessment, fetch_assessments
    )
except (ImportError, ValueError):
    from database import (
        init_db, save_alert, fetch_alerts, save_reading, fetch_readings, save_assessment, fetch_assessments
    )

# Support both package and direct directory execution
try:
    from .predict import predict_disease as run_disease_model
except (ImportError, ValueError):
    from predict import predict_disease as run_disease_model

# Prefer the model module beside this file because its trained joblib bundle is
# packaged at backend/water_quality_rf.joblib. The core/ copy is a fallback only.
try:
    from water_model import predict_water as run_water_model
except ImportError:
    from core.water_model import predict_water as run_water_model


app = FastAPI(
    title="Aquaculture Risk and Alert API",
    version="2.0.0",
    description=(
        "Water-quality and fish-disease risk predictions "
        "with multilingual alerts (English, Kannada, Hindi)."
    ),
)

# Initialize SQLite database schema
init_db()

@app.on_event("startup")
def startup_event():
    init_db()

# Allow frontend connections during development & production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request models ----------

class WaterRequest(BaseModel):
    farm_id: str = "farm_001"
    ph: float = 7.5
    temperature: float = 28.0
    dissolved_oxygen: float = 6.0
    ammonia: float = 0.02
    species: Literal["carp", "shrimp", "tilapia"] = "carp"

class ReplayRequest(BaseModel):
    farm_id: str = "farm_001"
    language: Literal["kn", "hi"] = "kn"


# ---------- Water-quality prediction ----------

def predict_water(data: WaterRequest) -> dict:
    result = run_water_model({
        "ph": data.ph,
        "do": data.dissolved_oxygen,
        "temp": data.temperature,
        "ammonia": data.ammonia,
        "species": data.species,
        "farm_id": data.farm_id,
    })

    risk_map = {
        "safe": "low",
        "watch": "medium",
        "critical": "high",
    }

    action_map = {
        "safe": "Continue regular water-quality monitoring",
        "watch": "Check water quality and improve aeration if needed",
        "critical": "Check the pond immediately and take corrective action",
    }

    model_risk = result["risk"]

    return {
        "risk_level": risk_map.get(model_risk, "medium"),
        "risk_score": result.get("risk_score"),
        "reason": "; ".join(result.get("reason", []))
        or "Water-quality model assessment",
        "recommended_action": action_map.get(model_risk, "Continue monitoring"),
        "is_demo": False,
        "model_result": result,
    }


# ---------- Alert message generation ----------

def make_messages(
    action: str,
    risk: str,
    language: Literal["kn", "hi"],
) -> dict:
    english_actions = {
        "Turn on aerator now":
            "Turn on the aerator immediately",
        "Check aeration and water quality":
            "Check aeration and water quality",
        "Continue regular monitoring":
            "Continue regular monitoring",
        "Check water quality and improve aeration if needed":
            "Check water quality and improve aeration if needed",
        "Check the pond immediately and take corrective action":
            "Check the pond immediately and take corrective action",
        "Continue regular water-quality monitoring":
            "Continue regular water-quality monitoring",
        "Inspect affected fish and consult an aquaculture expert":
            "Inspect affected fish immediately and consult an aquaculture expert",
        "Inspect affected fish and monitor their health closely":
            "Inspect affected fish and monitor their health closely",
        "Manually inspect the fish and consult an aquaculture expert":
            "Manually inspect the fish and consult an aquaculture expert",
    }

    kannada_actions = {
        "Turn on aerator now":
            "ತಕ್ಷಣ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ",
        "Check aeration and water quality":
            "ಗಾಳಿ ಪೂರೈಕೆ ಮತ್ತು ನೀರಿನ ಗುಣಮಟ್ಟ ಪರಿಶೀಲಿಸಿ",
        "Continue regular monitoring":
            "ನಿಯಮಿತವಾಗಿ ಮೇಲ್ವಿಚಾರಣೆ ಮುಂದುವರಿಸಿ",
        "Check water quality and improve aeration if needed":
            "ನೀರಿನ ಗುಣಮಟ್ಟ ಪರಿಶೀಲಿಸಿ ಅಗತ್ಯವಿದ್ದರೆ ಗಾಳಿ ಪೂರೈಕೆ ಹೆಚ್ಚಿಸಿ",
        "Check the pond immediately and take corrective action":
            "ತಕ್ಷಣ ಕೊಳ ಪರಿಶೀಲಿಸಿ ಪರಿಹಾರ ಕ್ರಮ ಕೈಗೊಳ್ಳಿ",
        "Continue regular water-quality monitoring":
            "ನಿಯಮಿತ ನೀರಿನ ಗುಣಮಟ್ಟ ಮೇಲ್ವಿಚಾರಣೆ ಮುಂದುವರಿಸಿ",
        "Inspect affected fish and consult an aquaculture expert":
            "ಮೀನುಗಳನ್ನು ತಕ್ಷಣ ಪರಿಶೀಲಿಸಿ ತಜ್ಞರ ಸಲಹೆ ಪಡೆಯಿರಿ",
        "Inspect affected fish and monitor their health closely":
            "ಮೀನುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಅವುಗಳ ಆರೋಗ್ಯವನ್ನು ಗಮನಿಸಿ",
        "Manually inspect the fish and consult an aquaculture expert":
            "ಮೀನುಗಳನ್ನು ಕೈಯಾರೆ ಪರಿಶೀಲಿಸಿ ತಜ್ಞರ ಸಲಹೆ ಪಡೆಯಿರಿ",
    }

    hindi_actions = {
        "Turn on aerator now":
            "अभी एरेटर चालू करें",
        "Check aeration and water quality":
            "हवा की आपूर्ति और पानी की गुणवत्ता जाँचें",
        "Continue regular monitoring":
            "नियमित निगरानी जारी रखें",
        "Check water quality and improve aeration if needed":
            "पानी की गुणवत्ता जाँचें और आवश्यकतानुसार एरेटर चालू करें",
        "Check the pond immediately and take corrective action":
            "तुरंत तालाब की जाँच करें और सुधारात्मक कदम उठाएँ",
        "Continue regular water-quality monitoring":
            "नियमित पानी की गुणवत्ता निगरानी जारी रखें",
        "Inspect affected fish and consult an aquaculture expert":
            "मछलियों की तुरंत जाँच करें और विशेषज्ञ से सलाह लें",
        "Inspect affected fish and monitor their health closely":
            "मछलियों की जाँच करें और उनके स्वास्थ्य पर नज़र रखें",
        "Manually inspect the fish and consult an aquaculture expert":
            "मछलियों की जाँच करें और विशेषज्ञ से सलाह लें",
    }

    english_message = (
        f"{risk.upper()} RISK: "
        f"{english_actions.get(action, action)}."
    )

    if language == "hi":
        local_action = hindi_actions.get(action, action)
        local_message = f"{risk.upper()} जोखिम: {local_action}।"
    else:
        local_action = kannada_actions.get(action, action)
        local_message = f"{risk.upper()} ಅಪಾಯ: {local_action}."

    return {
        "en": english_message,
        language: local_message,
    }


# ---------- Alert history ----------

alert_history: list[dict] = []


def create_alert(
    farm_id: str,
    alert_type: str,
    prediction: dict,
    language: Literal["kn", "hi"] = "kn",
) -> dict | None:
    risk = prediction["risk_level"]

    # Generate alerts for medium and high risks only.
    if risk not in ("medium", "high"):
        return None

    action = prediction["recommended_action"]
    messages = make_messages(action, risk, language)

    alert = {
        "alert_id": str(uuid4()),
        "farm_id": farm_id,
        "type": alert_type,
        "risk_level": risk,
        "message": messages,
        "recommended_action": action,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_demo": prediction.get("is_demo", False),
        "notification": {
            "status": "created",
            "message": "Alert available through the API.",
        },
    }

    # Persist alert to SQLite
    save_alert(alert)

    # Keep in-memory cache synchronized
    alert_history.insert(0, alert)
    return alert


# ---------- API endpoints ----------

# The packaged frontend build is served by FastAPI, so Node.js is not needed
# on the Windows machine that runs this backend.
DIST_DIR = Path(__file__).resolve().parent / "dist"


@app.get("/api/health")
@app.get("/")
def home(request: Request):
    # Keep the root URL user-friendly: show the dashboard when its build exists.
    # The health endpoint remains JSON for the frontend's status indicator.
    index_file = DIST_DIR / "index.html"
    if request.url.path == "/" and index_file.is_file():
        return FileResponse(index_file)

    persisted_alerts = fetch_alerts(limit=500)
    return {
        "status": "online",
        "message": "Aquaculture Alert API is running (SQLite persisted)",
        "docs": "/docs",
        "disease_model": "configured",
        "water_model": "configured",
        "notifications": f"{len(persisted_alerts)} alert(s) in database",
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/water/predict")
@app.post("/api/water/predict")
def water_predict(
    data: WaterRequest,
    language: Literal["kn", "hi"] = Query(default="kn"),
):
    prediction = predict_water(data)

    # Persist sensor reading to SQLite
    save_reading(
        farm_id=data.farm_id,
        ph=data.ph,
        temperature=data.temperature,
        dissolved_oxygen=data.dissolved_oxygen,
        ammonia=data.ammonia,
        species=data.species,
        risk_level=prediction["risk_level"],
        risk_score=prediction.get("risk_score"),
    )

    # Persist assessment record to SQLite
    save_assessment(
        farm_id=data.farm_id,
        assessment_type="water_quality",
        status="SAFE" if prediction["risk_level"] == "low" else "UNSAFE",
        risk_level=prediction["risk_level"],
        risk_score=prediction.get("risk_score"),
        reason=prediction.get("reason", ""),
        recommended_action=prediction.get("recommended_action", ""),
        details=prediction,
    )

    alert = create_alert(
        farm_id=data.farm_id,
        alert_type="water_quality",
        prediction=prediction,
        language=language,
    )

    return {
        "farm_id": data.farm_id,
        "type": "water_quality",
        "prediction": prediction,
        "alert": alert,
    }


@app.post("/disease/predict")
@app.post("/api/disease/predict")
async def disease_predict(
    file: UploadFile = File(...),
    farm_id: str = Form("farm_001"),
    species: str = Form(""),
    language: Literal["kn", "hi"] = Query(default="kn"),
):
    # Validate the uploaded file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file (JPEG, PNG, WebP).",
        )

    image_bytes = await file.read()
    await file.close()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    # Run disease prediction model with optional category override
    try:
        category_override = species if species and species.strip() else None
        result = run_disease_model(
            image_bytes,
            farm_id=farm_id,
            category=category_override,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Disease model prediction failed: {str(exc)}",
        ) from exc

    risk = str(result.get("risk", "unknown")).lower()

    if risk not in ("low", "medium", "high", "unknown"):
        risk = "unknown"

    label = result.get("label", "Unknown")

    if risk == "high":
        action = "Inspect affected fish and consult an aquaculture expert"
    elif risk == "medium":
        action = "Inspect affected fish and monitor their health closely"
    elif risk == "low":
        action = "Continue regular monitoring"
    else:
        action = "Manually inspect the fish and consult an aquaculture expert"

    prediction = {
        "risk_level": risk,
        "risk_score": result.get("confidence", 0.0),
        "reason": f"Model prediction: {label} (Category: {result.get('category', 'unknown')})",
        "recommended_action": action,
        "is_demo": False,
        "model_result": result,
    }

    # Persist assessment record to SQLite
    save_assessment(
        farm_id=farm_id,
        assessment_type="fish_disease",
        status="SAFE" if risk == "low" else "UNSAFE",
        risk_level=risk,
        risk_score=prediction.get("risk_score"),
        reason=prediction.get("reason", ""),
        recommended_action=action,
        details=prediction,
    )

    alert = create_alert(
        farm_id=farm_id,
        alert_type="fish_disease",
        prediction=prediction,
        language=language,
    )

    return {
        "farm_id": farm_id,
        "type": "fish_disease",
        "prediction": prediction,
        "alert": alert,
    }


@app.get("/alerts")
@app.get("/api/alerts")
def get_alerts(
    farm_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
):
    selected_alerts = fetch_alerts(farm_id=farm_id, limit=limit)
    return {
        "count": len(selected_alerts),
        "alerts": selected_alerts,
    }


@app.get("/readings")
@app.get("/api/readings")
def get_readings(
    farm_id: str | None = None,
    limit: int = Query(default=24, ge=1, le=100),
):
    """Retrieve historical pond telemetry readings for visualization."""
    readings = fetch_readings(farm_id=farm_id, limit=limit)
    return {
        "count": len(readings),
        "readings": readings,
    }


@app.get("/assessments")
@app.get("/api/assessments")
def get_assessments_endpoint(
    farm_id: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
):
    """Retrieve historical assessment log records."""
    assessments = fetch_assessments(farm_id=farm_id, limit=limit)
    return {
        "count": len(assessments),
        "assessments": assessments,
    }


@app.post("/replay")
@app.post("/api/replay")
def replay(data: ReplayRequest):
    # Field readings to test the real alert flow
    water = WaterRequest(
        farm_id=data.farm_id,
        ph=7.5,
        temperature=29.0,
        dissolved_oxygen=3.2,
        ammonia=0.04,
        species="carp",
    )

    water_prediction = predict_water(water)

    water_alert = create_alert(
        farm_id=data.farm_id,
        alert_type="water_quality",
        prediction=water_prediction,
        language=data.language,
    )

    return {
        "farm_id": data.farm_id,
        "replayed_at": datetime.now(timezone.utc).isoformat(),
        "results": [
            {
                "type": "water_quality",
                "prediction": water_prediction,
                "alert": water_alert,
            }
        ],
        "is_demo": True,
    }


# Serve built frontend assets and support React client-side routes (for example,
# /water-monitoring) without requiring Node.js. API routes above take precedence.
@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    index_file = DIST_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(
            status_code=404,
            detail="Frontend build not found. Place the compiled UI in backend/dist.",
        )

    root = DIST_DIR.resolve()
    requested = (DIST_DIR / full_path).resolve()
    if requested.is_relative_to(root) and requested.is_file():
        return FileResponse(requested)

    # For non-file paths, serve index.html so React can handle browser routes.
    return FileResponse(index_file)

"""
SQLite Persistence Layer for Aquaculture Alerts & Telemetry
Uses Python standard library sqlite3 for zero-dependency ACID storage.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).resolve().parent / "aquaculture.db"


def get_db_connection() -> sqlite3.Connection:
    """Create a connection to the SQLite database with row dictionary access."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize SQLite tables and create performance indexes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. Alerts Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id TEXT PRIMARY KEY,
                farm_id TEXT NOT NULL,
                type TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                message_en TEXT NOT NULL,
                message_kn TEXT,
                message_hi TEXT,
                recommended_action TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_demo INTEGER DEFAULT 0,
                notification_status TEXT DEFAULT 'created'
            )
            """
        )

        # 2. Sensor Readings (Telemetry) Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farm_id TEXT NOT NULL,
                ph REAL NOT NULL,
                temperature REAL NOT NULL,
                dissolved_oxygen REAL NOT NULL,
                ammonia REAL NOT NULL,
                species TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                risk_score REAL,
                created_at TEXT NOT NULL
            )
            """
        )

        # 3. Assessment History Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS assessment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farm_id TEXT NOT NULL,
                assessment_type TEXT NOT NULL,
                status TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                risk_score REAL,
                reason TEXT,
                recommended_action TEXT,
                details_json TEXT,
                created_at TEXT NOT NULL
            )
            """
        )

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_farm ON alerts(farm_id, created_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_farm ON sensor_readings(farm_id, created_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assessments_farm ON assessment_history(farm_id, created_at DESC)")

        conn.commit()

        # Seed baseline historical telemetry if table is empty
        cursor.execute("SELECT COUNT(*) FROM sensor_readings")
        count = cursor.fetchone()[0]
        if count == 0:
            seed_initial_telemetry(conn)


def seed_initial_telemetry(conn: sqlite3.Connection) -> None:
    """Seed realistic initial pond baseline telemetry so historical charts have rich data on fresh launch."""
    baseline_data = [
        ("farm_001", 7.3, 26.2, 5.6, 0.03, "tilapia", "low", 0.05, "2026-10-22T00:00:00Z"),
        ("farm_001", 7.2, 25.9, 5.1, 0.03, "tilapia", "low", 0.07, "2026-10-22T02:00:00Z"),
        ("farm_001", 7.1, 25.7, 4.8, 0.04, "tilapia", "medium", 0.35, "2026-10-22T04:00:00Z"),
        ("farm_001", 7.2, 26.0, 5.3, 0.03, "tilapia", "low", 0.08, "2026-10-22T06:00:00Z"),
        ("farm_001", 7.3, 26.8, 6.2, 0.02, "tilapia", "low", 0.04, "2026-10-22T08:00:00Z"),
        ("farm_001", 7.4, 27.5, 6.6, 0.02, "tilapia", "low", 0.03, "2026-10-22T10:00:00Z"),
        ("farm_001", 7.5, 28.2, 6.8, 0.02, "tilapia", "low", 0.02, "2026-10-22T12:00:00Z"),
        ("farm_001", 7.4, 28.0, 6.5, 0.02, "tilapia", "low", 0.03, "2026-10-22T14:00:00Z"),
    ]

    cursor = conn.cursor()
    cursor.executemany(
        """
        INSERT INTO sensor_readings (
            farm_id, ph, temperature, dissolved_oxygen, ammonia, species, risk_level, risk_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        baseline_data,
    )
    conn.commit()


# ---------- Persistence Operations ----------

def save_alert(alert: Dict[str, Any]) -> None:
    """Save an alert record into SQLite."""
    messages = alert.get("message", {})
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO alerts (
                alert_id, farm_id, type, risk_level, message_en, message_kn, message_hi,
                recommended_action, created_at, is_demo, notification_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert["alert_id"],
                alert["farm_id"],
                alert["type"],
                alert["risk_level"],
                messages.get("en", ""),
                messages.get("kn", ""),
                messages.get("hi", ""),
                alert.get("recommended_action", ""),
                alert["created_at"],
                1 if alert.get("is_demo") else 0,
                alert.get("notification", {}).get("status", "created"),
            ),
        )
        conn.commit()


def fetch_alerts(farm_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch alerts from SQLite ordered by creation time descending."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if farm_id:
            cursor.execute(
                """
                SELECT * FROM alerts 
                WHERE farm_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
                """,
                (farm_id, limit),
            )
        else:
            cursor.execute(
                """
                SELECT * FROM alerts 
                ORDER BY created_at DESC 
                LIMIT ?
                """,
                (limit,),
            )

        rows = cursor.fetchall()
        results = []
        for r in rows:
            results.append({
                "alert_id": r["alert_id"],
                "farm_id": r["farm_id"],
                "type": r["type"],
                "risk_level": r["risk_level"],
                "message": {
                    "en": r["message_en"],
                    "kn": r["message_kn"],
                    "hi": r["message_hi"],
                },
                "recommended_action": r["recommended_action"],
                "created_at": r["created_at"],
                "is_demo": bool(r["is_demo"]),
                "notification": {
                    "status": r["notification_status"],
                    "message": "Alert retrieved from persistent SQLite database.",
                },
            })
        return results


def save_reading(
    farm_id: str,
    ph: float,
    temperature: float,
    dissolved_oxygen: float,
    ammonia: float,
    species: str,
    risk_level: str,
    risk_score: Optional[float] = None,
    created_at: Optional[str] = None,
) -> int:
    """Save a sensor telemetry reading into SQLite."""
    timestamp = created_at or datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO sensor_readings (
                farm_id, ph, temperature, dissolved_oxygen, ammonia, species, risk_level, risk_score, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (farm_id, ph, temperature, dissolved_oxygen, ammonia, species, risk_level, risk_score, timestamp),
        )
        conn.commit()
        return cursor.lastrowid or 0


def fetch_readings(farm_id: Optional[str] = None, limit: int = 24) -> List[Dict[str, Any]]:
    """Fetch chronological sensor telemetry readings for visualization and analytics."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if farm_id:
            cursor.execute(
                """
                SELECT * FROM (
                    SELECT * FROM sensor_readings
                    WHERE farm_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                ) ORDER BY id ASC
                """,
                (farm_id, limit),
            )
        else:
            cursor.execute(
                """
                SELECT * FROM (
                    SELECT * FROM sensor_readings
                    ORDER BY id DESC
                    LIMIT ?
                ) ORDER BY id ASC
                """,
                (limit,),
            )

        rows = cursor.fetchall()
        return [
            {
                "id": r["id"],
                "farm_id": r["farm_id"],
                "ph": r["ph"],
                "temperature": r["temperature"],
                "dissolved_oxygen": r["dissolved_oxygen"],
                "ammonia": r["ammonia"],
                "species": r["species"],
                "risk_level": r["risk_level"],
                "risk_score": r["risk_score"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]


def save_assessment(
    farm_id: str,
    assessment_type: str,
    status: str,
    risk_level: str,
    risk_score: Optional[float],
    reason: str,
    recommended_action: str,
    details: Optional[Dict[str, Any]] = None,
) -> int:
    """Save a complete assessment history entry."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO assessment_history (
                farm_id, assessment_type, status, risk_level, risk_score,
                reason, recommended_action, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                farm_id,
                assessment_type,
                status,
                risk_level,
                risk_score,
                reason,
                recommended_action,
                json.dumps(details or {}),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        return cursor.lastrowid or 0


def fetch_assessments(farm_id: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
    """Fetch assessment history log entries."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if farm_id:
            cursor.execute(
                "SELECT * FROM assessment_history WHERE farm_id = ? ORDER BY id DESC LIMIT ?",
                (farm_id, limit),
            )
        else:
            cursor.execute(
                "SELECT * FROM assessment_history ORDER BY id DESC LIMIT ?",
                (limit,),
            )
        rows = cursor.fetchall()
        return [
            {
                "id": r["id"],
                "farm_id": r["farm_id"],
                "assessment_type": r["assessment_type"],
                "status": r["status"],
                "risk_level": r["risk_level"],
                "risk_score": r["risk_score"],
                "reason": r["reason"],
                "recommended_action": r["recommended_action"],
                "details": json.loads(r["details_json"]) if r["details_json"] else {},
                "created_at": r["created_at"],
            }
            for r in rows
        ]

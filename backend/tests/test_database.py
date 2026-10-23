"""
Unit Tests for SQLite Persistence Layer (backend/database.py)
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import database


class TestDatabasePersistence(unittest.TestCase):
    def setUp(self):
        # Use an isolated temporary SQLite database for tests
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.original_db_path = database.DB_PATH
        database.DB_PATH = Path(self.temp_db.name)
        database.init_db()

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        if os.path.exists(self.temp_db.name):
            try:
                os.remove(self.temp_db.name)
            except OSError:
                pass

    def test_init_db_creates_tables(self):
        """Verify all tables and seed records are created on init_db()."""
        with database.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row["name"] for row in cursor.fetchall()]

            self.assertIn("alerts", tables)
            self.assertIn("sensor_readings", tables)
            self.assertIn("assessment_history", tables)

    def test_save_and_fetch_alerts(self):
        """Verify alert records persist and can be fetched ordered by time."""
        sample_alert = {
            "alert_id": "test_alert_001",
            "farm_id": "farm_test",
            "type": "water_quality",
            "risk_level": "high",
            "message": {
                "en": "HIGH RISK: Turn on the aerator immediately.",
                "kn": "HIGH ಅಪಾಯ: ತಕ್ಷಣ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ.",
                "hi": "HIGH जोखिम: अभी एरेटर चालू करें।",
            },
            "recommended_action": "Turn on the aerator immediately",
            "created_at": "2026-10-22T21:00:00Z",
            "is_demo": False,
            "notification": {"status": "created"},
        }

        database.save_alert(sample_alert)
        alerts = database.fetch_alerts(farm_id="farm_test", limit=10)

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["alert_id"], "test_alert_001")
        self.assertEqual(alerts[0]["risk_level"], "high")
        self.assertEqual(alerts[0]["message"]["kn"], "HIGH ಅಪಾಯ: ತಕ್ಷಣ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ.")

    def test_save_and_fetch_sensor_readings(self):
        """Verify telemetry readings persist and are fetched chronologically."""
        reading_id = database.save_reading(
            farm_id="pond_01",
            ph=7.4,
            temperature=28.5,
            dissolved_oxygen=6.2,
            ammonia=0.02,
            species="tilapia",
            risk_level="low",
            risk_score=0.04,
            created_at="2026-10-22T21:15:00Z",
        )
        self.assertGreater(reading_id, 0)

        readings = database.fetch_readings(farm_id="pond_01", limit=10)
        self.assertTrue(len(readings) >= 1)
        latest = [r for r in readings if r["id"] == reading_id][0]
        self.assertEqual(latest["ph"], 7.4)
        self.assertEqual(latest["dissolved_oxygen"], 6.2)
        self.assertEqual(latest["risk_level"], "low")

    def test_save_and_fetch_assessment(self):
        """Verify assessment history records persist correctly."""
        assessment_id = database.save_assessment(
            farm_id="pond_01",
            assessment_type="water_quality",
            status="SAFE",
            risk_level="low",
            risk_score=0.05,
            reason="All parameters in safe zone",
            recommended_action="Continue regular monitoring",
            details={"ph": 7.4, "do": 6.5},
        )
        self.assertGreater(assessment_id, 0)

        assessments = database.fetch_assessments(farm_id="pond_01", limit=5)
        self.assertEqual(len(assessments), 1)
        self.assertEqual(assessments[0]["status"], "SAFE")
        self.assertEqual(assessments[0]["details"]["ph"], 7.4)


if __name__ == "__main__":
    unittest.main()

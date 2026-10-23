"""
Unit Tests for Multilingual Alert Engine (backend/main.py)
"""

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import make_messages, create_alert, alert_history


class TestAlertEngine(unittest.TestCase):
    def test_kannada_translation(self):
        """Verify action message translation to Kannada."""
        action = "Turn on aerator now"
        msgs = make_messages(action, "high", "kn")
        self.assertIn("en", msgs)
        self.assertIn("kn", msgs)
        self.assertIn("ಅಪಾಯ", msgs["kn"])
        self.assertIn("ತಕ್ಷಣ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ", msgs["kn"])

    def test_hindi_translation(self):
        """Verify action message translation to Hindi."""
        action = "Check aeration and water quality"
        msgs = make_messages(action, "medium", "hi")
        self.assertIn("en", msgs)
        self.assertIn("hi", msgs)
        self.assertIn("जोखिम", msgs["hi"])
        self.assertIn("हवा की आपूर्ति और पानी की गुणवत्ता जाँचें", msgs["hi"])

    def test_alert_suppression_for_low_risk(self):
        """Verify low risk predictions do NOT dispatch alerts."""
        prediction = {
            "risk_level": "low",
            "recommended_action": "Continue regular monitoring",
            "is_demo": False,
        }
        alert = create_alert("farm_001", "water_quality", prediction, "kn")
        self.assertIsNone(alert)

    def test_alert_creation_for_high_risk(self):
        """Verify high risk predictions generate persistent alert dictionaries."""
        prediction = {
            "risk_level": "high",
            "recommended_action": "Turn on aerator now",
            "is_demo": False,
        }
        alert = create_alert("farm_001", "water_quality", prediction, "kn")
        self.assertIsNotNone(alert)
        self.assertEqual(alert["risk_level"], "high")
        self.assertEqual(alert["type"], "water_quality")
        self.assertIn("kn", alert["message"])


if __name__ == "__main__":
    unittest.main()

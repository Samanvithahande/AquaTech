"""
Unit Tests for Water-Quality Telemetry Prediction (backend/water_model.py)
"""

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

try:
    from water_model import predict_water, SPECIES_THRESHOLDS
except ImportError:
    from core.water_model import predict_water, SPECIES_THRESHOLDS


class TestWaterModel(unittest.TestCase):
    def test_species_threshold_definitions(self):
        """Verify defined threshold boundaries for supported species."""
        for species in ["carp", "shrimp", "tilapia"]:
            self.assertIn(species, SPECIES_THRESHOLDS)
            rules = SPECIES_THRESHOLDS[species]
            self.assertIn("ph", rules)
            self.assertIn("do_min", rules)
            self.assertIn("temp", rules)
            self.assertIn("ammonia_max", rules)

    def test_safe_reading_prediction(self):
        """Verify optimal pond telemetry returns safe risk level."""
        sample = {
            "farm_id": "test_farm",
            "ph": 7.5,
            "do": 6.8,
            "temp": 28.0,
            "ammonia": 0.02,
            "species": "tilapia",
        }
        res = predict_water(sample)
        self.assertIn("risk", res)
        self.assertIn("risk_score", res)
        # Optimal readings should evaluate as safe
        self.assertEqual(res["risk"], "safe")
        self.assertLess(res["risk_score"], 0.25)

    def test_critical_hypoxia_prediction(self):
        """Verify critical dissolved oxygen hypoxia triggers critical risk."""
        sample = {
            "farm_id": "test_farm",
            "ph": 7.4,
            "do": 2.1,  # Severe hypoxia (below 4.0/5.0 mg/L)
            "temp": 28.0,
            "ammonia": 0.02,
            "species": "carp",
        }
        res = predict_water(sample)
        self.assertEqual(res["risk"], "critical")
        self.assertTrue(res["alert"])
        self.assertGreaterEqual(res["risk_score"], 0.60)

    def test_high_ammonia_toxicity_prediction(self):
        """Verify lethal ammonia concentration triggers critical risk."""
        sample = {
            "farm_id": "test_farm",
            "ph": 8.8,
            "do": 5.5,
            "temp": 30.0,
            "ammonia": 0.12,  # Way above 0.05 mg/L threshold
            "species": "shrimp",
        }
        res = predict_water(sample)
        self.assertEqual(res["risk"], "critical")
        self.assertTrue(res["alert"])


if __name__ == "__main__":
    unittest.main()

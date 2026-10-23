"""
Unit Tests for Disease Diagnostic Inference Rules (backend/predict.py)
"""

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from predict import clean_label, risk_for_label, CATEGORY_ALIASES


class TestDiseaseInference(unittest.TestCase):
    def test_clean_label_prefixes(self):
        """Verify numeric and punctuation folder prefixes are cleaned."""
        self.assertEqual(clean_label("1. Healthy"), "Healthy")
        self.assertEqual(clean_label("2. BG"), "BG")
        self.assertEqual(clean_label("3. WSSV"), "WSSV")
        self.assertEqual(clean_label("4_WSSV_BG"), "WSSV_BG")
        self.assertEqual(clean_label("Bacterial Gill Disease"), "Bacterial Gill Disease")

    def test_risk_for_label_mapping(self):
        """Verify disease keywords correctly map to risk classifications."""
        self.assertEqual(risk_for_label("Healthy Fish"), "low")
        self.assertEqual(risk_for_label("1. Healthy"), "low")
        self.assertEqual(risk_for_label("Bacterial Red Disease"), "high")
        self.assertEqual(risk_for_label("EUS"), "high")
        self.assertEqual(risk_for_label("WSSV"), "high")
        self.assertEqual(risk_for_label("Ice-Ice Disease"), "high")
        self.assertEqual(risk_for_label("Endophytes"), "medium")

    def test_category_aliases(self):
        """Verify common user terms map to model categories."""
        self.assertEqual(CATEGORY_ALIASES.get("fish"), "finfish")
        self.assertEqual(CATEGORY_ALIASES.get("prawn"), "shrimp")
        self.assertEqual(CATEGORY_ALIASES.get("oyster"), "bivalve")


if __name__ == "__main__":
    unittest.main()

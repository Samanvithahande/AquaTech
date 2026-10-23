import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, INITIAL_PONDS, SAFE_ASSESSMENT_SAMPLE } from '../lib/mockData';

test('Initial Ponds configuration integrity', () => {
  assert.equal(INITIAL_PONDS.length, 4);
  const tilapiaPond = INITIAL_PONDS.find((p) => p.species === 'tilapia');
  assert.ok(tilapiaPond, 'Tilapia pond should exist');
  assert.equal(tilapiaPond.aeratorStatus, 'Active');

  const shrimpPond = INITIAL_PONDS.find((p) => p.species === 'shrimp');
  assert.ok(shrimpPond, 'Shrimp pond should exist');
});

test('Safe Assessment baseline metrics validation', () => {
  assert.equal(SAFE_ASSESSMENT_SAMPLE.status, 'SAFE');
  assert.equal(SAFE_ASSESSMENT_SAMPLE.riskLevel, 'low');
  assert.ok(SAFE_ASSESSMENT_SAMPLE.readings.do >= 5.0, 'DO should be safe');
  assert.ok(SAFE_ASSESSMENT_SAMPLE.readings.ph >= 6.5 && SAFE_ASSESSMENT_SAMPLE.readings.ph <= 8.5, 'pH should be safe');
  assert.ok(SAFE_ASSESSMENT_SAMPLE.readings.ammonia <= 0.05, 'Ammonia should be safe');
});

test('Default Farmer Settings localization', () => {
  assert.equal(DEFAULT_SETTINGS.language, 'kn');
  assert.ok(DEFAULT_SETTINGS.notifications.waterQualityAlerts);
  assert.ok(DEFAULT_SETTINGS.notifications.diseaseDetectionAlerts);
});

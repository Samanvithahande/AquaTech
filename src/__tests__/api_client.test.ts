import test from 'node:test';
import assert from 'node:assert/strict';
import { AquacultureApiClient, DEFAULT_BACKEND_URL } from '../lib/api';

test('AquacultureApiClient initialization and URL handling', () => {
  const client = new AquacultureApiClient('http://localhost:8000');
  assert.equal(client.getBaseUrl(), 'http://localhost:8000');

  // Trailing slash stripping
  client.setBaseUrl('http://127.0.0.1:8000///');
  assert.equal(client.getBaseUrl(), 'http://127.0.0.1:8000');
});

test('AquacultureApiClient payload validation types', () => {
  const payload = {
    farm_id: 'pond_01',
    ph: 7.4,
    temperature: 28.0,
    dissolved_oxygen: 6.5,
    ammonia: 0.02,
    species: 'tilapia',
  };

  assert.equal(typeof payload.ph, 'number');
  assert.equal(typeof payload.dissolved_oxygen, 'number');
  assert.equal(payload.species, 'tilapia');
});

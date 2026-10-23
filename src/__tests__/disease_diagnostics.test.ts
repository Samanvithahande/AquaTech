import test from 'node:test';
import assert from 'node:assert/strict';

test('Disease categories species mapping validation', () => {
  const mapSpeciesToCategory = (speciesName: string): string => {
    const s = speciesName.toLowerCase();
    if (s.includes('shrimp') || s.includes('prawn')) return 'shrimp';
    if (s.includes('seaweed')) return 'seaweed';
    if (s.includes('oyster') || s.includes('bivalve')) return 'bivalve';
    return 'finfish';
  };

  assert.equal(mapSpeciesToCategory('Nile Tilapia (finfish)'), 'finfish');
  assert.equal(mapSpeciesToCategory('Tiger Prawn (Penaeus monodon)'), 'shrimp');
  assert.equal(mapSpeciesToCategory('Kappaphycus Seaweed'), 'seaweed');
  assert.equal(mapSpeciesToCategory('Pacific Oyster'), 'bivalve');
  assert.equal(mapSpeciesToCategory('Freshwater Rohu Carp'), 'finfish');
});

test('Disease diagnostic risk levels thresholding', () => {
  const getRiskAction = (risk: string) => {
    if (risk === 'high') return 'Immediate veterinary inspection required';
    if (risk === 'medium') return 'Monitor cohort and increase aeration';
    return 'Maintain regular monitoring';
  };

  assert.equal(getRiskAction('high'), 'Immediate veterinary inspection required');
  assert.equal(getRiskAction('medium'), 'Monitor cohort and increase aeration');
  assert.equal(getRiskAction('low'), 'Maintain regular monitoring');
});

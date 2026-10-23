import { FarmSettings, Pond, RecentReport, WaterAssessment, WaterParameter } from '../types/aquaculture';

// Local specimen and farm photos (hosted from public/assets/images for production safety)
export const SAMPLE_IMAGES = {
  farmPond: '/assets/images/aquaculture_pond_farm_1792414762452.jpg',
  healthyTilapia: '/assets/images/tilapia_healthy_fish_1792414763678.jpg',
  diseasedFish: '/assets/images/fish_disease_sample_1792414763015.jpg',
};

export const INITIAL_PONDS: Pond[] = [
  {
    id: 'pond-1',
    name: 'Pond 01 — Tilapia Grow-out',
    species: 'tilapia',
    biomassKg: 4200,
    depthMeters: 1.8,
    aeratorStatus: 'Active',
    lastChecked: '10 mins ago',
  },
  {
    id: 'pond-2',
    name: 'Pond 02 — Indian Carp Pond',
    species: 'carp',
    biomassKg: 2800,
    depthMeters: 1.5,
    aeratorStatus: 'Active',
    lastChecked: '25 mins ago',
  },
  {
    id: 'pond-3',
    name: 'Pond 03 — Vannamei Shrimp Pond',
    species: 'shrimp',
    biomassKg: 1950,
    depthMeters: 1.6,
    aeratorStatus: 'Standby',
    lastChecked: '1 hour ago',
  },
  {
    id: 'pond-4',
    name: 'Pond 04 — Nursery Carp Broodstock',
    species: 'carp',
    biomassKg: 3100,
    depthMeters: 2.0,
    aeratorStatus: 'Active',
    lastChecked: '40 mins ago',
  },
];

export const SAFE_ASSESSMENT_SAMPLE: WaterAssessment = {
  id: 'wa-safe-101',
  pondId: 'pond-1',
  pondName: 'Pond 01 — Tilapia Grow-out',
  status: 'SAFE',
  riskLevel: 'low',
  riskScore: 0.05,
  timestamp: 'Initial Assessment',
  readings: {
    ph: 7.4,
    do: 6.8,
    temp: 27.8,
    ammonia: 0.02,
    species: 'tilapia',
  },
  reasons: [
    'Dissolved Oxygen is 6.8 mg/L (well above target species threshold).',
    'Pond pH is 7.4, within safe operating range (6.5 – 9.0).',
    'Ammonia level is 0.02 mg/L, safe for continued feeding (< 0.05 mg/L).',
    'Water temperature is 27.8 °C, optimal for metabolic growth.',
  ],
  recommendations: [
    'Continue regular water-quality monitoring',
    'Maintain daytime paddlewheel aeration schedule at standard capacity',
  ],
};

export const DEFAULT_PARAMETERS: WaterParameter[] = [
  {
    id: 'param-ph',
    name: 'pH Index',
    key: 'ph',
    value: 7.4,
    unit: 'pH',
    status: 'SAFE',
    optimalRange: '6.5 – 8.5',
  },
  {
    id: 'param-do',
    name: 'Dissolved Oxygen (DO)',
    key: 'do',
    value: 6.8,
    unit: 'mg/L',
    status: 'SAFE',
    optimalRange: '> 5.0 mg/L',
  },
  {
    id: 'param-temp',
    name: 'Water Temperature',
    key: 'temp',
    value: 27.8,
    unit: '°C',
    status: 'SAFE',
    optimalRange: '25.0 – 30.0 °C',
  },
  {
    id: 'param-ammonia',
    name: 'Ammonia (NH3)',
    key: 'ammonia',
    value: 0.02,
    unit: 'mg/L',
    status: 'SAFE',
    optimalRange: '< 0.05 mg/L',
  },
];

export const HOURLY_WATER_METRICS = [
  { time: '00:00', ph: 7.3, do: 5.6, temp: 26.2, ammonia: 0.03 },
  { time: '02:00', ph: 7.2, do: 5.1, temp: 25.9, ammonia: 0.03 },
  { time: '04:00', ph: 7.1, do: 4.8, temp: 25.7, ammonia: 0.04 },
  { time: '06:00', ph: 7.2, do: 5.3, temp: 26.0, ammonia: 0.03 },
  { time: '08:00', ph: 7.3, do: 6.2, temp: 26.8, ammonia: 0.02 },
  { time: '10:00', ph: 7.4, do: 6.8, temp: 27.8, ammonia: 0.02 },
  { time: '12:00', ph: 7.6, do: 7.4, temp: 29.1, ammonia: 0.02 },
  { time: '14:00', ph: 7.8, do: 7.7, temp: 29.8, ammonia: 0.02 },
  { time: '16:00', ph: 7.7, do: 7.2, temp: 29.3, ammonia: 0.02 },
  { time: '18:00', ph: 7.5, do: 6.5, temp: 28.4, ammonia: 0.03 },
  { time: '20:00', ph: 7.4, do: 6.0, temp: 27.4, ammonia: 0.03 },
  { time: '22:00', ph: 7.3, do: 5.7, temp: 26.8, ammonia: 0.03 },
];

export const INITIAL_RECENT_REPORTS: RecentReport[] = [
  {
    id: 'rep-001',
    timestamp: 'Just now',
    type: 'Water Quality Assessment',
    pondName: 'Pond 01 — Tilapia Grow-out',
    status: 'SAFE',
    summary: 'Water parameters optimal: pH 7.4, DO 6.8 mg/L, Temp 27.8°C, Ammonia 0.02 mg/L.',
    targetPage: 'water-monitoring',
  },
  {
    id: 'rep-002',
    timestamp: 'Today, 08:30 AM',
    type: 'Disease Detection',
    pondName: 'Pond 02 — Indian Carp Pond',
    status: 'High Risk',
    summary: 'Specimen screening: Bacterial lesion indicators identified. Immediate veterinary follow-up advised.',
    targetPage: 'disease-detection',
  },
  {
    id: 'rep-003',
    timestamp: 'Yesterday, 04:15 PM',
    type: 'Water Quality Assessment',
    pondName: 'Pond 03 — Vannamei Shrimp Pond',
    status: 'SAFE',
    summary: 'Dissolved oxygen 6.4 mg/L, ammonia 0.01 mg/L within acceptable brackish boundaries.',
    targetPage: 'water-monitoring',
  },
];

export const DEFAULT_SETTINGS: FarmSettings = {
  farmerName: 'Ramesh',
  phone: '+91 9876543210',
  farmName: "Ramesh's Aquaculture Farm",
  location: 'Krishna River Delta, Andhra Pradesh',
  ponds: INITIAL_PONDS,
  notifications: {
    waterQualityAlerts: true,
    diseaseDetectionAlerts: true,
    generalAnnouncements: false,
  },
  theme: 'light',
  language: 'kn', // Kannada default for local aquaculture farmers
  backendUrl: '/api',
};

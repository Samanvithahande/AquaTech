export type PageRoute = 'dashboard' | 'water-monitoring' | 'disease-detection' | 'settings';

export type WaterStatus = 'SAFE' | 'UNSAFE' | 'WARNING';

export interface WaterParameter {
  id: string;
  name: string;
  key: 'ph' | 'do' | 'temp' | 'ammonia';
  value: number | null;
  unit: string;
  status: WaterStatus | 'UNAVAILABLE';
  optimalRange: string;
}

export interface ApiAlert {
  alert_id: string;
  farm_id: string;
  type: 'water_quality' | 'fish_disease' | string;
  risk_level: 'low' | 'medium' | 'high' | 'unknown' | string;
  message: {
    en: string;
    kn?: string;
    hi?: string;
    [key: string]: string | undefined;
  };
  recommended_action: string;
  created_at: string;
  is_demo?: boolean;
  notification?: {
    status: string;
    message: string;
  };
}

export interface WaterAssessment {
  id: string;
  pondId: string;
  pondName: string;
  status: 'SAFE' | 'UNSAFE';
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number | null;
  timestamp: string;
  readings: {
    ph: number;
    do: number; // dissolved oxygen in mg/L
    temp: number; // Celsius
    ammonia: number; // mg/L
    species?: 'carp' | 'shrimp' | 'tilapia' | string;
  };
  reasons: string[];
  recommendations: string[];
  alert?: ApiAlert | null;
  rawResponse?: any;
}

export interface DiseaseDetectionResult {
  id: string;
  timestamp: string;
  imagePreview: string;
  species: string;
  diseaseName: string;
  category: 'Bacterial' | 'Parasitic' | 'Fungal' | 'Viral' | 'Healthy / Non-Pathological' | string;
  confidenceScore: number;
  isHealthy: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  commonSymptoms: string[];
  recommendedActions: string[];
  veterinaryAdvisory: string;
  alert?: ApiAlert | null;
  rawResponse?: any;
}

export interface RecentReport {
  id: string;
  timestamp: string;
  type: 'Water Quality Assessment' | 'Disease Detection';
  pondName: string;
  status: 'SAFE' | 'UNSAFE' | 'Healthy' | 'Action Needed' | 'High Risk' | 'Medium Risk';
  summary: string;
  targetPage: PageRoute;
  rawDetails?: WaterAssessment | DiseaseDetectionResult;
  alert?: ApiAlert | null;
}

export interface Pond {
  id: string;
  name: string;
  species: 'carp' | 'shrimp' | 'tilapia' | string;
  biomassKg: number;
  depthMeters: number;
  aeratorStatus: 'Active' | 'Standby' | 'Maintenance';
  lastChecked: string;
}

export interface FarmSettings {
  farmerName: string;
  phone: string;
  farmName: string;
  location: string;
  ponds: Pond[];
  notifications: {
    waterQualityAlerts: boolean;
    diseaseDetectionAlerts: boolean;
    generalAnnouncements: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  language: 'kn' | 'hi' | 'en';
  backendUrl: string;
}

export interface BackendStatus {
  status: 'checking' | 'online' | 'offline' | 'error';
  url: string;
  docsUrl?: string;
  message?: string;
  details?: any;
  lastChecked?: string;
}

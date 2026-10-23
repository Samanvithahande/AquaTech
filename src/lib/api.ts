import { ApiAlert, BackendStatus } from '../types/aquaculture';

// Default backend URL: allows using local FastAPI server (http://localhost:8000) or relative proxy (/api)
export const DEFAULT_BACKEND_URL = 
  (typeof window !== 'undefined' && localStorage.getItem('aquaguard_backend_url')) ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'http://localhost:8000');

export interface WaterPredictPayload {
  farm_id: string;
  ph: number;
  temperature: number;
  dissolved_oxygen: number;
  ammonia: number;
  species: 'carp' | 'shrimp' | 'tilapia' | string;
}

export interface WaterPredictResult {
  farm_id: string;
  type: string;
  prediction: {
    risk_level: 'low' | 'medium' | 'high' | string;
    risk_score: number | null;
    reason: string;
    recommended_action: string;
    is_demo: boolean;
    model_result?: any;
  };
  alert: ApiAlert | null;
}

export interface DiseasePredictResult {
  farm_id: string;
  type: string;
  prediction: {
    risk_level: 'low' | 'medium' | 'high' | 'unknown';
    risk_score: number;
    reason: string;
    recommended_action: string;
    is_demo: boolean;
    model_result?: {
      timestamp?: string;
      category?: string;
      label?: string;
      confidence?: number;
      category_confidence?: number;
      category_source?: string;
      risk?: string;
      alert?: boolean;
      [key: string]: any;
    };
  };
  alert: ApiAlert | null;
}

export interface ReplayResult {
  farm_id: string;
  replayed_at: string;
  results: Array<{
    type: string;
    prediction: any;
    alert: ApiAlert | null;
  }>;
  is_demo: boolean;
}

export interface TelemetryReading {
  id: number;
  farm_id: string;
  ph: number;
  temperature: number;
  dissolved_oxygen: number;
  ammonia: number;
  species: string;
  risk_level: string;
  risk_score: number | null;
  created_at: string;
}

export class AquacultureApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BACKEND_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    try {
      localStorage.setItem('aquaguard_backend_url', this.baseUrl);
    } catch {
      // ignore storage error
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Ping the backend root / or /api/health to confirm status
   */
  async checkHealth(): Promise<BackendStatus> {
    const urlsToTry = [
      this.baseUrl,
      `${this.baseUrl}/api/health`,
      `${this.baseUrl}/health`
    ];

    let lastError = '';
    for (const url of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return {
            status: 'online',
            url: this.baseUrl,
            docsUrl: `${this.baseUrl}/docs`,
            message: data.message || 'FastAPI backend connected successfully',
            details: data,
            lastChecked: new Date().toLocaleTimeString(),
          };
        }
      } catch (err: any) {
        lastError = err?.message || 'Connection refused';
      }
    }

    return {
      status: 'offline',
      url: this.baseUrl,
      message: `Cannot reach backend at ${this.baseUrl} (${lastError}). Make sure your FastAPI server is running with 'uvicorn main:app --port 8000'.`,
      lastChecked: new Date().toLocaleTimeString(),
    };
  }

  /**
   * POST /water/predict
   */
  async predictWater(
    data: WaterPredictPayload,
    language: 'kn' | 'hi' = 'kn'
  ): Promise<WaterPredictResult> {
    const endpoint = this.baseUrl.endsWith('/api')
      ? `${this.baseUrl}/water/predict?language=${language}`
      : `${this.baseUrl}/water/predict?language=${language}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.detail) {
            errorDetail = typeof errJson.detail === 'string'
              ? errJson.detail
              : JSON.stringify(errJson.detail);
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(`Water prediction failed: ${errorDetail}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(
          `Backend connection refused at ${this.baseUrl}. Please verify your FastAPI server is running on ${this.baseUrl} or adjust the backend URL in Settings.`
        );
      }
      throw err;
    }
  }

  /**
   * POST /disease/predict (multipart/form-data with file)
   */
  async predictDisease(
    file: File | Blob,
    farmId: string = 'farm_001',
    species: string = '',
    language: 'kn' | 'hi' = 'kn'
  ): Promise<DiseasePredictResult> {
    const endpoint = this.baseUrl.endsWith('/api')
      ? `${this.baseUrl}/disease/predict?language=${language}`
      : `${this.baseUrl}/disease/predict?language=${language}`;

    const formData = new FormData();
    formData.append('file', file, (file as File).name || 'specimen.jpg');
    formData.append('farm_id', farmId);
    if (species) {
      formData.append('species', species);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.detail) {
            errorDetail = typeof errJson.detail === 'string'
              ? errJson.detail
              : JSON.stringify(errJson.detail);
          }
        } catch {
          // ignore
        }
        throw new Error(`Disease model prediction failed: ${errorDetail}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(
          `Backend connection refused at ${this.baseUrl}. Please verify your FastAPI server is running on ${this.baseUrl} or adjust the backend URL in Settings.`
        );
      }
      throw err;
    }
  }

  /**
   * GET /alerts
   */
  async getAlerts(farmId?: string, limit: number = 50): Promise<{ count: number; alerts: ApiAlert[] }> {
    const query = new URLSearchParams();
    if (farmId) query.set('farm_id', farmId);
    query.set('limit', String(limit));

    const endpoint = `${this.baseUrl}/alerts?${query.toString()}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to load alerts: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`Backend unavailable at ${this.baseUrl}`);
      }
      throw err;
    }
  }

  /**
   * POST /replay
   */
  async replayTelemetry(
    farmId: string = 'farm_001',
    language: 'kn' | 'hi' = 'kn'
  ): Promise<ReplayResult> {
    const endpoint = `${this.baseUrl}/replay`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          farm_id: farmId,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error(`Replay failed: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`Backend connection refused at ${this.baseUrl}`);
      }
      throw err;
    }
  }

  /**
   * GET /readings (Historical sensor telemetry from SQLite)
   */
  async getReadings(farmId?: string, limit: number = 24): Promise<{ count: number; readings: TelemetryReading[] }> {
    const query = new URLSearchParams();
    if (farmId) query.set('farm_id', farmId);
    query.set('limit', String(limit));

    const endpoint = `${this.baseUrl}/readings?${query.toString()}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to load readings: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`Backend unavailable at ${this.baseUrl}`);
      }
      throw err;
    }
  }
}

export const api = new AquacultureApiClient();

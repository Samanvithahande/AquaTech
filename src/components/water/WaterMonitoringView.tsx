import React, { useState, useEffect } from 'react';
import { 
  Droplets, 
  Thermometer, 
  Activity, 
  FlaskConical, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Clock, 
  Layers,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Play,
  Languages,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { Pond, WaterAssessment, WaterParameter, ApiAlert } from '../../types/aquaculture';
import { 
  DEFAULT_PARAMETERS, 
  HOURLY_WATER_METRICS, 
  SAFE_ASSESSMENT_SAMPLE 
} from '../../lib/mockData';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';

interface WaterMonitoringViewProps {
  selectedPond: Pond;
  currentLanguage: 'kn' | 'hi' | 'en';
  onAlertGenerated?: (alert: ApiAlert) => void;
}

export const WaterMonitoringView: React.FC<WaterMonitoringViewProps> = ({
  selectedPond,
  currentLanguage,
  onAlertGenerated,
}) => {
  // Configurable sensor input values
  const [phInput, setPhInput] = useState<number>(7.4);
  const [doInput, setDoInput] = useState<number>(6.5);
  const [tempInput, setTempInput] = useState<number>(27.8);
  const [ammoniaInput, setAmmoniaInput] = useState<number>(0.02);
  const [speciesSelect, setSpeciesSelect] = useState<'carp' | 'shrimp' | 'tilapia'>(
    (selectedPond.species as any) || 'tilapia'
  );

  // Assessment state
  const [currentAssessment, setCurrentAssessment] = useState<WaterAssessment>(SAFE_ASSESSMENT_SAMPLE);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [latestAlert, setLatestAlert] = useState<ApiAlert | null>(null);

  const [selectedChartParam, setSelectedChartParam] = useState<'all' | 'do' | 'ph' | 'temp' | 'ammonia'>('all');
  const [detailModalAssessment, setDetailModalAssessment] = useState<WaterAssessment | null>(null);
  const [historyList, setHistoryList] = useState<WaterAssessment[]>([SAFE_ASSESSMENT_SAMPLE]);

  // Dynamic Telemetry Data for Recharts
  const [telemetryHistory, setTelemetryHistory] = useState<Array<{
    time: string;
    ph: number;
    do: number;
    temp: number;
    ammonia: number;
    label?: string;
  }>>(() => {
    return HOURLY_WATER_METRICS.map((m) => ({
      time: m.time,
      ph: m.ph,
      do: m.do,
      temp: m.temp,
      ammonia: m.ammonia,
      label: 'Baseline',
    }));
  });
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);

  // Fetch real sensor telemetry readings from backend SQLite database
  const fetchTelemetryReadings = async () => {
    setIsLoadingTelemetry(true);
    try {
      const res = await api.getReadings(selectedPond.id, 24);
      if (res.readings && res.readings.length > 0) {
        const points = res.readings.map((r) => {
          let timeLabel = r.created_at;
          try {
            const d = new Date(r.created_at);
            timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch {
            // fallback to raw string
          }
          return {
            time: timeLabel,
            ph: r.ph,
            do: r.dissolved_oxygen,
            temp: r.temperature,
            ammonia: r.ammonia,
            label: (r.risk_level || 'SAFE').toUpperCase(),
          };
        });
        setTelemetryHistory(points);
      }
    } catch {
      // Backend may be offline; keep initialized state
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    fetchTelemetryReadings();
  }, [selectedPond.id]);

  // Dynamic parameters
  const parameters: WaterParameter[] = [
    {
      id: 'param-ph',
      name: 'pH Index',
      key: 'ph',
      value: phInput,
      unit: 'pH',
      status: phInput >= 6.5 && phInput <= 8.5 ? 'SAFE' : 'UNSAFE',
      optimalRange: '6.5 – 8.5',
    },
    {
      id: 'param-do',
      name: 'Dissolved Oxygen (DO)',
      key: 'do',
      value: doInput,
      unit: 'mg/L',
      status: doInput >= 5.0 ? 'SAFE' : 'UNSAFE',
      optimalRange: '> 5.0 mg/L',
    },
    {
      id: 'param-temp',
      name: 'Water Temperature',
      key: 'temp',
      value: tempInput,
      unit: '°C',
      status: tempInput >= 22 && tempInput <= 31 ? 'SAFE' : 'UNSAFE',
      optimalRange: '25.0 – 30.0 °C',
    },
    {
      id: 'param-ammonia',
      name: 'Ammonia (NH3)',
      key: 'ammonia',
      value: ammoniaInput,
      unit: 'mg/L',
      status: ammoniaInput <= 0.05 ? 'SAFE' : 'UNSAFE',
      optimalRange: '< 0.05 mg/L',
    },
  ];

  // Quick preset loader to help farmer test scenarios
  const setSafePreset = () => {
    setPhInput(7.5);
    setDoInput(6.8);
    setTempInput(27.5);
    setAmmoniaInput(0.02);
  };

  const setUnsafePreset = () => {
    setPhInput(8.9);
    setDoInput(3.1);
    setTempInput(31.8);
    setAmmoniaInput(0.09);
  };

  // Run Real Prediction against POST /water/predict
  const handleRunAssessment = async () => {
    setIsAssessing(true);
    setApiError(null);

    const lang = currentLanguage === 'hi' ? 'hi' : 'kn';

    try {
      const response = await api.predictWater(
        {
          farm_id: selectedPond.id,
          ph: phInput,
          temperature: tempInput,
          dissolved_oxygen: doInput,
          ammonia: ammoniaInput,
          species: speciesSelect,
        },
        lang
      );

      const pred = response.prediction;
      const isUnsafe = pred.risk_level === 'high';
      const isWatch = pred.risk_level === 'medium';
      const statusText: 'SAFE' | 'UNSAFE' = isUnsafe ? 'UNSAFE' : isWatch ? 'UNSAFE' : 'SAFE';

      const assessmentRecord: WaterAssessment = {
        id: `wa-${Date.now()}`,
        pondId: selectedPond.id,
        pondName: selectedPond.name,
        status: statusText,
        riskLevel: (pred.risk_level as any) || 'low',
        riskScore: pred.risk_score,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        readings: {
          ph: phInput,
          do: doInput,
          temp: tempInput,
          ammonia: ammoniaInput,
          species: speciesSelect,
        },
        reasons: pred.reason ? pred.reason.split('; ') : ['Normal water telemetry parameters'],
        recommendations: [pred.recommended_action],
        alert: response.alert,
        rawResponse: response,
      };

      setCurrentAssessment(assessmentRecord);
      setLatestAlert(response.alert);
      setHistoryList((prev) => [assessmentRecord, ...prev]);

      // Connect new assessment point to telemetry graph
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTelemetryHistory((prev) => [
        ...prev.slice(-23),
        {
          time: nowTime,
          ph: phInput,
          do: doInput,
          temp: tempInput,
          ammonia: ammoniaInput,
          label: statusText,
        },
      ]);

      if (response.alert && onAlertGenerated) {
        onAlertGenerated(response.alert);
      }
    } catch (err: any) {
      setApiError(err.message || 'Water prediction failed');
    } finally {
      setIsAssessing(false);
    }
  };

  // Run Real Replay against POST /replay
  const handleRunReplay = async () => {
    setIsReplaying(true);
    setApiError(null);

    const lang = currentLanguage === 'hi' ? 'hi' : 'kn';

    try {
      const replayRes = await api.replayTelemetry(selectedPond.id, lang);
      if (replayRes.results && replayRes.results.length > 0) {
        const item = replayRes.results[0];
        const pred = item.prediction;

        // Populate form with replayed reading
        setPhInput(7.5);
        setDoInput(3.2);
        setTempInput(29.0);
        setAmmoniaInput(0.04);
        setSpeciesSelect('carp');

        const assessmentRecord: WaterAssessment = {
          id: `wa-replay-${Date.now()}`,
          pondId: selectedPond.id,
          pondName: selectedPond.name,
          status: pred.risk_level === 'high' ? 'UNSAFE' : 'SAFE',
          riskLevel: pred.risk_level || 'medium',
          riskScore: pred.risk_score,
          timestamp: `Replay Event (${new Date().toLocaleTimeString()})`,
          readings: {
            ph: 7.5,
            do: 3.2,
            temp: 29.0,
            ammonia: 0.04,
            species: 'carp',
          },
          reasons: pred.reason ? pred.reason.split('; ') : ['Replayed real pond historical readings'],
          recommendations: [pred.recommended_action],
          alert: item.alert,
          rawResponse: replayRes,
        };

        setCurrentAssessment(assessmentRecord);
        setLatestAlert(item.alert);
        setHistoryList((prev) => [assessmentRecord, ...prev]);

        // Connect simulated replay point to telemetry graph
        const replayTime = `Replay (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        setTelemetryHistory((prev) => [
          ...prev.slice(-23),
          {
            time: replayTime,
            ph: 7.5,
            do: 3.2,
            temp: 29.0,
            ammonia: 0.04,
            label: 'Replay (Unsafe)',
          },
        ]);

        if (item.alert && onAlertGenerated) {
          onAlertGenerated(item.alert);
        }
      }
    } catch (err: any) {
      setApiError(err.message || 'Replay failed');
    } finally {
      setIsReplaying(false);
    }
  };

  const getParamIcon = (key: string) => {
    switch (key) {
      case 'ph':
        return <FlaskConical className="w-5 h-5 text-teal-600" />;
      case 'do':
        return <Droplets className="w-5 h-5 text-sky-600" />;
      case 'temp':
        return <Thermometer className="w-5 h-5 text-amber-600" />;
      case 'ammonia':
        return <Activity className="w-5 h-5 text-indigo-600" />;
      default:
        return <Droplets className="w-5 h-5" />;
    }
  };

  const isSafe = currentAssessment.riskLevel === 'low';
  const isWatch = currentAssessment.riskLevel === 'medium';
  const isCritical = currentAssessment.riskLevel === 'high';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* A. Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wide">
            <span>Aquaculture Water Quality · ML Random Forest</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Pond Water Monitoring &amp; Alerts
          </h1>
          <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
            Live telemetry risk prediction via Random Forest and species biological thresholds with multilingual alert dispatch.
          </p>
        </div>

        {/* Quick Scenario Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={setSafePreset}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
          >
            Safe Preset
          </button>
          <button
            type="button"
            onClick={setUnsafePreset}
            className="px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer"
          >
            Critical Hypoxia Preset
          </button>
        </div>
      </div>

      {/* API Error Notification */}
      {apiError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">FastAPI Connection Note:</span>
            <p>{apiError}</p>
            <p className="text-[11px] text-red-700">
              Ensure your backend is running with <code className="bg-red-100 px-1 py-0.5 rounded font-mono">uvicorn main:app --port 8000</code> or check the backend URL in Settings.
            </p>
          </div>
        </div>
      )}

      {/* B. Interactive Sensor Inputs & Parameter Cards */}
      <section aria-labelledby="parameters-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="parameters-heading" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-teal-600" />
            <span>Pond Telemetry Readings ({selectedPond.name})</span>
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-500 font-semibold">Species Profile:</label>
            <select
              value={speciesSelect}
              onChange={(e) => setSpeciesSelect(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-medium capitalize"
            >
              <option value="carp">Carp (Freshwater)</option>
              <option value="tilapia">Tilapia</option>
              <option value="shrimp">Shrimp / Prawn</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: pH */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  pH Index
                </span>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <FlaskConical className="w-5 h-5 text-teal-600" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  value={phInput}
                  onChange={(e) => setPhInput(parseFloat(e.target.value) || 0)}
                  className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none"
                />
                <span className="text-sm font-semibold text-slate-500">pH</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Target: 6.5 – 8.5</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                    phInput >= 6.5 && phInput <= 8.5
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {phInput >= 6.5 && phInput <= 8.5 ? 'SAFE' : 'ALERT'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: DO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Dissolved Oxygen
                </span>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <Droplets className="w-5 h-5 text-sky-600" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={doInput}
                  onChange={(e) => setDoInput(parseFloat(e.target.value) || 0)}
                  className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none"
                />
                <span className="text-sm font-semibold text-slate-500">mg/L</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Target: &gt; 5.0 mg/L</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                    doInput >= 5.0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {doInput >= 5.0 ? 'SAFE' : 'HYPOXIA'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Temperature */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Temperature
                </span>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <Thermometer className="w-5 h-5 text-amber-600" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  max="45"
                  value={tempInput}
                  onChange={(e) => setTempInput(parseFloat(e.target.value) || 0)}
                  className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none"
                />
                <span className="text-sm font-semibold text-slate-500">°C</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Optimal: 25 – 30 °C</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                    tempInput >= 22 && tempInput <= 31
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {tempInput >= 22 && tempInput <= 31 ? 'SAFE' : 'STRESS'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Ammonia */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Total Ammonia
                </span>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <Activity className="w-5 h-5 text-indigo-600" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="2"
                  value={ammoniaInput}
                  onChange={(e) => setAmmoniaInput(parseFloat(e.target.value) || 0)}
                  className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-sm font-semibold text-slate-500">mg/L</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Limit: &lt; 0.05 mg/L</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                    ammoniaInput <= 0.05
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {ammoniaInput <= 0.05 ? 'SAFE' : 'TOXIC'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. Water Quality Assessment Panel */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                ML Inference Engine
              </span>
              <span className="text-[11px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-medium border border-teal-200">
                Random Forest Telemetry Classifier
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Live Model Assessment
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Timestamp: {currentAssessment.timestamp} · Evaluated on {currentAssessment.pondName} ({speciesSelect.toUpperCase()})
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleRunReplay}
              disabled={isReplaying || isAssessing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              title="Simulate historical telemetry reading"
            >
              <Play className={`w-3.5 h-3.5 ${isReplaying ? 'animate-pulse' : ''}`} />
              <span>{isReplaying ? 'Simulating...' : 'Simulate Risk Event'}</span>
            </button>

            <button
              onClick={handleRunAssessment}
              disabled={isAssessing || isReplaying}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 shadow-xs transition-colors cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isAssessing ? 'animate-spin' : ''}`} />
              <span>{isAssessing ? 'Evaluating Model...' : 'Predict Water Quality Risk'}</span>
            </button>
          </div>
        </div>

        {/* Assessment Status Display */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Status Display Card */}
          <div
            className={`lg:col-span-4 rounded-xl p-6 border flex flex-col justify-between space-y-4 ${
              isSafe
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : isWatch
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-red-50/70 border-red-200 text-red-950'
            }`}
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">
                Model Risk Assessment
              </span>
              <div className="flex items-center gap-3 mt-2">
                {isSafe ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-700 shrink-0" />
                ) : isWatch ? (
                  <AlertTriangle className="w-8 h-8 text-amber-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-700 shrink-0" />
                )}
                <div>
                  <span
                    className={`text-2xl font-extrabold uppercase tracking-tight block ${
                      isSafe ? 'text-emerald-800' : isWatch ? 'text-amber-800' : 'text-red-700'
                    }`}
                  >
                    {currentAssessment.riskLevel.toUpperCase()} RISK
                  </span>
                  <span className="text-[11px] font-mono opacity-80">
                    Status: {currentAssessment.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Probability Score */}
            {currentAssessment.riskScore !== null && currentAssessment.riskScore !== undefined && (
              <div className="text-xs space-y-1">
                <div className="flex justify-between font-mono">
                  <span>Model Risk Score:</span>
                  <span className="font-bold">{(currentAssessment.riskScore * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      isSafe ? 'bg-emerald-600' : isWatch ? 'bg-amber-500' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(currentAssessment.riskScore * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 pt-2 border-t border-slate-200/50 text-xs">
              <span className="font-semibold block text-slate-700">Snapshot Input:</span>
              <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-800">
                <div>DO: {currentAssessment.readings.do} mg/L</div>
                <div>pH: {currentAssessment.readings.ph}</div>
                <div>Temp: {currentAssessment.readings.temp}°C</div>
                <div>NH3: {currentAssessment.readings.ammonia} mg/L</div>
              </div>
            </div>
          </div>

          {/* Reasons & Prescribed Actions */}
          <div className="lg:col-span-8 space-y-5">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Model Reasons &amp; Threshold Findings
              </h3>
              <ul className="mt-2.5 space-y-2">
                {currentAssessment.reasons.map((reason, index) => (
                  <li key={index} className="text-xs text-slate-700 flex items-start gap-2.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        isSafe ? 'bg-emerald-600' : isWatch ? 'bg-amber-500' : 'bg-red-600'
                      }`}
                    />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recommended Aquaculture Actions
              </h3>
              <ul className="mt-2 space-y-1.5">
                {currentAssessment.recommendations.map((rec, index) => (
                  <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Generated Multilingual Alert Box (Requirement: Display Kannada/Hindi & English) */}
            {latestAlert && (
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold tracking-wide uppercase text-amber-300">
                      Dispatched Multilingual Alert
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {latestAlert.alert_id.slice(0, 8)}...
                  </span>
                </div>

                {/* Multilingual message cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] font-semibold text-teal-400 block mb-1">
                      English Alert:
                    </span>
                    <p className="font-medium text-slate-100">{latestAlert.message.en}</p>
                  </div>

                  <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] font-semibold text-teal-400 block mb-1">
                      {currentLanguage === 'hi' ? 'Hindi Alert (हिंदी):' : 'Kannada Alert (ಕನ್ನಡ):'}
                    </span>
                    <p className="font-medium text-slate-100 font-sans">
                      {latestAlert.message[currentLanguage === 'hi' ? 'hi' : 'kn'] || latestAlert.message.en}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* D. 24-Hour Parameter Trends */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              24-Hour Parameter Trends
            </h2>
            <p className="text-xs text-slate-500">
              Diurnal cycle simulation for dissolved oxygen, pH, and temperature.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setSelectedChartParam('all')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                selectedChartParam === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Metrics
            </button>
            <button
              onClick={() => setSelectedChartParam('do')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                selectedChartParam === 'do'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              DO (mg/L)
            </button>
            <button
              onClick={() => setSelectedChartParam('ph')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                selectedChartParam === 'ph'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              pH
            </button>
            <button
              onClick={() => setSelectedChartParam('temp')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                selectedChartParam === 'temp'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Temp (°C)
            </button>
            <button
              onClick={() => setSelectedChartParam('ammonia')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                selectedChartParam === 'ammonia'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ammonia (mg/L)
            </button>
            <button
              onClick={fetchTelemetryReadings}
              disabled={isLoadingTelemetry}
              className="p-1 rounded text-slate-500 hover:text-teal-700 hover:bg-slate-200 transition-colors cursor-pointer ml-1"
              title="Sync latest readings from database"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingTelemetry ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          </div>
        </div>

        <div className="w-full h-72 sm:h-80 pt-2">
          {telemetryHistory.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs gap-2">
              <Activity className="w-6 h-6 text-slate-300" />
              <span>No telemetry readings recorded yet for this pond.</span>
              <span className="text-[11px] text-slate-400">Run an assessment above to plot real sensor telemetry.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={telemetryHistory}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {(selectedChartParam === 'all' || selectedChartParam === 'do') && (
                  <Line
                    type="monotone"
                    dataKey="do"
                    name="Dissolved Oxygen (mg/L)"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {(selectedChartParam === 'all' || selectedChartParam === 'ph') && (
                  <Line
                    type="monotone"
                    dataKey="ph"
                    name="pH Index"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
                {(selectedChartParam === 'all' || selectedChartParam === 'temp') && (
                  <Line
                    type="monotone"
                    dataKey="temp"
                    name="Temperature (°C)"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
                {(selectedChartParam === 'all' || selectedChartParam === 'ammonia') && (
                  <Line
                    type="monotone"
                    dataKey="ammonia"
                    name="Ammonia NH3 (mg/L)"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Historical Table */}
        <div className="pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Live Assessment History ({historyList.length})
            </h3>
            <span className="text-xs text-slate-400">
              Pond: {selectedPond.name}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Risk Level</th>
                  <th className="py-2.5 px-3">Readings Snapshot</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-700">{row.timestamp}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] border uppercase ${
                          row.riskLevel === 'low'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : row.riskLevel === 'medium'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                      >
                        {row.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      DO: {row.readings.do} · pH: {row.readings.ph} · {row.readings.temp}°C · NH3: {row.readings.ammonia}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setDetailModalAssessment(row)}
                        className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 font-semibold hover:underline cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Details Modal */}
      {detailModalAssessment && (
        <Modal
          isOpen={!!detailModalAssessment}
          onClose={() => setDetailModalAssessment(null)}
          title={`Water Assessment Record — ${detailModalAssessment.pondName}`}
          subtitle={`Recorded on ${detailModalAssessment.timestamp}`}
        >
          <div className="space-y-5 text-xs">
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                detailModalAssessment.riskLevel === 'low'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : detailModalAssessment.riskLevel === 'medium'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-red-50 border-red-200 text-red-950'
              }`}
            >
              <div>
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-slate-600">
                  Risk Level
                </span>
                <span className="text-xl font-bold uppercase">{detailModalAssessment.riskLevel}</span>
              </div>
              <div className="text-right font-mono text-[11px] space-y-0.5">
                <div>DO: {detailModalAssessment.readings.do} mg/L</div>
                <div>pH: {detailModalAssessment.readings.ph}</div>
                <div>Temp: {detailModalAssessment.readings.temp}°C</div>
                <div>NH3: {detailModalAssessment.readings.ammonia} mg/L</div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Biological Factors
              </h4>
              <ul className="space-y-1.5 text-slate-700">
                {detailModalAssessment.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Recommended Actions
              </h4>
              <ul className="space-y-1.5 text-slate-600">
                {detailModalAssessment.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setDetailModalAssessment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

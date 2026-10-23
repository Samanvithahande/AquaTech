import React, { useState } from 'react';
import { 
  User, 
  Building, 
  Bell, 
  Palette, 
  Info, 
  Save, 
  Check, 
  ShieldCheck, 
  Globe, 
  Server, 
  RefreshCw, 
  ExternalLink
} from 'lucide-react';
import { FarmSettings, BackendStatus } from '../../types/aquaculture';
import { api } from '../../lib/api';

interface SettingsViewProps {
  settings: FarmSettings;
  onUpdateSettings: (newSettings: FarmSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [farmerName, setFarmerName] = useState(settings.farmerName);
  const [phone, setPhone] = useState(settings.phone);
  const [farmName, setFarmName] = useState(settings.farmName);
  const [location, setLocation] = useState(settings.location);
  const [language, setLanguage] = useState<'kn' | 'hi' | 'en'>(settings.language || 'kn');
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl || api.getBaseUrl());
  const [theme, setTheme] = useState(settings.theme);

  const [waterQualityAlerts, setWaterQualityAlerts] = useState(settings.notifications.waterQualityAlerts);
  const [diseaseDetectionAlerts, setDiseaseDetectionAlerts] = useState(settings.notifications.diseaseDetectionAlerts);
  const [generalAnnouncements, setGeneralAnnouncements] = useState(settings.notifications.generalAnnouncements);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<BackendStatus | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    api.setBaseUrl(backendUrl);
    try {
      const res = await api.checkHealth();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: 'offline',
        url: backendUrl,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    api.setBaseUrl(backendUrl);

    const updated: FarmSettings = {
      farmerName,
      phone,
      farmName,
      location,
      ponds: settings.ponds,
      notifications: {
        waterQualityAlerts,
        diseaseDetectionAlerts,
        generalAnnouncements,
      },
      theme,
      language,
      backendUrl,
    };
    onUpdateSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Farm Settings &amp; Preferences
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Configure alert language, farmer profile, farm details, and telemetry notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved Successfully</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-8">
        {/* 1. Network & API Connection */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900">Network &amp; API Connection</h2>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Backend API Base URL
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="e.g. http://localhost:8000 or /api"
                  className="flex-1 text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {/* Quick URL Presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
              <span className="text-slate-400 font-semibold">Presets:</span>
              <button
                type="button"
                onClick={() => setBackendUrl('http://localhost:8000')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[11px] border border-slate-200 cursor-pointer"
              >
                http://localhost:8000 (Local Windows FastAPI)
              </button>
              <button
                type="button"
                onClick={() => setBackendUrl('/api')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[11px] border border-slate-200 cursor-pointer"
              >
                /api (Built-in Server Proxy)
              </button>
            </div>

            {/* Test Result Display */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  testResult.status === 'online'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-red-50 border-red-200 text-red-950'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {testResult.status === 'online' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Info className="w-4 h-4 text-red-600" />
                  )}
                  <span>
                    {testResult.status === 'online'
                      ? 'Backend Connection Successful!'
                      : 'Backend Unreachable'}
                  </span>
                </div>
                <p className="text-[11px]">{testResult.message}</p>
              </div>
            )}
          </div>
        </section>

        {/* 2. Language & Alert Localization */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Globe className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Alert Language &amp; Localization</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'kn' as const, label: 'ಕನ್ನಡ (Kannada)', desc: 'Primary language for Karnataka aquaculture belts' },
              { id: 'hi' as const, label: 'हिंदी (Hindi)', desc: 'National language option for North & Central regions' },
              { id: 'en' as const, label: 'English', desc: 'Commercial aquaculture telemetry standard' },
            ].map((item) => (
              <label
                key={item.id}
                onClick={() => setLanguage(item.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex flex-col justify-between ${
                  language === item.id
                    ? 'bg-teal-50 border-teal-400 text-teal-950 font-semibold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <span className="text-sm block">{item.label}</span>
                  <span className="text-[11px] font-normal text-slate-500 mt-1 block">
                    {item.desc}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-teal-800">
                  <input
                    type="radio"
                    name="alertLanguage"
                    checked={language === item.id}
                    onChange={() => setLanguage(item.id)}
                    className="text-teal-600"
                  />
                  <span>Selected</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* 3. Farmer Profile Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Farmer Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Farmer Full Name
              </label>
              <input
                type="text"
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Mobile Phone (SMS Alerts)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>
        </section>

        {/* 4. Farm and Pond Information */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Farm Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Aquaculture Farm Name
              </label>
              <input
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Farm Location / Delta
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </section>

        {/* 5. Notification Preferences */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Notification Triggers</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Water-Quality Hypoxia &amp; Ammonia Alerts
                </span>
                <span className="text-[11px] text-slate-500">
                  Trigger alerts when dissolved oxygen falls below species minimum or ammonia exceeds threshold.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWaterQualityAlerts(!waterQualityAlerts)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  waterQualityAlerts ? 'bg-teal-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    waterQualityAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Disease-Detection Alerts
                </span>
                <span className="text-[11px] text-slate-500">
                  Notify on confirmed high-risk lesions or Keras neural network pathogen predictions.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDiseaseDetectionAlerts(!diseaseDetectionAlerts)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  diseaseDetectionAlerts ? 'bg-teal-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    diseaseDetectionAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
};

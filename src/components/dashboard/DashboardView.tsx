import React, { useState, useEffect } from 'react';
import { 
  Droplets, 
  Microscope, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Sparkles,
  Info,
  ShieldAlert,
  Languages,
  RotateCw,
  Bell
} from 'lucide-react';
import { PageRoute, RecentReport, ApiAlert } from '../../types/aquaculture';
import { SAMPLE_IMAGES } from '../../lib/mockData';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import { NotificationPermissionBanner } from '../common/NotificationPermissionBanner';
import { notificationService } from '../../lib/notifications';

interface DashboardViewProps {
  onNavigate: (page: PageRoute) => void;
  recentReports: RecentReport[];
  currentLanguage: 'kn' | 'hi' | 'en';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  recentReports,
  currentLanguage,
}) => {
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'Water Quality' | 'Disease Detection'>('ALL');
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<ApiAlert | null>(null);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const fetchAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const res = await api.getAlerts(undefined, 20);
      const fetchedAlerts = res.alerts || [];
      setAlerts(fetchedAlerts);

      // Check for any unnotified high or medium risk alerts and trigger browser notification
      for (const al of fetchedAlerts) {
        if (al.risk_level === 'high' || al.risk_level === 'medium') {
          notificationService.notifyAlert(al, currentLanguage);
        }
      }
    } catch {
      // Backend may be offline; fallback to session alerts
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [currentLanguage]);

  const handleWaterCardClick = () => {
    onNavigate('water-monitoring');
  };

  const handleDiseaseCardClick = () => {
    onNavigate('disease-detection');
  };

  const filteredHistory = recentReports.filter((r) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'Water Quality') return r.type.includes('Water');
    if (filterType === 'Disease Detection') return r.type.includes('Disease');
    return true;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* A. Welcome Banner */}
      <section className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none hidden sm:block">
          <img
            src={SAMPLE_IMAGES.farmPond}
            alt="Aquaculture farm ponds"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-teal-300">
            <span>{currentDate}</span>
            <span aria-hidden="true">·</span>
            <span>Commercial Aquaculture Telemetry &amp; Alerts</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, Aquaculture Farmer
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Real-time pond monitoring and biological risk assessments. Keep dissolved oxygen and water chemistry safe, and analyze specimen health.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">4 Active Ponds</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/10">
              <Bell className="w-3.5 h-3.5 text-teal-300" />
              <span className="font-semibold text-white">{alerts.length} System Alerts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Browser Notification Status & Permission Banner */}
      <section aria-label="Notification Status">
        <NotificationPermissionBanner currentLanguage={currentLanguage} />
      </section>

      {/* B. Two Main Feature Cards */}
      <section aria-labelledby="feature-cards-heading">
        <h2 id="feature-cards-heading" className="sr-only">
          Main Aquaculture Operations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Pond Monitoring */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleWaterCardClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleWaterCardClick();
              }
            }}
            className="group relative bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-lg hover:border-teal-500 transition-all duration-200 cursor-pointer flex flex-col justify-between focus:outline-none"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 group-hover:scale-105 group-hover:bg-teal-600 group-hover:text-white transition-all duration-200">
                  <Droplets className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Real-Time Sensing
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                  Pond Water Monitoring
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Evaluate dissolved oxygen, pH, temperature, and ammonia against species thresholds and Random Forest classification.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Telemetry Standard</span>
                  <span className="font-semibold text-slate-800">FWI India Pond Data</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Scenario Analysis</span>
                  <span className="font-semibold text-teal-700">Simulation Ready</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Pond Status: <span className="text-emerald-700 font-semibold">Active &amp; Monitored</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWaterCardClick();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Assess Water Quality</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card 2: Fish Disease Detection */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleDiseaseCardClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleDiseaseCardClick();
              }
            }}
            className="group relative bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-lg hover:border-teal-500 transition-all duration-200 cursor-pointer flex flex-col justify-between focus:outline-none"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 group-hover:scale-105 group-hover:bg-cyan-700 group-hover:text-white transition-all duration-200">
                  <Microscope className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                  Visual AI Diagnosis
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-cyan-800 transition-colors">
                  Fish Disease Detection
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Upload specimen photographs for deep learning diagnosis covering finfish, shrimp (WSSV, Black Gill), seaweed, and bivalves.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                <img
                  src={SAMPLE_IMAGES.healthyTilapia}
                  alt="Tilapia thumbnail"
                  className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 block truncate">Multi-Species Neural Models</span>
                  <span className="text-slate-500 text-[11px] block">Finfish · Shrimp · Seaweed · Bivalves</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Supports JPG, PNG &amp; WebP
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDiseaseCardClick();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Diagnose Specimen</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* C. Live Alerts from GET /alerts */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                Live Dispatched Alerts ({alerts.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multilingual alert notifications generated by the FastAPI backend (GET /alerts).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAlerts}
              disabled={isLoadingAlerts}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingAlerts ? 'animate-spin' : ''}`} />
              <span>Refresh Alerts</span>
            </button>
            <button
              onClick={() => setHistoryModalOpen(true)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 transition-colors cursor-pointer"
            >
              View Full Archive
            </button>
          </div>
        </div>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No critical alerts currently triggered. Run a water assessment or disease diagnosis above to generate alerts!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.slice(0, 5).map((al) => {
              const isHigh = al.risk_level === 'high';
              const localMsg = al.message[currentLanguage === 'hi' ? 'hi' : 'kn'] || al.message.en;

              return (
                <div
                  key={al.alert_id}
                  className="py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] border uppercase ${
                          isHigh
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {al.risk_level} Risk
                      </span>
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {al.type === 'water_quality' ? 'Water Quality' : 'Fish Disease'}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(al.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Bilingual Message Display */}
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold text-slate-900">{al.message.en}</p>
                      {currentLanguage !== 'en' && (
                        <p className="text-teal-900 font-medium text-[11px]">
                          {localMsg}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedAlertDetail(al)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition-colors cursor-pointer"
                    >
                      <span>Alert Details</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* D. Full Archive Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Aquaculture Alert & Assessment Archive"
        subtitle="Complete live and historical event log from backend"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              {(['ALL', 'Water Quality', 'Disease Detection'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
                    filterType === type
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'ALL' ? 'All Records' : type}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">
              Showing {filteredHistory.length} records
            </span>
          </div>

          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {filteredHistory.map((report) => {
              const isSafe = report.status === 'SAFE' || report.status === 'Healthy';
              return (
                <div
                  key={report.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{report.pondName}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-600">{report.type}</span>
                    </div>
                    <p className="text-slate-600">{report.summary}</p>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      Recorded: {report.timestamp}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        isSafe
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      {report.status}
                    </span>
                    <button
                      onClick={() => {
                        setHistoryModalOpen(false);
                        onNavigate(report.targetPage);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors cursor-pointer"
                    >
                      Go to Section
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Alert Detail Modal */}
      {selectedAlertDetail && (
        <Modal
          isOpen={!!selectedAlertDetail}
          onClose={() => setSelectedAlertDetail(null)}
          title={`Dispatched Alert — ${selectedAlertDetail.risk_level.toUpperCase()} Risk`}
          subtitle={`Alert ID: ${selectedAlertDetail.alert_id}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
              <div>
                <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider block mb-1">
                  English Alert Message:
                </span>
                <p className="text-sm font-bold text-white">{selectedAlertDetail.message.en}</p>
              </div>

              {selectedAlertDetail.message.kn && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider block mb-1">
                    Kannada Alert (ಕನ್ನಡ):
                  </span>
                  <p className="text-sm text-slate-200 font-sans">{selectedAlertDetail.message.kn}</p>
                </div>
              )}

              {selectedAlertDetail.message.hi && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider block mb-1">
                    Hindi Alert (हिंदी):
                  </span>
                  <p className="text-sm text-slate-200 font-sans">{selectedAlertDetail.message.hi}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                Prescribed Farm Action:
              </span>
              <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                {selectedAlertDetail.recommended_action}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-500 font-mono text-[11px] pt-1">
              <div>Farm ID: {selectedAlertDetail.farm_id}</div>
              <div>Created: {new Date(selectedAlertDetail.created_at).toLocaleString()}</div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedAlertDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Menu, 
  X, 
  Droplets, 
  LayoutDashboard, 
  Microscope, 
  Settings, 
  CheckCheck,
  Calendar,
  AlertCircle,
  Info,
  Globe,
  ShieldAlert
} from 'lucide-react';
import { PageRoute, ApiAlert } from '../../types/aquaculture';
import { api } from '../../lib/api';
import { NotificationPermissionBanner } from '../common/NotificationPermissionBanner';

interface NavbarProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  currentLanguage: 'kn' | 'hi' | 'en';
  onLanguageChange?: (lang: 'kn' | 'hi' | 'en') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  currentLanguage,
  onLanguageChange,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = async () => {
    try {
      const res = await api.getAlerts(undefined, 10);
      setAlerts(res.alerts || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close notifications if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pageTitles: Record<PageRoute, string> = {
    'dashboard': 'Dashboard',
    'water-monitoring': 'Pond Water Monitoring',
    'disease-detection': 'Disease Detection',
    'settings': 'Settings',
  };

  const navItems = [
    { id: 'dashboard' as PageRoute, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'water-monitoring' as PageRoute, label: 'Pond Monitoring', icon: Droplets },
    { id: 'disease-detection' as PageRoute, label: 'Disease Detection', icon: Microscope },
    { id: 'settings' as PageRoute, label: 'Settings', icon: Settings },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline text-slate-400 font-medium">AquaSentinel AI</span>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="font-semibold text-slate-800">{pageTitles[currentPage] || 'Overview'}</span>
          </div>
        </div>

        {/* Center/Right: Quick Info */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Multilingual Language Switch */}
          {onLanguageChange && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <button
                type="button"
                onClick={() => onLanguageChange('kn')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  currentLanguage === 'kn' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ಕನ್ನಡ
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('hi')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  currentLanguage === 'hi' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  currentLanguage === 'en' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>
          )}

          {/* Browser Notification Permission Button / Status */}
          <NotificationPermissionBanner currentLanguage={currentLanguage} compact={true} />

          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentDate}</span>
          </div>

          {/* Notifications Icon & Popover */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="View notifications"
              title="Dispatched alerts"
            >
              <Bell className="w-5 h-5" />
              {alerts.length > 0 && (
                <span className="absolute top-1 right-1 px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-bold ring-2 ring-white">
                  {alerts.length}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in duration-150">
                <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-slate-900">Live Backend Alerts</span>
                    <span className="text-[11px] bg-teal-100 text-teal-800 font-semibold px-1.5 py-0.5 rounded">
                      {alerts.length} total
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      fetchAlerts();
                      setNotificationsOpen(false);
                      onNavigate('dashboard');
                    }}
                    className="text-[11px] text-teal-700 hover:text-teal-800 font-semibold hover:underline cursor-pointer"
                  >
                    View in Dashboard
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No active alerts in history. Run a water prediction or fish disease analysis to see alerts.
                    </div>
                  ) : (
                    alerts.map((al) => {
                      const isHigh = al.risk_level === 'high';
                      const localMsg = al.message[currentLanguage === 'hi' ? 'hi' : 'kn'] || al.message.en;

                      return (
                        <div
                          key={al.alert_id}
                          className="p-3.5 text-xs hover:bg-slate-50/80 transition-colors space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isHigh ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {al.risk_level} Risk
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(al.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 leading-snug">
                            {al.message.en}
                          </p>
                          {currentLanguage !== 'en' && (
                            <p className="text-[11px] text-teal-800 font-medium">
                              {localMsg}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-500 pt-0.5">
                            Action: {al.recommended_action}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500">
                  Multilingual alerts generated by FastAPI (/alerts)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

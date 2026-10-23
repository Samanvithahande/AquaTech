import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { notificationService, NotificationPermissionState } from '../../lib/notifications';

interface NotificationPermissionBannerProps {
  currentLanguage: 'kn' | 'hi' | 'en';
  compact?: boolean;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  currentLanguage,
  compact = false,
}) => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const refreshState = () => {
    setPermission(notificationService.getPermissionState());
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    const result = await notificationService.requestPermission();
    setPermission(result);
    setIsRequesting(false);
  };

  const handleSendTest = async () => {
    const success = await notificationService.sendTestNotification(currentLanguage);
    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  if (compact) {
    if (permission === 'granted') {
      return (
        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
          <BellRing className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold">Browser Alerts Active</span>
          <button
            type="button"
            onClick={handleSendTest}
            className="text-[11px] font-semibold text-emerald-700 underline hover:text-emerald-900 cursor-pointer ml-1"
          >
            {testSent ? 'Sent!' : 'Test'}
          </button>
        </div>
      );
    }

    if (permission === 'denied') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-red-800 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
          <BellOff className="w-3.5 h-3.5 text-red-600" />
          <span className="font-semibold">Notifications Blocked</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={handleRequestPermission}
        disabled={isRequesting}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
      >
        <Bell className="w-3.5 h-3.5" />
        <span>{isRequesting ? 'Requesting...' : 'Enable Notifications'}</span>
      </button>
    );
  }

  // Full Dashboard Banner
  return (
    <div className="rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs">
      {/* 1. Granted State */}
      {permission === 'granted' && (
        <div className="bg-emerald-50/80 border-emerald-200 p-5 sm:p-6 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-900">
                  Real-Time Browser Notifications Enabled
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-200/80 text-emerald-900">
                  Active
                </span>
              </div>
              <p className="text-xs text-emerald-800/90 mt-0.5">
                You will receive immediate system notifications when FastAPI detects high or medium risk conditions (hypoxia, toxic ammonia, or specimen diseases) with Kannada/Hindi messages.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSendTest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>{testSent ? 'Test Alert Dispatched!' : 'Send Test Notification'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Default (Needs Permission) State */}
      {permission === 'default' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 p-5 sm:p-6 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-950">
                  Enable Browser Push &amp; Desktop Alerts
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-200 text-amber-900">
                  Action Recommended
                </span>
              </div>
              <p className="text-xs text-amber-900/90 max-w-2xl leading-relaxed">
                Allow notifications to receive immediate alerts on critical pond conditions (e.g. dissolved oxygen drop &lt; 3.0 mg/L) or positive fish pathology scans even when working in another window.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>{isRequesting ? 'Prompting Browser...' : 'Enable Notifications'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Denied / Blocked State */}
      {permission === 'denied' && (
        <div className="bg-red-50 border-red-200 p-5 sm:p-6 text-red-950 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-700 shrink-0 mt-0.5">
              <BellOff className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-900">
                  Browser Notifications Are Blocked
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-200 text-red-900">
                  Permissions Denied
                </span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed max-w-3xl">
                Your browser is currently blocking desktop notifications for this site. To receive critical aquaculture alerts:
              </p>
              <ol className="text-xs text-red-900/90 list-decimal list-inside space-y-0.5 pt-1 font-medium">
                <li>Click the <strong>Lock / View site information</strong> icon in your browser address bar.</li>
                <li>Find <strong>Notifications</strong> and change it from <em>Block</em> to <strong>Allow</strong>.</li>
                <li>Reload this page to activate live alerts.</li>
              </ol>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshState}
            className="px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors shrink-0 cursor-pointer self-start sm:self-center"
          >
            Check Again
          </button>
        </div>
      )}

      {/* 4. Unsupported State */}
      {permission === 'unsupported' && (
        <div className="bg-slate-100 border-slate-200 p-4 text-slate-800 flex items-center gap-3 text-xs">
          <Info className="w-5 h-5 text-slate-500 shrink-0" />
          <span>
            Desktop Notifications are not supported by this browser environment or iframe mode. Real-time alerts will still be logged to your on-screen alert history.
          </span>
        </div>
      )}
    </div>
  );
};

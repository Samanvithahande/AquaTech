import React, { useState, useEffect } from 'react';
import { PageRoute, Pond, FarmSettings, RecentReport, ApiAlert } from './types/aquaculture';
import { 
  DEFAULT_SETTINGS, 
  INITIAL_PONDS, 
  INITIAL_RECENT_REPORTS 
} from './lib/mockData';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { WaterMonitoringView } from './components/water/WaterMonitoringView';
import { DiseaseDetectionView } from './components/disease/DiseaseDetectionView';
import { SettingsView } from './components/settings/SettingsView';
import { notificationService } from './lib/notifications';

export default function App() {
  const getInitialPage = (): PageRoute => {
    if (typeof window === 'undefined') return 'dashboard';
    const path = window.location.pathname.replace(/^\/+/, '');
    if (path === 'water-monitoring') return 'water-monitoring';
    if (path === 'disease-detection') return 'disease-detection';
    if (path === 'settings') return 'settings';
    return 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState<PageRoute>(getInitialPage());

  // Farm and pond state
  const [ponds] = useState<Pond[]>(() => {
    try {
      const saved = localStorage.getItem('aquaguard_ponds');
      return saved ? JSON.parse(saved) : INITIAL_PONDS;
    } catch {
      return INITIAL_PONDS;
    }
  });

  const [selectedPond] = useState<Pond>(() => ponds[0] || INITIAL_PONDS[0]);

  // Settings state persisted in localStorage
  const [settings, setSettings] = useState<FarmSettings>(() => {
    try {
      const saved = localStorage.getItem('aquaguard_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [currentLanguage, setCurrentLanguage] = useState<'kn' | 'hi' | 'en'>(
    settings.language || 'kn'
  );

  // Recent reports state
  const [recentReports, setRecentReports] = useState<RecentReport[]>(INITIAL_RECENT_REPORTS);

  // Sync route with browser history
  const navigateTo = (page: PageRoute) => {
    setCurrentPage(page);
    try {
      const targetPath = page === 'dashboard' ? '/' : `/${page}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ page }, '', targetPath);
      }
    } catch {
      // In restricted iframe environments, pushState failure is safely caught
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getInitialPage());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleUpdateSettings = (newSettings: FarmSettings) => {
    setSettings(newSettings);
    setCurrentLanguage(newSettings.language);
    try {
      localStorage.setItem('aquaguard_settings', JSON.stringify(newSettings));
    } catch {
      // storage unavailable
    }
  };

  const handleAlertGenerated = (alert: ApiAlert) => {
    // Show browser notification if permissions are granted and risk is high/medium
    notificationService.notifyAlert(alert, currentLanguage);

    const newReport: RecentReport = {
      id: `rep-${Date.now()}`,
      timestamp: 'Just now',
      type: alert.type === 'water_quality' ? 'Water Quality Assessment' : 'Disease Detection',
      pondName: selectedPond.name,
      status: alert.risk_level === 'high' ? 'High Risk' : alert.risk_level === 'medium' ? 'Action Needed' : 'SAFE',
      summary: alert.message.en,
      targetPage: alert.type === 'water_quality' ? 'water-monitoring' : 'disease-detection',
      alert: alert,
    };
    setRecentReports((prev) => [newReport, ...prev]);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-900">
      {/* Desktop Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigateTo}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          currentPage={currentPage}
          onNavigate={navigateTo}
          currentLanguage={currentLanguage}
          onLanguageChange={(lang) => {
            setCurrentLanguage(lang);
            handleUpdateSettings({ ...settings, language: lang });
          }}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentPage === 'dashboard' && (
            <DashboardView
              onNavigate={navigateTo}
              recentReports={recentReports}
              currentLanguage={currentLanguage}
            />
          )}

          {currentPage === 'water-monitoring' && (
            <WaterMonitoringView
              selectedPond={selectedPond}
              currentLanguage={currentLanguage}
              onAlertGenerated={handleAlertGenerated}
            />
          )}

          {currentPage === 'disease-detection' && (
            <DiseaseDetectionView
              currentLanguage={currentLanguage}
              onAlertGenerated={handleAlertGenerated}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </main>
      </div>
    </div>
  );
}

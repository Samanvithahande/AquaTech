import React from 'react';
import { 
  LayoutDashboard, 
  Droplets, 
  Microscope, 
  Settings, 
  Waves, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { PageRoute } from '../../types/aquaculture';

interface SidebarProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    {
      id: 'dashboard' as PageRoute,
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'System overview & live alert logs',
    },
    {
      id: 'water-monitoring' as PageRoute,
      label: 'Pond Monitoring',
      icon: Droplets,
      description: 'Water quality telemetry & risk analysis',
    },
    {
      id: 'disease-detection' as PageRoute,
      label: 'Disease Detection',
      icon: Microscope,
      description: 'Specimen image pathology diagnosis',
    },
    {
      id: 'settings' as PageRoute,
      label: 'Settings',
      icon: Settings,
      description: 'Farm profile & notification config',
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
          <Waves className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            AquaSentinel <span className="text-teal-400 font-semibold text-xs tracking-normal">AI</span>
          </span>
          <span className="text-[11px] text-slate-400">Pond Intelligence Platform</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5" aria-label="Main Navigation">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {isActive ? (
                <ChevronRight className="w-4 h-4 text-teal-200 shrink-0" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-2 text-teal-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Automated Risk Engine</span>
        </div>
        <p className="text-slate-500">
          Kannada, Hindi &amp; English Telemetry
        </p>
      </div>
    </aside>
  );
};

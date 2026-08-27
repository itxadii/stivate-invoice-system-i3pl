import React from 'react';
import { LayoutDashboard, Truck, History, BarChart3, Settings, X } from 'lucide-react';
import { ThreeDBox } from './ThreeDBox';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onCloseMobile }) => {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'pipeline', name: 'Dispatch Pipeline', icon: Truck, shortcut: 'Ctrl+N' },
    { id: 'completed', name: 'Completed', icon: History, shortcut: 'Ctrl+H' },
    { id: 'reports', name: 'Reports', icon: BarChart3 },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const getBoxRotationDegrees = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 0;
      case 'pipeline':
      case 'new-dispatch':
        return 90;
      case 'completed':
        return 180;
      case 'reports':
        return 270;
      case 'settings':
        return 0;
      default:
        return 0;
    }
  };

  return (
    <aside className="w-64 bg-white text-slate-800 flex flex-col border-r border-slate-200 h-full select-none shrink-0 relative overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <img src="logo.png" alt="i3pl Logo" className="h-12 sm:h-14 w-auto object-contain" />
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Close Sidebar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-1 overflow-y-auto flex flex-col">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-bold transition-all duration-150 group cursor-pointer ${isActive
                    ? 'bg-[#4BB8FA] text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:bg-[#4BB8FA]/10 hover:text-slate-900'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-900'} />
                  <span>{item.name}</span>
                </div>
                {item.shortcut && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold hidden sm:inline-block ${isActive ? 'bg-slate-900/10 text-slate-800' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                    }`}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Real 3D Cardboard Box positioned in middle empty space */}
        <div className="my-auto py-6 flex items-center justify-center relative overflow-hidden select-none pointer-events-none">
          <ThreeDBox size={120} rotationY={getBoxRotationDegrees(activeTab)} activeTab={activeTab} />
        </div>
      </nav>

      <div className="p-4 border-t border-slate-100 flex flex-col items-center justify-center gap-1.5 select-none shrink-0">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest text-center">Powered By</span>
        <img src="stivate.png" alt="Stivate" className="h-16 sm:h-20 w-auto object-contain brightness-95 opacity-90 hover:opacity-100 transition-all duration-150" />
      </div>
    </aside>
  );
};

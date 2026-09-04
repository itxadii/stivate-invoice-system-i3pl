import React from 'react';
import { LayoutDashboard, Truck, History, BarChart3, Settings, X, PanelLeftClose } from 'lucide-react';
import { ThreeDBox } from './ThreeDBox';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse
}) => {
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
    <aside
      className={`bg-white text-slate-800 flex flex-col border-r border-slate-200 h-full select-none shrink-0 relative transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Header section with Logo & Toggle Button */}
      {!isCollapsed ? (
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <img src="logo.png" alt="i3pl Logo" className="h-12 sm:h-14 w-auto object-contain" />
          <div className="flex items-center gap-1.5">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Collapse Sidebar (Ctrl+B)"
                aria-label="Collapse Sidebar"
              >
                <PanelLeftClose size={32} className="stroke-[2]" />
              </button>
            )}
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
        </div>
      ) : (
        <div className="p-3.5 border-b border-slate-100 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center group"
            title="Click to Expand Sidebar (Ctrl+B)"
            aria-label="Expand Sidebar"
          >
            <img
              src="logo.png"
              alt="i3pl Logo"
              className="h-8 w-auto object-contain group-hover:scale-105 transition-transform"
            />
          </button>
        </div>
      )}

      <nav className="flex-1 px-2.5 sm:px-3 py-4 sm:py-6 space-y-1 overflow-y-auto flex flex-col">
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
                title={isCollapsed ? `${item.name}${item.shortcut ? ` (${item.shortcut})` : ''}` : undefined}
                className={`flex items-center ${isCollapsed
                    ? 'w-11 h-11 aspect-square rounded-xl justify-center mx-auto'
                    : 'w-full justify-between px-3.5 py-3 rounded-lg'
                  } text-sm font-bold transition-all duration-150 group cursor-pointer ${isActive
                    ? 'bg-[#4BB8FA] text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:bg-[#4BB8FA]/10 hover:text-slate-900'
                  }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Icon
                    size={isCollapsed ? 20 : 18}
                    className={isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-900'}
                  />
                  {!isCollapsed && <span>{item.name}</span>}
                </div>
                {!isCollapsed && item.shortcut && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold hidden sm:inline-block ${isActive ? 'bg-slate-900/10 text-slate-800' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                      }`}
                  >
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Real 3D Cardboard Box positioned in middle empty space */}
        {!isCollapsed && (
          <div className="my-auto py-6 flex items-center justify-center relative overflow-hidden select-none pointer-events-none transition-opacity duration-200">
            <ThreeDBox size={120} rotationY={getBoxRotationDegrees(activeTab)} activeTab={activeTab} />
          </div>
        )}
      </nav>

      <div
        className={`border-t border-slate-100 flex flex-col items-center justify-center gap-1.5 select-none shrink-0 ${isCollapsed ? 'p-2 py-3' : 'p-4'
          }`}
      >
        {!isCollapsed ? (
          <>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest text-center">Powered By</span>
            <img src="stivate.png" alt="Stivate" className="h-16 sm:h-20 w-auto object-contain brightness-95 opacity-90 hover:opacity-100 transition-all duration-150" />
          </>
        ) : (
          <div
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors"
            title="Powered by Stivate"
            onClick={onToggleCollapse}
          >
            S
          </div>
        )}
      </div>
    </aside>
  );
};

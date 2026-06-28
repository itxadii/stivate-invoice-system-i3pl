import React from 'react';
import { LayoutDashboard, Plus, History, BarChart3, Settings } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-dispatch', name: 'New Dispatch', icon: Plus, shortcut: 'Ctrl+N' },
    { id: 'history', name: 'Dispatch History', icon: History, shortcut: 'Ctrl+H' },
    { id: 'reports', name: 'Reports', icon: BarChart3 },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white text-slate-800 flex flex-col border-r border-slate-200 h-screen select-none">
      <div className="p-5 pl-6 border-b border-slate-100 flex items-center justify-start">
        <img src="logo.png" alt="i3pl Logo" className="h-14 w-auto object-contain" />
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-bold transition-all duration-150 group cursor-pointer ${
                isActive
                  ? 'bg-[#4BB8FA] text-slate-900'
                  : 'text-slate-500 hover:bg-[#4BB8FA]/10 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-900'} />
                <span>{item.name}</span>
              </div>
              {item.shortcut && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  isActive ? 'bg-slate-900/10 text-slate-800' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                }`}>
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2 select-none">
        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest whitespace-nowrap">Copyrighted by</span>
        <img src="stivate.png" alt="Stivate" className="h-[60px] w-auto object-contain brightness-95 opacity-65 hover:opacity-95 transition-all duration-150" />
      </div>
    </aside>
  );
};

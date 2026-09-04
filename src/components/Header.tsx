import React, { useEffect, useState } from 'react';
import { Database, Clock, WifiOff, Menu } from 'lucide-react';
import { databaseService } from '../services/ipc';

interface HeaderProps {
  title: string;
  companyName: string;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  companyName,
  onToggleMobileSidebar,
}) => {
  const [time, setTime] = useState<string>('');
  const [dbActive, setDbActive] = useState<boolean>(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkDb = async () => {
      try {
        await databaseService.getDashboardStats();
        setDbActive(true);
      } catch (err) {
        console.error('Database diagnostic check failed:', err);
        setDbActive(false);
      }
    };
    checkDb();
    const interval = setInterval(checkDb, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 h-16 px-3 sm:px-6 flex items-center justify-between select-none shrink-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Open Navigation"
          >
            <Menu size={22} />
          </button>
        )}
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 leading-none whitespace-nowrap truncate">{title}</h2>
        <div className="h-4 w-px bg-slate-200 hidden sm:block flex-shrink-0" />
        <span className="text-xs sm:text-sm font-semibold text-slate-500 hidden md:inline whitespace-nowrap truncate">{companyName}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {/* Offline indicator */}
        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 sm:px-3 rounded-full text-slate-600 border border-slate-200 text-xs font-semibold whitespace-nowrap">
          <WifiOff size={13} className="text-slate-500 flex-shrink-0" />
          <span className="hidden sm:inline">Local Mode</span>
        </div>

        {/* DB Connected status symbol */}
        <div 
          className={`p-1.5 sm:p-2 rounded-full border flex items-center justify-center transition-colors duration-250 ${
            dbActive 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
              : 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
          }`}
          title={dbActive ? 'Database: Active' : 'Database: Disconnected'}
        >
          <Database size={14} className={dbActive ? 'text-emerald-500' : 'text-rose-500'} />
        </div>

        {/* Time */}
        <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-sm font-mono bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 whitespace-nowrap">
          <Clock size={14} className="text-slate-400 flex-shrink-0" />
          <span>{time}</span>
        </div>
      </div>
    </header>
  );
};

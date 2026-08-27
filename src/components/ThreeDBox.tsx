import React from 'react';
import { LayoutDashboard, Truck, History, BarChart3, Settings, CheckSquare } from 'lucide-react';

interface ThreeDBoxProps {
  size?: number;
  rotationY?: number;
  activeTab?: string;
}

export const ThreeDBox: React.FC<ThreeDBoxProps> = ({ size = 125, rotationY = 0, activeTab = 'dashboard' }) => {
  const half = size / 2;

  const isSettings = activeTab === 'settings';

  return (
    <div
      className="relative select-none pointer-events-none flex flex-col items-center justify-center"
      style={{
        width: size + 30,
        perspective: '1000px',
      }}
    >
      <div
        className="w-[125px] h-[125px] relative transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1)"
        style={{
          transformStyle: 'preserve-3d',
          transform: isSettings
            ? `rotateX(-75deg) rotateY(0deg) rotateZ(0deg)`
            : `rotateX(-22deg) rotateY(${rotationY}deg) rotateZ(3deg)`,
        }}
      >
        {/* FRONT FACE (0 deg) -> DASHBOARD */}
        <div
          className="absolute inset-0 border border-[#D35400]/40 bg-gradient-to-br from-[#F5B041] via-[#EB984E] to-[#DC7633] shadow-md rounded-sm flex items-center justify-center p-2"
          style={{ transform: `translateZ(${half}px)` }}
        >
          <div className="p-3 bg-[#5B2C06]/15 rounded-xl border border-[#5B2C06]/20 shadow-inner flex items-center justify-center">
            <LayoutDashboard size={48} className="text-[#421D03] stroke-[1.8]" />
          </div>
        </div>

        {/* RIGHT FACE (-90 deg / 270 deg) -> DISPATCH PIPELINE */}
        <div
          className="absolute inset-0 border border-[#D35400]/40 bg-gradient-to-br from-[#E59866] via-[#DC7633] to-[#CA6F1E] shadow-md rounded-sm flex items-center justify-center p-2"
          style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }}
        >
          <div className="p-3 bg-[#5B2C06]/15 rounded-xl border border-[#5B2C06]/20 shadow-inner flex items-center justify-center">
            <Truck size={48} className="text-[#421D03] stroke-[1.8]" />
          </div>
        </div>

        {/* BACK FACE (180 deg) -> COMPLETED DISPATCHES (BLACK/DARK ICON) */}
        <div
          className="absolute inset-0 border border-[#BA4A00]/50 bg-gradient-to-br from-[#DC7633] via-[#CA6F1E] to-[#BA4A00] shadow-md rounded-sm flex items-center justify-center p-2"
          style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
        >
          <div className="p-3 bg-[#5B2C06]/15 rounded-xl border border-[#5B2C06]/20 shadow-inner flex items-center justify-center">
            <History size={48} className="text-[#421D03] stroke-[1.8]" />
          </div>
        </div>

        {/* LEFT FACE (90 deg) -> REPORTS & ANALYTICS */}
        <div
          className="absolute inset-0 border border-[#D35400]/40 bg-gradient-to-br from-[#DC7633] via-[#CA6F1E] to-[#BA4A00] shadow-md rounded-sm flex items-center justify-center p-2"
          style={{ transform: `rotateY(90deg) translateZ(${half}px)` }}
        >
          <div className="p-3 bg-[#5B2C06]/15 rounded-xl border border-[#5B2C06]/20 shadow-inner flex items-center justify-center">
            <BarChart3 size={48} className="text-[#421D03] stroke-[1.8]" />
          </div>
        </div>

        {/* TOP FACE -> SETTINGS ICON ON TOP OR CLIPBOARD */}
        <div
          className="absolute inset-0 border border-[#F5B041] bg-gradient-to-br from-[#FAD7A0] via-[#F5B041] to-[#EB984E] shadow-sm rounded-sm overflow-visible flex items-center justify-center p-2"
          style={{ transform: `rotateX(90deg) translateZ(${half}px)` }}
        >
          {/* Brown Packing Tape Strip Down The Center */}
          <div className="absolute inset-y-0 w-7 bg-[#D35400]/30 border-x border-[#BA4A00]/40 left-1/2 -translate-x-1/2 pointer-events-none" />

          {isSettings ? (
            <div className="relative z-10 p-3 bg-[#5B2C06]/15 rounded-xl border border-[#5B2C06]/20 shadow-inner flex items-center justify-center">
              <Settings size={48} className="text-[#421D03] stroke-[1.8]" />
            </div>
          ) : (
            /* Clipboard resting on top of box for other tabs */
            <div className="relative z-10 w-[90%] h-[85%] bg-slate-900 border border-slate-700 rounded p-1.5 shadow-2xl flex flex-col justify-between transform -rotate-3 scale-95">
              {/* Metal Clip Top */}
              <div className="w-9 h-1.5 bg-slate-300 rounded-xs mx-auto mb-0.5 border border-slate-400" />

              <div className="bg-white rounded p-1.5 space-y-1 text-slate-800 shadow-inner">
                <div className="flex items-center gap-1">
                  <CheckSquare size={10} className="text-emerald-600 shrink-0" />
                  <span className="text-[7.5px] font-black tracking-tight text-slate-900">DISPATCH CHECKLIST</span>
                </div>
                <div className="space-y-0.5">
                  <div className="h-0.5 bg-slate-200 w-full rounded-full" />
                  <div className="h-0.5 bg-slate-200 w-3/4 rounded-full" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM FACE */}
        <div
          className="absolute inset-0 border border-slate-800 bg-[#421D03] shadow-2xl rounded-sm"
          style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }}
        />
      </div>
    </div>
  );
};

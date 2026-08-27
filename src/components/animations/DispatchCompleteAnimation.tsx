import React, { useEffect } from 'react';
import { Truck } from 'lucide-react';
import { AnimatedCheck } from './AnimatedCheck';

interface DispatchCompleteAnimationProps {
  dispatchNumber: string;
  onComplete: () => void;
  autoCloseMs?: number;
}

export const DispatchCompleteAnimation: React.FC<DispatchCompleteAnimationProps> = ({
  dispatchNumber,
  onComplete,
  autoCloseMs = 1800,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [onComplete, autoCloseMs]);

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500 via-emerald-600 to-teal-700 select-none p-6 animate-gpay-flash overflow-hidden"
      role="dialog"
      aria-live="polite"
      aria-label={`Dispatch Completed ${dispatchNumber}`}
    >
      {/* Background Radiating Ripple Waves (Google Pay Style) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[280px] h-[280px] rounded-full border-4 border-white/20 animate-gpay-ripple-1 absolute" />
        <div className="w-[360px] h-[360px] rounded-full border-4 border-white/15 animate-gpay-ripple-2 absolute" />
        <div className="w-[500px] h-[500px] rounded-full border-2 border-white/10 animate-gpay-ripple-1 absolute" />
      </div>

      {/* Center Success Card */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm w-full">
        {/* Animated Pop-in Circular Badge with Checkmark */}
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white shadow-2xl flex items-center justify-center animate-gpay-pop">
            <AnimatedCheck size={52} strokeWidth={3.5} color="#059669" />
          </div>
        </div>

        {/* Text Confirmation */}
        <div className="space-y-2 text-white">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm uppercase">
            Dispatch Completed
          </h2>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-700/60 border border-emerald-400/40 backdrop-blur-xs shadow-inner">
            <Truck size={16} className="text-emerald-200" />
            <span className="font-mono text-sm font-extrabold text-white tracking-wide">
              {dispatchNumber || 'DC-COMPLETED'}
            </span>
          </div>
          <p className="text-xs font-semibold text-emerald-100/90 pt-1 tracking-wide">
            Finalized & Archived in Completed Logs
          </p>
        </div>
      </div>
    </div>
  );
};

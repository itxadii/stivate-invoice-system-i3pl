import React, { useEffect, useState } from 'react';
import { Truck, CircleCheck } from 'lucide-react';
import { AnimatedCheck } from './AnimatedCheck';

interface DispatchCompleteAnimationProps {
  dispatchNumber: string;
  onComplete: () => void;
  autoCloseMs?: number;
}

export const DispatchCompleteAnimation: React.FC<DispatchCompleteAnimationProps> = ({
  dispatchNumber,
  onComplete,
  autoCloseMs = 1400,
}) => {
  const [phase, setPhase] = useState<'driving' | 'arrived' | 'success'>('driving');

  useEffect(() => {
    const driveTimer = setTimeout(() => {
      setPhase('arrived');
    }, 950);

    const successTimer = setTimeout(() => {
      setPhase('success');
    }, 1150);

    const closeTimer = setTimeout(() => {
      onComplete();
    }, autoCloseMs + 950);

    return () => {
      clearTimeout(driveTimer);
      clearTimeout(successTimer);
      clearTimeout(closeTimer);
    };
  }, [onComplete, autoCloseMs]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs select-none p-4 transition-opacity duration-300"
      role="dialog"
      aria-live="polite"
      aria-label={`Dispatch Completed ${dispatchNumber}`}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 overflow-hidden relative">
        {/* Track Container */}
        <div className="relative w-full h-20 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center px-4 overflow-hidden">
          {/* Track Road Line */}
          <div className="absolute inset-x-4 bottom-4 h-0.5 border-dashed border-t-2 border-slate-300" />

          {/* Destination Icon */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center z-10">
            {phase === 'success' ? (
              <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-700 flex items-center justify-center animate-pulse-scale shadow-sm">
                <AnimatedCheck size={22} strokeWidth={3} color="#047857" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center">
                <CircleCheck size={20} />
              </div>
            )}
          </div>

          {/* Moving Truck Container */}
          <div
            className={`absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 ${
              phase === 'driving' ? 'animate-truck-move' : 'translate-x-[calc(100%-3.5rem)]'
            }`}
            style={{ width: 'calc(100% - 4.5rem)' }}
          >
            {/* Motion Lines behind Truck */}
            {phase === 'driving' && (
              <div className="flex gap-1 text-slate-400 font-mono text-xs font-bold tracking-tighter opacity-70">
                <span className="animate-pulse">░</span>
                <span className="animate-pulse">▒</span>
              </div>
            )}
            <div className={`p-2 bg-slate-900 text-white rounded-xl shadow-md ${phase === 'driving' ? 'animate-truck-bounce' : ''}`}>
              <Truck size={24} />
            </div>
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center justify-center gap-2">
            {phase === 'success' && <AnimatedCheck size={20} color="#047857" />}
            Dispatch Completed
          </h3>
          <p className="text-sm font-mono font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg py-1 px-3 inline-block shadow-2xs">
            {dispatchNumber || 'DC-COMPLETED'}
          </p>
        </div>
      </div>
    </div>
  );
};

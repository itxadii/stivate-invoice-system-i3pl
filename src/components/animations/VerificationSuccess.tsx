import React from 'react';
import { AnimatedCheck } from './AnimatedCheck';

interface VerificationSuccessProps {
  size?: number;
  label?: string;
  className?: string;
}

export const VerificationSuccess: React.FC<VerificationSuccessProps> = ({
  size = 16,
  label = 'Verified',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-xs animate-pulse-scale ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="w-4 h-4 rounded-full bg-emerald-200/80 text-emerald-900 flex items-center justify-center shrink-0">
        <AnimatedCheck size={size - 4} strokeWidth={3} />
      </span>
      <span>{label}</span>
    </span>
  );
};

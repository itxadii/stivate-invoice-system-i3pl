import React from 'react';
import { AlertCircle } from 'lucide-react';

interface VerificationErrorProps {
  size?: number;
  label?: string;
  className?: string;
}

export const VerificationError: React.FC<VerificationErrorProps> = ({
  size = 15,
  label = 'Failed',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-xs animate-shake ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle size={size} className="text-rose-600 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

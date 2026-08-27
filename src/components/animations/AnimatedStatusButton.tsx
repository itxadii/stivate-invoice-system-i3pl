import React from 'react';
import { LoaderCircle, Check, AlertCircle } from 'lucide-react';

export type ButtonStatus = 'idle' | 'loading' | 'success' | 'error';

interface AnimatedStatusButtonProps {
  status: ButtonStatus;
  idleText: string;
  loadingText: string;
  successText: string;
  errorText?: string;
  idleIcon?: React.ElementType;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: 'primary' | 'success' | 'amber' | 'outline' | 'slate';
  className?: string;
  type?: 'button' | 'submit';
}

export const AnimatedStatusButton: React.FC<AnimatedStatusButtonProps> = ({
  status,
  idleText,
  loadingText,
  successText,
  errorText = 'Failed',
  idleIcon: IdleIcon,
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  type = 'button',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs';
      case 'amber':
        return 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-500 shadow-xs';
      case 'outline':
        return 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300';
      case 'slate':
        return 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-xs';
      default:
        return 'bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 border-[#4BB8FA] shadow-xs';
    }
  };

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isLoading = status === 'loading';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-live="polite"
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 border cursor-pointer min-w-[110px] select-none ${
        isSuccess
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs animate-pulse-scale font-extrabold'
          : isError
          ? 'bg-rose-50 text-rose-800 border-rose-300 animate-shake font-extrabold'
          : getVariantStyles()
      } ${disabled || isLoading ? 'opacity-85 cursor-not-allowed' : ''} ${className}`}
    >
      {isLoading && (
        <>
          <LoaderCircle size={15} className="animate-spin text-current shrink-0" />
          <span>{loadingText}</span>
        </>
      )}

      {isSuccess && (
        <>
          <span className="w-4 h-4 rounded-full bg-emerald-200/80 text-emerald-900 flex items-center justify-center shrink-0">
            <Check size={12} strokeWidth={3} />
          </span>
          <span>{successText}</span>
        </>
      )}

      {isError && (
        <>
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{errorText}</span>
        </>
      )}

      {status === 'idle' && (
        <>
          {IdleIcon && <IdleIcon size={15} className="shrink-0" />}
          <span>{idleText}</span>
        </>
      )}
    </button>
  );
};

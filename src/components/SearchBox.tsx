import React, { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBoxProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  autoFocus = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Global hotkey Ctrl+F to focus
  useEffect(() => {
    const handleGlobalF = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalF);
    return () => window.removeEventListener('keydown', handleGlobalF);
  }, []);

  return (
    <div className="relative flex items-center w-full max-w-md">
      <div className="absolute left-3.5 text-slate-400 pointer-events-none">
        <Search size={16} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-100"
      />
      {value && (
        <button
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="absolute right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

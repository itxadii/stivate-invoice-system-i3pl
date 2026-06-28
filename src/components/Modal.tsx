import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none select-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className={`relative w-full my-6 mx-auto px-4 ${maxWidth} z-50 transition-all duration-300 transform scale-100`}>
        <div className="border-0 rounded-xl shadow-2xl relative flex flex-col w-full bg-white outline-none focus:outline-none border border-slate-200">
          
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 rounded-t-xl bg-slate-50/50">
            <h3 className="text-md font-bold text-slate-800 uppercase tracking-wide">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 ml-auto bg-transparent border-0 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="relative p-6 flex-auto max-h-[70vh] overflow-y-auto text-slate-600 text-sm">
            {children}
          </div>

        </div>
      </div>
    </div>
  );
};

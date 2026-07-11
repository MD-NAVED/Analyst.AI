import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  className = '', 
  size = 'md', 
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];
  const isSm = size === 'sm';

  return (
    <div className={`relative inline-block ${isSm ? 'min-w-[120px]' : 'w-full'} ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border rounded-xl text-left font-semibold hover:bg-[var(--surface-hover)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all select-none ${
          disabled 
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60' 
            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] cursor-pointer focus:border-[var(--primary)] shadow-sm'
        } ${
          isSm ? 'px-3 py-1.5 text-[11px] min-h-[32px]' : 'px-3.5 py-2.5 text-xs min-h-[40px]'
        }`}
      >
        <span className="truncate pr-1">{selectedOption ? selectedOption.label : ''}</span>
        <ChevronRight size={isSm ? 12 : 14} className={`transform transition-transform text-[var(--text-muted)] shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-fadeIn select-none min-w-[140px]">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`text-left cursor-pointer transition-colors ${
                isSm ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2.5 text-xs'
              } ${
                opt.value === value
                  ? 'bg-blue-50 text-blue-600 font-bold'
                  : 'text-[#334155] hover:bg-[#F8FAFC]'
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

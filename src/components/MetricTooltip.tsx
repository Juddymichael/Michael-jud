import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface MetricTooltipProps {
  title: string;
  description: string;
  formula?: string;
  interpretation?: string;
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  title,
  description,
  formula,
  interpretation,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center ml-1 z-30">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="p-0.5 rounded-full text-[#6B7280] dark:text-[#8B92A0] hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition-colors cursor-pointer"
        aria-label={`Explication de ${title}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-2xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xl text-left text-xs z-50 pointer-events-auto"
        >
          <div className="font-bold text-[#1A1D23] dark:text-[#E6E8EB] mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] dark:bg-[#8B5CF6]" />
            <span>{title}</span>
          </div>
          <p className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] leading-relaxed mb-2">
            {description}
          </p>
          {formula && (
            <div className="p-1.5 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] font-mono text-[10px] text-[#7C3AED] dark:text-[#8B5CF6] mb-1.5">
              {formula}
            </div>
          )}
          {interpretation && (
            <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] italic">
              💡 {interpretation}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  }[size];

  const textSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`} id="thunder-edge-logo">
      {/* Precision Thunder Edge Mark */}
      <div
        className={`${iconDimensions} rounded-xl bg-[#7C3AED] dark:bg-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 hover:scale-105`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-3/5 h-3/5 text-white"
        >
          {/* Precision lightning bolt with geometric angular edge */}
          <path
            d="M13.5 2L5 13.5H11.5L9.5 22L19 9.5H12.5L13.5 2Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold tracking-tight ${textSize} text-[#1A1D23] dark:text-[#E6E8EB] font-sans`}>
              THUNDER<span className="text-[#7C3AED] dark:text-[#8B5CF6] font-semibold ml-0.5">EDGE</span>
            </span>
            <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40 uppercase tracking-wider">
              PRO
            </span>
          </div>
          <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-normal tracking-wide mt-1 hidden sm:inline">
            Terminal &amp; Edge Engine
          </span>
        </div>
      )}
    </div>
  );
};

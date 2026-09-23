import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (val: number) => string;
  duration?: number; // duration in ms, default ~850ms
  prefix?: string;
  suffix?: string;
  className?: string;
  colorizeSigned?: boolean;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format,
  duration = 800,
  prefix = '',
  suffix = '',
  className = '',
  colorizeSigned = false,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const prevValueRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    prevValueRef.current = endVal;

    // If both are 0, set immediately
    if (startVal === 0 && endVal === 0) {
      setDisplayValue(0);
      return;
    }

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic: 1 - (1 - progress)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  const formatted = format ? format(displayValue) : displayValue.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

  const colorClass = colorizeSigned
    ? value > 0
      ? 'text-[var(--profit-green,#10B981)]'
      : value < 0
      ? 'text-[var(--loss-red,#EF4444)]'
      : 'text-[var(--text-primary,#1A1D23)]'
    : '';

  return (
    <span
      className={`tabular-nums font-mono transition-colors duration-200 ease-out ${colorClass} ${className}`}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

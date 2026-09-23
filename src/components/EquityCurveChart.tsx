import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trade } from '../types/trade';
import { formatCurrency, formatRMultiple } from '../lib/formatting';
import { TrendingUp } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { motion } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';

interface EquityCurveChartProps {
  trades?: Trade[];
  initialBalance?: number;
  currency?: string;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  trades = [],
  initialBalance = 10000,
  currency = 'EUR',
}) => {
  const { isDark } = useTheme();
  const safeTrades = trades || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 260 });
  const [mode, setMode] = useState<'pnl' | 'r'>('pnl');
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    trade: Trade;
    cumulativePnL: number;
    cumulativeR: number;
    x: number;
    y: number;
  } | null>(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          const isMobile = entry.contentRect.width < 540;
          const isTablet = entry.contentRect.width >= 540 && entry.contentRect.width < 900;
          setDimensions({
            width: Math.max(280, entry.contentRect.width),
            height: isMobile ? 180 : isTablet ? 240 : 280,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute chronologically sorted closed trades and cumulative curve
  const dataPoints = useMemo(() => {
    const closed = safeTrades
      .filter((t) => t && t.status === 'CLOSED' && (t.netPnL !== null || t.rMultiple !== null))
      .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());

    let runningPnL = 0;
    let runningR = 0;

    return closed.map((trade, idx) => {
      if (trade.netPnL !== null && trade.netPnL !== undefined) runningPnL += trade.netPnL;
      if (trade.rMultiple !== null && trade.rMultiple !== undefined) runningR += trade.rMultiple;
      return {
        trade,
        index: idx + 1,
        cumulativePnL: runningPnL,
        cumulativeR: runningR,
        balance: initialBalance + runningPnL,
      };
    });
  }, [safeTrades, initialBalance]);

  // Scaling math
  const { width, height } = dimensions;
  const padding = { top: 20, right: 24, bottom: 32, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = dataPoints.map((d) => (mode === 'pnl' ? d.cumulativePnL : d.cumulativeR));
  const minValue = Math.min(0, ...(values.length > 0 ? values : [0]));
  const maxValue = Math.max(0, ...(values.length > 0 ? values : [100]));
  const range = maxValue - minValue || 1;

  const getX = (index: number) => {
    if (dataPoints.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + ((index - 1) / (dataPoints.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padding.top + chartHeight - ((val - minValue) / range) * chartHeight;
  };

  const zeroY = getY(0);

  // SVG Path generator
  const linePath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    return dataPoints
      .map((d, i) => {
        const x = getX(d.index);
        const y = getY(mode === 'pnl' ? d.cumulativePnL : d.cumulativeR);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [dataPoints, mode, width, height, minValue, maxValue]);

  const areaPath = useMemo(() => {
    if (dataPoints.length === 0 || !linePath) return '';
    const firstX = getX(1);
    const lastX = getX(dataPoints.length);
    return `${linePath} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`;
  }, [linePath, zeroY, dataPoints.length]);

  return (
    <div
      ref={containerRef}
      className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#131820] shadow-xs relative flex flex-col justify-between interactive-card"
      id="component-equity-curve"
    >
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40 shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
              Courbe d&apos;Évolution du Capital (Equity Curve)
            </h3>
            <span className="text-[10px] sm:text-[11px] text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-mono font-medium">
              <AnimatedNumber value={dataPoints.length} duration={700} /> exécutions clôturées
            </span>
          </div>
        </div>

        {/* Toggle PnL vs R */}
        <div className="flex items-center p-0.5 sm:p-1 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-[#181F2A] border border-slate-200 dark:border-[#1E2532] text-[10px] sm:text-xs font-bold shadow-xs">
          <button
            onClick={() => setMode('pnl')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all duration-150 btn-press cursor-pointer ${
              mode === 'pnl'
                ? 'bg-[#7C3AED] dark:bg-[#8B5CF6] text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
            }`}
          >
            P&amp;L Net ({currency})
          </button>
          <button
            onClick={() => setMode('r')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all duration-150 btn-press cursor-pointer ${
              mode === 'r'
                ? 'bg-[#7C3AED] dark:bg-[#8B5CF6] text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
            }`}
          >
            R-Multiple (R)
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      {dataPoints.length === 0 ? (
        <div className="h-36 sm:h-48 flex items-center justify-center text-xs text-[#6B7280] dark:text-[#8B92A0] font-medium">
          Aucun historique de trades clôturés pour tracer la courbe.
        </div>
      ) : (
        <div className="relative w-full select-none" style={{ height }}>
          <svg
            width={width}
            height={height}
            className="overflow-visible"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#8B5CF6" : "#7C3AED"} stopOpacity={isDark ? "0.14" : "0.08"} />
                <stop offset="100%" stopColor={isDark ? "#8B5CF6" : "#7C3AED"} stopOpacity="0.0" />
              </linearGradient>
              <clipPath id="equityCurveClip">
                <motion.rect
                  x={padding.left}
                  y={0}
                  height={height}
                  initial={{ width: 0 }}
                  animate={{ width: chartWidth + padding.right }}
                  transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                />
              </clipPath>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const val = minValue + (maxValue - minValue) * (1 - pct);
              const y = padding.top + pct * chartHeight;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={isDark ? "#1C2430" : "#E5E7EB"}
                    strokeWidth="1"
                    strokeDasharray={pct === 0 || pct === 1 ? 'none' : '3 3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="text-[10px] fill-slate-500 dark:fill-[#8B92A0] tabular-nums font-mono font-semibold"
                  >
                    {mode === 'pnl' ? `${Math.round(val)} ${currency}` : `${val.toFixed(1)}R`}
                  </text>
                </g>
              );
            })}

            {/* Zero Baseline */}
            <line
              x1={padding.left}
              y1={zeroY}
              x2={width - padding.right}
              y2={zeroY}
              stroke={isDark ? "#2A3444" : "#D1D5DB"}
              strokeWidth="1.5"
            />

            {/* Group with Progressive Reveal ClipPath */}
            <g clipPath="url(#equityCurveClip)">
              {/* Area Fill under curve */}
              {areaPath && <path d={areaPath} fill="url(#curveGradient)" />}

              {/* Line Path with Progressive Stroke Drawing */}
              {linePath && (
                <motion.path
                  key={`path-${mode}-${dataPoints.length}`}
                  d={linePath}
                  fill="none"
                  stroke={isDark ? "#8B5CF6" : "#7C3AED"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </g>

            {/* Data Point Circles & Hover interaction */}
            {dataPoints.map((d, idx) => {
              const cx = getX(d.index);
              const cy = getY(mode === 'pnl' ? d.cumulativePnL : d.cumulativeR);
              const isHovered = hoveredPoint?.index === d.index;

              return (
                <g key={d.index}>
                  <motion.circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 5 : 2.5}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.15 + (idx / Math.max(1, dataPoints.length)) * 0.7,
                      duration: 0.25,
                      ease: 'easeOut',
                    }}
                    className={`transition-colors duration-150 ${
                      isHovered
                        ? isDark
                          ? 'fill-[#8B5CF6] stroke-[#0A0E14] stroke-2 shadow-xs'
                          : 'fill-[#7C3AED] stroke-white stroke-2 shadow-xs'
                        : isDark
                        ? 'fill-[#8B5CF6] hover:fill-[#A78BFA]'
                        : 'fill-[#7C3AED] hover:fill-[#6D28D9]'
                    }`}
                  />
                  {/* Invisible broad hitbox */}
                  <rect
                    x={cx - 10}
                    y={padding.top}
                    width={20}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        index: d.index,
                        trade: d.trade,
                        cumulativePnL: d.cumulativePnL,
                        cumulativeR: d.cumulativeR,
                        x: cx,
                        y: cy,
                      })
                    }
                  />
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none bg-white/95 dark:bg-[#131820]/95 backdrop-blur-md text-[#1A1D23] dark:text-[#E6E8EB] p-3 rounded-2xl text-xs shadow-xl border border-slate-200/60 dark:border-[#1C2430] transform -translate-x-1/2 -translate-y-full -mt-2.5 min-w-[160px]"
              style={{ left: hoveredPoint.x, top: hoveredPoint.y }}
            >
              <div className="font-semibold text-[#1A1D23] dark:text-[#E6E8EB] flex items-center justify-between border-b border-slate-100 dark:border-[#1C2430] pb-1.5 mb-1.5">
                <span>{hoveredPoint.trade.symbol}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${hoveredPoint.trade.direction === 'BUY' ? 'text-[#10B981] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20' : 'text-[#EF4444] bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20'}`}>
                  {hoveredPoint.trade.direction === 'BUY' ? 'LONG' : 'SHORT'}
                </span>
              </div>
              <div className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Trade :</span>
                  <span className={`tabular-nums font-mono font-bold ${hoveredPoint.trade.netPnL && hoveredPoint.trade.netPnL > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {formatCurrency(hoveredPoint.trade.netPnL, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">Multiple R :</span>
                  <span className="tabular-nums font-mono font-bold text-[#1A1D23] dark:text-[#E6E8EB]">{formatRMultiple(hoveredPoint.trade.rMultiple)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 dark:border-[#1C2430] pt-1 text-[#7C3AED] dark:text-[#8B5CF6] font-bold">
                  <span>Cumul {mode === 'pnl' ? 'PnL' : 'R'} :</span>
                  <span className="tabular-nums font-mono">
                    {mode === 'pnl'
                      ? formatCurrency(hoveredPoint.cumulativePnL, currency)
                      : formatRMultiple(hoveredPoint.cumulativeR)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


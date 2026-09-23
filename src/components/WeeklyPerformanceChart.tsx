import React, { useState, useMemo } from 'react';
import { Trade } from '../types/trade';
import { formatCurrency, formatPercent } from '../lib/formatting';
import { calculateWinRate } from '../lib/calculations/statistics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Calendar, BarChart3, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface WeeklyPerformanceChartProps {
  trades?: Trade[];
  currency?: string;
  className?: string;
}

export const WeeklyPerformanceChart: React.FC<WeeklyPerformanceChartProps> = ({
  trades = [],
  currency = 'USD',
  className = '',
}) => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<'dayOfWeek' | 'weeklyProgress'>('dayOfWeek');
  const [metricMode, setMetricMode] = useState<'pnl' | 'winrate'>('pnl');

  const safeTrades = useMemo(() => {
    return (trades || []).filter(
      (t) => t && t.status === 'CLOSED' && (t.netPnL !== null || t.rMultiple !== null)
    );
  }, [trades]);

  // 1. Calculate Day of Week Breakdown (Lundi à Vendredi - Pas de Dimanche)
  const daysData = useMemo(() => {
    const dayNames: Record<number, string> = {
      1: 'Lundi',
      2: 'Mardi',
      3: 'Mercredi',
      4: 'Jeudi',
      5: 'Vendredi',
    };
    const shortNames: Record<number, string> = {
      1: 'Lun',
      2: 'Mar',
      3: 'Mer',
      4: 'Jeu',
      5: 'Ven',
    };
    const dayMap = new Map<number, Trade[]>();

    for (const t of safeTrades) {
      const dateStr = t.openedAt || t.closedAt;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;

      let dayIdx = d.getUTCDay();
      // Trades executed Sunday evening (market open / Asian killzone) belong to the Monday session
      if (dayIdx === 0) dayIdx = 1;
      // Weekend settlement / Saturday morning closes belong to Friday
      if (dayIdx === 6) dayIdx = 5;

      const arr = dayMap.get(dayIdx) || [];
      arr.push(t);
      dayMap.set(dayIdx, arr);
    }

    // Standard trading week: Strictly Lundi (1) to Vendredi (5)
    const order = [1, 2, 3, 4, 5];

    return order.map((dayIdx) => {
      const cluster = dayMap.get(dayIdx) || [];
      const wr = calculateWinRate(cluster);
      let pnl = 0;
      cluster.forEach((t) => (pnl += t.netPnL ?? 0));

      return {
        dayIdx,
        dayName: dayNames[dayIdx],
        shortName: shortNames[dayIdx],
        tradesCount: cluster.length,
        winRate: wr.winRate ?? 0,
        wins: wr.wins,
        losses: wr.losses,
        breakevens: wr.breakeven,
        pnl,
      };
    });
  }, [safeTrades]);

  // 2. Calculate Weekly Progress Breakdown (Weeks of the year/month)
  const weeklyData = useMemo(() => {
    if (safeTrades.length === 0) return [];

    // Sort chronologically
    const sorted = [...safeTrades].sort((a, b) => {
      const timeA = new Date(a.openedAt || a.closedAt).getTime() || 0;
      const timeB = new Date(b.openedAt || b.closedAt).getTime() || 0;
      return timeA - timeB;
    });

    const weekMap = new Map<string, { label: string; date: Date; trades: Trade[] }>();

    for (const t of sorted) {
      const dateStr = t.openedAt || t.closedAt;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;

      // Determine Monday of the current trade week in UTC
      let dayOfWeek = d.getUTCDay();
      if (dayOfWeek === 0) dayOfWeek = 1;
      if (dayOfWeek === 6) dayOfWeek = 5;

      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - diffToMonday);
      monday.setUTCHours(0, 0, 0, 0);

      const weekKey = monday.toISOString().slice(0, 10);
      const weekLabel = `Sem. ${monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}`;

      const current = weekMap.get(weekKey) || { label: weekLabel, date: monday, trades: [] };
      current.trades.push(t);
      weekMap.set(weekKey, current);
    }

    const result = Array.from(weekMap.entries()).map(([_, val]) => {
      const wr = calculateWinRate(val.trades);
      let pnl = 0;
      val.trades.forEach((t) => (pnl += t.netPnL ?? 0));

      return {
        weekKey: val.label,
        label: val.label,
        tradesCount: val.trades.length,
        winRate: wr.winRate ?? 0,
        wins: wr.wins,
        losses: wr.losses,
        pnl,
      };
    });

    // Return the last 8-12 weeks for optimal visibility
    return result.slice(-10);
  }, [safeTrades]);

  // Summary indicators
  const bestDay = useMemo(() => {
    if (daysData.length === 0) return null;
    const withTrades = daysData.filter((d) => d.tradesCount > 0);
    if (withTrades.length === 0) return null;
    return [...withTrades].sort((a, b) => b.pnl - a.pnl)[0];
  }, [daysData]);

  const worstDay = useMemo(() => {
    if (daysData.length === 0) return null;
    const withTrades = daysData.filter((d) => d.tradesCount > 0);
    if (withTrades.length === 0) return null;
    return [...withTrades].sort((a, b) => a.pnl - b.pnl)[0];
  }, [daysData]);

  const currentChartData = useMemo(() => {
    if (viewMode === 'dayOfWeek') {
      return daysData.map((d) => ({
        name: d.shortName,
        fullName: d.dayName,
        pnl: d.pnl,
        winRate: d.winRate,
        tradesCount: d.tradesCount,
        wins: d.wins,
        losses: d.losses,
      }));
    } else {
      return weeklyData.map((w) => ({
        name: w.label,
        fullName: w.label,
        pnl: w.pnl,
        winRate: w.winRate,
        tradesCount: w.tradesCount,
        wins: w.wins,
        losses: w.losses,
      }));
    }
  }, [viewMode, daysData, weeklyData]);

  // Max absolute PnL for scaling reference
  const maxAbsPnL = useMemo(() => {
    let m = 1;
    daysData.forEach((d) => {
      if (Math.abs(d.pnl) > m) m = Math.abs(d.pnl);
    });
    return m;
  }, [daysData]);

  return (
    <div
      className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-4 sm:space-y-6 ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#1C2430]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40 shrink-0 shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
                Graphique Hebdomadaire &amp; Rentabilité par Jour
              </h3>
              <p className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#8B92A0]">
                Visualisation diagramme de la rentabilité par jour et semaine
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Metric Selectors */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {/* Day of Week vs Weekly progression */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#181F2A] border border-slate-200/70 dark:border-[#1C2430] text-[11px] font-semibold">
            <button
              onClick={() => setViewMode('dayOfWeek')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'dayOfWeek'
                  ? 'bg-white dark:bg-[#131820] text-[#7C3AED] dark:text-[#8B5CF6] shadow-xs font-bold'
                  : 'text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
              }`}
            >
              Par Jour
            </button>
            <button
              onClick={() => setViewMode('weeklyProgress')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'weeklyProgress'
                  ? 'bg-white dark:bg-[#131820] text-[#7C3AED] dark:text-[#8B5CF6] shadow-xs font-bold'
                  : 'text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
              }`}
            >
              Par Semaine
            </button>
          </div>

          {/* Metric mode toggle: PnL vs Win Rate */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#181F2A] border border-slate-200/70 dark:border-[#1C2430] text-[11px] font-semibold">
            <button
              onClick={() => setMetricMode('pnl')}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                metricMode === 'pnl'
                  ? 'bg-white dark:bg-[#131820] text-[#10B981] shadow-xs font-bold'
                  : 'text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
              }`}
            >
              P&amp;L
            </button>
            <button
              onClick={() => setMetricMode('winrate')}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                metricMode === 'winrate'
                  ? 'bg-white dark:bg-[#131820] text-[#7C3AED] dark:text-[#8B5CF6] shadow-xs font-bold'
                  : 'text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
              }`}
            >
              Win %
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards: Best Day, Worst Day, Key Trade Day */}
      {viewMode === 'dayOfWeek' && bestDay && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="p-3 rounded-xl sm:rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium block truncate">
                Meilleur Jour
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate block">
                {bestDay.dayName}
              </span>
            </div>
            <span
              className={`text-xs sm:text-sm font-bold tabular-nums font-mono shrink-0 ${
                bestDay.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {formatCurrency(bestDay.pnl, currency)}
            </span>
          </div>

          {worstDay && (
            <div className="p-3 rounded-xl sm:rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] flex items-center justify-between min-w-0">
              <div className="min-w-0">
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium block truncate">
                  Pire Jour
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate block">
                  {worstDay.dayName}
                </span>
              </div>
              <span
                className={`text-xs sm:text-sm font-bold tabular-nums font-mono shrink-0 ${
                  worstDay.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}
              >
                {formatCurrency(worstDay.pnl, currency)}
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl sm:rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium block truncate">
                Total Période
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate block">
                {safeTrades.length} trades fermés
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#7C3AED] dark:text-[#8B5CF6] tabular-nums shrink-0">
              {daysData.filter((d) => d.pnl > 0).length}j Gagnants / {daysData.filter((d) => d.pnl < 0).length}j Perdants
            </span>
          </div>
        </div>
      )}

      {/* The Visual Diagram / Bar Chart */}
      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/60 dark:bg-[#181F2A]/60 border border-slate-200/60 dark:border-[#1E2532] space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#1A1D23] dark:text-[#E6E8EB] px-1">
          <span className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#8B5CF6]" />
            <span>
              {viewMode === 'dayOfWeek' ? 'Distribution par Jour de Semaine' : 'Évolution Hebdomadaire (Chronologique)'}
            </span>
          </span>
          <span className="text-[11px] text-[#6B7280] dark:text-[#8B92A0]">
            {metricMode === 'pnl' ? `P&L Net (${currency})` : 'Taux de Réussite (%)'}
          </span>
        </div>

        {currentChartData.length === 0 ? (
          <div className="h-52 sm:h-64 md:h-72 flex items-center justify-center text-xs text-[#6B7280] dark:text-[#8B92A0]">
            Aucun trade clôturé à afficher pour ce graphique.
          </div>
        ) : (
          <div className="h-52 sm:h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentChartData}
                margin={{ top: 12, right: 12, left: -10, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? '#1C2430' : '#E5E7EB'}
                  vertical={false}
                  opacity={0.7}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: isDark ? '#8B92A0' : '#6B7280', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: isDark ? '#1C2430' : '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: isDark ? '#8B92A0' : '#6B7280', fontSize: 10 }}
                  axisLine={{ stroke: isDark ? '#1C2430' : '#E5E7EB' }}
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (metricMode === 'winrate') return `${val}%`;
                    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
                    return `${val}`;
                  }}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isPositive = data.pnl >= 0;
                      return (
                        <div className="bg-white/95 dark:bg-[#131820]/95 border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-3 text-xs shadow-xl text-[#1A1D23] dark:text-[#E6E8EB] space-y-1.5 min-w-[170px]">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1C2430] pb-1.5">
                            <span className="font-bold text-[#7C3AED] dark:text-[#8B5CF6]">{data.fullName || data.name}</span>
                            <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">{data.tradesCount} trades</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Net :</span>
                            <span
                              className={`font-bold tabular-nums font-mono ${
                                isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
                              }`}
                            >
                              {formatCurrency(data.pnl, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                            <span className="font-bold text-[#7C3AED] dark:text-[#8B5CF6] tabular-nums font-mono">
                              {data.winRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#6B7280] dark:text-[#8B92A0] pt-0.5 border-t border-slate-100 dark:border-[#1C2430]">
                            <span>Victoires / Pertes :</span>
                            <span className="font-medium text-[#1A1D23] dark:text-[#E6E8EB]">
                              {data.wins}W / {data.losses}L
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {metricMode === 'pnl' && (
                  <ReferenceLine y={0} stroke={isDark ? '#2A3444' : '#D1D5DB'} strokeWidth={1.5} />
                )}
                {metricMode === 'winrate' && (
                  <ReferenceLine
                    y={50}
                    stroke={isDark ? '#8B5CF6' : '#7C3AED'}
                    strokeDasharray="3 3"
                    label={{ value: '50% WR', fill: isDark ? '#8B5CF6' : '#7C3AED', fontSize: 10, position: 'right' }}
                  />
                )}
                <Bar
                  dataKey={metricMode === 'pnl' ? 'pnl' : 'winRate'}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                >
                  {currentChartData.map((entry, index) => {
                    const isPositive = entry.pnl >= 0;
                    let fill = isPositive ? '#10B981' : '#EF4444';
                    if (metricMode === 'winrate') {
                      fill = entry.winRate >= 50 ? (isDark ? '#8B5CF6' : '#7C3AED') : '#EF4444';
                    }
                    return (
                      <Cell
                        key={`cell-bar-${index}`}
                        fill={fill}
                        opacity={entry.tradesCount === 0 ? 0.25 : 0.9}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed List / Rows (Matching the User's Screenshot, with Institutional Clean Design) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
            Détail par Jour de Trading
          </h4>
          <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">
            {daysData.reduce((acc, d) => acc + d.tradesCount, 0)} trades comptabilisés
          </span>
        </div>

        <div className="space-y-2">
          {daysData.map((d, idx) => {
            const isPositive = d.pnl >= 0;
            const barWidthPercent = maxAbsPnL > 0 ? Math.min(100, Math.round((Math.abs(d.pnl) / maxAbsPnL) * 100)) : 0;

            return (
              <div
                key={idx}
                className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] hover:border-violet-300 dark:hover:border-violet-700/60 transition-all flex flex-col gap-2 relative overflow-hidden group"
              >
                {/* Visual subtle progress backdrop indicating performance magnitude */}
                <div
                  className={`absolute top-0 bottom-0 left-0 opacity-5 pointer-events-none transition-all ${
                    isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${barWidthPercent}%` }}
                />

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1A1D23] dark:text-[#E6E8EB] text-sm">
                      {d.dayName}
                    </span>
                    {d.tradesCount === 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-[#1E2532] text-[#6B7280] dark:text-[#8B92A0]">
                        Inactif
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-4 text-right shrink-0">
                    <span className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] font-medium">
                      {d.tradesCount} {d.tradesCount > 1 ? 'trades' : 'trade'}
                    </span>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border tabular-nums font-mono ${
                        d.tradesCount === 0
                          ? 'bg-slate-100 dark:bg-[#131820] text-[#6B7280] dark:text-[#8B92A0] border-transparent'
                          : d.winRate >= 50
                          ? 'bg-violet-50 dark:bg-violet-950/50 text-[#7C3AED] dark:text-[#8B5CF6] border-violet-200/60 dark:border-violet-800/50'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-[#EF4444] border-rose-200/60 dark:border-rose-800/50'
                      }`}
                    >
                      {d.tradesCount > 0 ? `${d.winRate.toFixed(1)}% WR` : '— WR'}
                    </span>

                    <span
                      className={`font-bold tabular-nums font-mono text-xs sm:text-sm min-w-[90px] text-right ${
                        d.tradesCount === 0
                          ? 'text-[#6B7280] dark:text-[#8B92A0]'
                          : isPositive
                          ? 'text-[#10B981]'
                          : 'text-[#EF4444]'
                      }`}
                    >
                      {d.tradesCount > 0 ? formatCurrency(d.pnl, currency) : formatCurrency(0, currency)}
                    </span>
                  </div>
                </div>

                {/* Progress bar visual for visual polish */}
                {d.tradesCount > 0 && (
                  <div className="w-full bg-slate-200/70 dark:bg-[#131820] h-1.5 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

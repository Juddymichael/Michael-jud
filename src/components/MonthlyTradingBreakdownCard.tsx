import React, { useState, useMemo } from 'react';
import { Trade } from '../types/trade';
import { getAllTradingMonths, MonthTradeStats, DEFAULT_CALENDAR_TIMEZONE } from '../lib/calendar';
import { useSettingsStore } from '../stores/useSettingsStore';
import { formatCurrency, formatPercent } from '../lib/formatting';
import { MonthDetailsModal } from './MonthDetailsModal';
import {
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Sparkles,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  trades?: Trade[];
  currency?: string;
  onSelectTrade: (trade: Trade) => void;
  onNavigateToCalendar?: (year: number, month: number) => void;
}

export const MonthlyTradingBreakdownCard: React.FC<Props> = ({
  trades = [],
  currency = 'EUR',
  onSelectTrade,
  onNavigateToCalendar,
}) => {
  const [selectedMonthStats, setSelectedMonthStats] = useState<MonthTradeStats | null>(null);

  const { settings } = useSettingsStore();
  const calendarTimezone = settings.timezone && settings.timezone !== 'UTC'
    ? settings.timezone
    : DEFAULT_CALENDAR_TIMEZONE;

  const monthsStats = useMemo(
    () => getAllTradingMonths(trades, calendarTimezone),
    [trades, calendarTimezone]
  );

  const totalAllTimePnL = useMemo(() => {
    return trades
      .filter((t) => t && t.status === 'CLOSED')
      .reduce((acc, t) => acc + (t.netPnL ?? 0), 0);
  }, [trades]);

  return (
    <div
      id="monthly-trading-breakdown-card"
      className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-3xl p-4 sm:p-6 shadow-xs font-sans"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-[#1C2430] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 flex items-center justify-center text-[#7C3AED] dark:text-[#8B5CF6] shadow-xs shrink-0">
            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate">
                Mois de Trading &amp; Performance
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40 shrink-0">
                {monthsStats.length} {monthsStats.length > 1 ? 'MOIS ACTIFS' : 'MOIS ACTIF'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-[#6B7280] dark:text-[#8B92A0] mt-0.5 truncate">
              Historique mensuel consolidé • Inspectez les statistiques détaillées
            </p>
          </div>
        </div>

        {/* Global P&L summary pill */}
        <div className="text-left sm:text-right shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0] block">
            P&amp;L CUMULÉ
          </span>
          <div className="text-base sm:text-xl font-bold tabular-nums font-mono truncate">
            <AnimatedNumber
              value={totalAllTimePnL}
              format={(val) => formatCurrency(val, currency, { showSign: true })}
              colorizeSigned={true}
              duration={900}
            />
          </div>
        </div>
      </div>

      {/* Months Grid / Mobile Horizontal Swipe Carousel */}
      {trades.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#6B7280] dark:text-[#8B92A0]">
          Aucun trade enregistré pour le moment.
        </div>
      ) : (
        <div className="flex md:grid overflow-x-auto snap-x snap-mandatory md:overflow-visible gap-2.5 sm:gap-4 mt-3 sm:mt-4 pb-1 md:pb-0 scrollbar-none md:grid-cols-2 lg:grid-cols-3">
          {monthsStats.map((m, idx) => {
            const isPositive = m.netPnL > 0;
            const isNegative = m.netPnL < 0;

            return (
              <motion.div
                key={m.monthKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedMonthStats(m)}
                className={`w-[85vw] max-w-[320px] shrink-0 snap-center md:w-auto relative rounded-xl sm:rounded-2xl p-3 sm:p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between group interactive-card min-w-0 ${
                  isPositive
                    ? 'bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-emerald-50/40 dark:hover:bg-[#1E2633] border-slate-200/60 dark:border-[#1C2430] hover:border-emerald-500/40 shadow-xs'
                    : isNegative
                    ? 'bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-rose-50/40 dark:hover:bg-[#1E2633] border-slate-200/60 dark:border-[#1C2430] hover:border-rose-500/40 shadow-xs'
                    : 'bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-slate-100 dark:hover:bg-[#1E2633] border-slate-200/60 dark:border-[#1C2430] shadow-xs'
                }`}
              >
                {/* Card Top: Month Name & Net PnL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1.5">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] capitalize truncate">
                        {m.monthLabel}
                      </span>
                      <span
                        className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md sm:rounded-lg transition-colors duration-300 shrink-0 ${
                          isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-[#10B981] border border-emerald-200 dark:border-emerald-500/20'
                            : isNegative
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            : 'bg-slate-100 dark:bg-[#1E2532] text-[#6B7280] dark:text-[#8B92A0]'
                        }`}
                      >
                        {isPositive ? 'PROFIT' : isNegative ? 'DÉFICIT' : 'NEUTRE'}
                      </span>
                    </div>

                    <div className="p-0.5 rounded text-[#6B7280] dark:text-[#8B92A0] group-hover:text-[#7C3AED] dark:group-hover:text-[#8B5CF6] transition-colors shrink-0">
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>

                  {/* Large P&L */}
                  <div className="text-base sm:text-xl font-bold tabular-nums font-mono truncate">
                    <AnimatedNumber
                      value={m.netPnL}
                      format={(val) => formatCurrency(val, currency, { showSign: true })}
                      colorizeSigned={true}
                      duration={800}
                    />
                  </div>
                </div>

                {/* Card Bottom: Trades & Win Rate */}
                <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-200/60 dark:border-[#1E2532] space-y-1 sm:space-y-1.5 text-[11px] sm:text-xs">
                  <div className="flex items-center justify-between text-[#6B7280] dark:text-[#8B92A0]">
                    <span>Trades exécutés</span>
                    <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono">
                      <AnimatedNumber value={m.totalTrades} duration={600} />
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#6B7280] dark:text-[#8B92A0]">
                    <span>Win Rate</span>
                    <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono">
                      <AnimatedNumber
                        value={m.winRate}
                        format={(val) => formatPercent(val, 1)}
                        duration={800}
                      />
                    </span>
                  </div>

                  {/* Mini Win Rate Bar with Animated Fill */}
                  <div className="h-1 sm:h-1.5 w-full bg-slate-200/80 dark:bg-[#1E2532] rounded-full overflow-hidden flex">
                    <motion.div
                      className="bg-[#7C3AED] dark:bg-[#8B5CF6] h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, m.winRate))}%` }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>

                  {/* Best / Worst Day hint */}
                  <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-[#6B7280] dark:text-[#8B92A0] pt-0.5 font-medium">
                    <span className="truncate">
                      Jours : <strong className="text-[#10B981] font-bold font-mono">{m.winningDaysCount}W</strong> /{' '}
                      <strong className="text-[#EF4444] font-bold font-mono">{m.losingDaysCount}L</strong>
                    </span>
                    {onNavigateToCalendar && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToCalendar(m.year, m.month);
                        }}
                        className="text-[#7C3AED] dark:text-[#8B5CF6] font-bold flex items-center gap-0.5 cursor-pointer animated-underline group/link shrink-0 ml-1"
                      >
                        <span>Calendrier</span>
                        <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform duration-200 group-hover/link:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Month Details Modal */}
      <MonthDetailsModal
        monthStats={selectedMonthStats}
        currency={currency}
        onClose={() => setSelectedMonthStats(null)}
        onSelectTrade={onSelectTrade}
        onOpenCalendarMonth={onNavigateToCalendar}
      />
    </div>
  );
};

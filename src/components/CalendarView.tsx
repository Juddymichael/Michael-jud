import React, { useState, useMemo } from 'react';
import { Trade } from '../types/trade';
import {
  buildMonthCalendar,
  getAllTradingMonths,
  MonthTradeStats,
  DayTradeStats,
  DEFAULT_CALENDAR_TIMEZONE,
} from '../lib/calendar';
import { useSettingsStore } from '../stores/useSettingsStore';
import { formatCurrency, formatPercent } from '../lib/formatting';
import { DayDetailsModal } from './DayDetailsModal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  BarChart3,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  trades: Trade[];
  currency?: string;
  onSelectTrade: (trade: Trade) => void;
  onSeed?: () => void;
  initialYear?: number;
  initialMonth?: number; // 0-11
}

export const CalendarView: React.FC<Props> = ({
  trades = [],
  currency = 'EUR',
  onSelectTrade,
  onSeed,
  initialYear,
  initialMonth,
}) => {
  // Determine initial date: either passed props, or latest trade date, or current date
  const defaultDate = useMemo(() => {
    if (initialYear !== undefined && initialMonth !== undefined) {
      return { year: initialYear, month: initialMonth };
    }
    if (trades.length > 0) {
      // Find the most recent trade's year and month
      for (const t of trades) {
        const dStr = t.closedAt || t.openedAt;
        if (dStr) {
          const d = new Date(dStr);
          if (!isNaN(d.getTime())) {
            return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
          }
        }
      }
    }
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  }, [trades, initialYear, initialMonth]);

  const [currentYear, setCurrentYear] = useState<number>(defaultDate.year);
  const [currentMonth, setCurrentMonth] = useState<number>(defaultDate.month);
  const [selectedDayStats, setSelectedDayStats] = useState<DayTradeStats | null>(null);

  React.useEffect(() => {
    if (initialYear !== undefined && initialMonth !== undefined) {
      setCurrentYear(initialYear);
      setCurrentMonth(initialMonth);
    }
  }, [initialYear, initialMonth]);

  const { settings } = useSettingsStore();
  const calendarTimezone = settings.timezone && settings.timezone !== 'UTC'
    ? settings.timezone
    : DEFAULT_CALENDAR_TIMEZONE;

  // Available trading months list for quick jump
  const allTradingMonths = useMemo(
    () => getAllTradingMonths(trades, calendarTimezone),
    [trades, calendarTimezone]
  );

  // Build calendar matrix for currently viewed month
  const monthData: MonthTradeStats = useMemo(
    () => buildMonthCalendar(currentYear, currentMonth, trades, calendarTimezone),
    [currentYear, currentMonth, trades, calendarTimezone]
  );

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getUTCFullYear());
    setCurrentMonth(now.getUTCMonth());
  };

  const dayHeaders = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  return (
    <div id="trading-calendar-view" className="space-y-4 sm:space-y-6 font-sans">
      {/* Month Navigation & Summary Toolbar */}
      <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        {/* Left: Month selector controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl sm:rounded-2xl p-0.5 sm:p-1 shadow-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-200/60 dark:hover:bg-[#1C2430] transition cursor-pointer"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2.5 sm:px-3.5 text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] min-w-[110px] sm:min-w-[130px] text-center capitalize">
              {monthData.monthLabel}
            </span>

            <button
              onClick={handleNextMonth}
              className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-200/60 dark:hover:bg-[#1C2430] transition cursor-pointer"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl sm:rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-slate-200/60 dark:hover:bg-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] border border-slate-200/60 dark:border-[#1C2430] transition cursor-pointer shadow-xs"
          >
            Aujourd&apos;hui
          </button>

          {/* Jump to active month dropdown */}
          {allTradingMonths.length > 1 && (
            <select
              value={`${currentYear}-${currentMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                setCurrentYear(y);
                setCurrentMonth(m);
              }}
              className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] rounded-xl sm:rounded-2xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] cursor-pointer hidden sm:block shadow-xs"
            >
              {allTradingMonths.map((m) => (
                <option key={m.monthKey} value={`${m.year}-${m.month}`}>
                  {m.monthLabel} ({m.totalTrades} trades)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Key Month KPI Summary Bar */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-3 text-xs w-full md:w-auto">
          {/* Monthly PnL */}
          <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-2 shadow-xs min-w-0">
            <span className="text-[8px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-bold uppercase tracking-wider truncate">
              P&amp;L Mois
            </span>
            <span
              className={`text-[11px] sm:text-base font-bold tabular-nums font-mono truncate block ${
                monthData.netPnL > 0
                  ? 'text-[#10B981]'
                  : monthData.netPnL < 0
                  ? 'text-[#EF4444]'
                  : 'text-[#1A1D23] dark:text-[#E6E8EB]'
              }`}
            >
              {formatCurrency(monthData.netPnL, currency, { showSign: true })}
            </span>
          </div>

          {/* Total Trades */}
          <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-2 shadow-xs min-w-0">
            <span className="text-[8px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-bold uppercase tracking-wider truncate">
              Trades
            </span>
            <span className="text-[11px] sm:text-base font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] truncate block">
              {monthData.totalTrades}
            </span>
          </div>

          {/* Win Rate */}
          <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-2 shadow-xs min-w-0">
            <span className="text-[8px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-bold uppercase tracking-wider truncate">
              Win Rate
            </span>
            <span className="text-[11px] sm:text-base font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] truncate block">
              {formatPercent(monthData.winRate, 1)}
            </span>
          </div>

          {/* Days breakdown */}
          <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl px-4 py-2 hidden lg:block shadow-xs">
            <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-bold uppercase tracking-wider">
              Jours W / L
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
              <span className="text-[#10B981] font-bold">{monthData.winningDaysCount}W</span>
              <span className="text-[#6B7280] dark:text-[#8B92A0] mx-1">-</span>
              <span className="text-[#EF4444] font-bold">{monthData.losingDaysCount}L</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Calendar Grid Structure (7 Days Columns + 8th Weekly Summary Column) */}
      <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <div className="min-w-[560px] sm:min-w-[620px]">
            {/* Table / Grid Headers */}
            <div className="grid grid-cols-8 bg-[#F7F8FA] dark:bg-[#181F2A] border-b border-slate-200/60 dark:border-[#1C2430] text-center py-2.5 sm:py-3.5 text-[10px] sm:text-[11px] font-bold tracking-wider text-[#6B7280] dark:text-[#8B92A0]">
              {dayHeaders.map((dh) => (
                <div key={dh} className="py-0.5 sm:py-1">
                  {dh}
                </div>
              ))}
              <div className="py-0.5 sm:py-1 text-[#7C3AED] dark:text-[#8B5CF6] font-bold border-l border-slate-200/60 dark:border-[#1C2430]">
                SEMAINE
              </div>
            </div>

            {/* Weekly Rows */}
            <div className="divide-y divide-slate-200/60 dark:divide-[#1C2430]">
              {monthData.weeks.map((week, wIdx) => {
                return (
                  <div key={wIdx} className="grid grid-cols-8 min-h-[82px] sm:min-h-[125px]">
                    {/* 7 Days of the Week */}
                    {week.days.map((day, dIdx) => {
                      const isCurrent = day.isCurrentMonth;
                      const hasTrades = isCurrent && day.tradeCount > 0;
                      const isPositive = day.netPnL > 0;
                      const isNegative = day.netPnL < 0;

                      return (
                        <div
                          key={dIdx}
                          onClick={() => {
                            if (hasTrades) {
                              setSelectedDayStats(day);
                            }
                          }}
                          className={`relative p-1.5 sm:p-3 flex flex-col justify-between border-r border-slate-200/60 dark:border-[#1C2430] transition-all duration-150 select-none ${
                            !isCurrent
                              ? 'opacity-25 bg-[#F7F8FA]/30 dark:bg-[#0A0E14]/30 cursor-default pointer-events-none'
                              : hasTrades
                              ? isPositive
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/40 cursor-pointer group shadow-inner'
                                : isNegative
                                ? 'bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-100/80 dark:hover:bg-rose-950/40 cursor-pointer group shadow-inner'
                                : 'bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-slate-100 dark:hover:bg-[#1C2430] cursor-pointer group'
                              : 'bg-transparent hover:bg-[#F7F8FA]/70 dark:hover:bg-[#181F2A]/40'
                          }`}
                        >
                          {/* Day Number */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] sm:text-xs font-bold tabular-nums font-mono ${
                                isCurrent
                                  ? 'text-[#1A1D23] dark:text-[#E6E8EB]'
                                  : 'text-[#9CA3AF] dark:text-[#64748B]'
                              }`}
                            >
                              {day.dayNumber}
                            </span>

                            {hasTrades && (
                              <span
                                className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full ${
                                  isPositive
                                    ? 'bg-[#10B981]'
                                    : isNegative
                                    ? 'bg-[#EF4444]'
                                    : 'bg-[#7C3AED] dark:bg-[#8B5CF6]'
                                }`}
                              />
                            )}
                          </div>

                          {/* Day P&L & Trades count */}
                          {hasTrades ? (
                            <div className="my-auto py-0.5 sm:py-1 text-center min-w-0">
                              <div
                                className={`text-[10px] sm:text-sm lg:text-base font-bold tabular-nums font-mono tracking-tight leading-tight truncate ${
                                  isPositive
                                    ? 'text-[#10B981]'
                                    : isNegative
                                    ? 'text-[#EF4444]'
                                    : 'text-[#6B7280] dark:text-[#8B92A0]'
                                }`}
                              >
                                {formatCurrency(day.netPnL, currency, { showSign: true })}
                              </div>
                              <div className="text-[8px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] mt-0.5 truncate">
                                {day.tradeCount} {day.tradeCount > 1 ? 'trades' : 'trade'}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}

                          {/* Bottom indicator spacer */}
                          <div className="h-0.5 sm:h-1" />
                        </div>
                      );
                    })}

                    {/* 8th Column: Weekly Recap */}
                    <div className="p-1.5 sm:p-3 bg-[#F7F8FA]/90 dark:bg-[#181F2A]/90 border-l border-slate-200/60 dark:border-[#1C2430] flex flex-col justify-center text-center min-w-0">
                      {week.totalTrades > 0 ? (
                        <div className="space-y-0.5 sm:space-y-1.5">
                          {/* Weekly Net PnL */}
                          <div
                            className={`text-[10px] sm:text-sm font-bold tabular-nums font-mono tracking-tight truncate ${
                              week.netPnL > 0
                                ? 'text-[#10B981]'
                                : week.netPnL < 0
                                ? 'text-[#EF4444]'
                                : 'text-[#6B7280] dark:text-[#8B92A0]'
                            }`}
                          >
                            {formatCurrency(week.netPnL, currency, { showSign: true })}
                          </div>

                          {/* Trade count */}
                          <div className="text-[8px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium truncate">
                            {week.totalTrades} {week.totalTrades > 1 ? 'trades' : 'trade'}
                          </div>

                          {/* Winrate bar */}
                          <div className="pt-0.5 sm:pt-1">
                            <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-[#6B7280] dark:text-[#8B92A0] mb-0.5 font-bold">
                              <span>Win</span>
                              <span className="font-bold font-mono text-[#1A1D23] dark:text-[#E6E8EB]">{week.winRate}%</span>
                            </div>
                            <div className="h-1 sm:h-1.5 w-full bg-slate-200/80 dark:bg-[#1E2532] rounded-full overflow-hidden flex">
                              <div
                                className="bg-[#7C3AED] dark:bg-[#8B5CF6] h-full transition-all duration-300"
                                style={{ width: `${week.winRate}%` }}
                              />
                              <div
                                className="bg-[#EF4444] h-full transition-all duration-300"
                                style={{ width: `${100 - week.winRate}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State when zero trades in this month */}
      {monthData.totalTrades === 0 && (
        <div className="bg-white dark:bg-[#131820] border border-dashed border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-8 text-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] flex items-center justify-center mx-auto text-[#6B7280] dark:text-[#8B92A0] mb-3">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#1A1D23] dark:text-[#E6E8EB]">
            Aucun trade enregistré en {monthData.monthLabel}
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#8B92A0] max-w-sm mx-auto mt-1">
            Naviguez vers les mois précédents/suivants ou importez vos relevés pour visualiser les performances journalières.
          </p>
        </div>
      )}

      {/* Day Details Modal */}
      <DayDetailsModal
        dayStats={selectedDayStats}
        currency={currency}
        onClose={() => setSelectedDayStats(null)}
        onSelectTrade={onSelectTrade}
      />
    </div>
  );
};

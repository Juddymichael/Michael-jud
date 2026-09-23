import React from 'react';
import { MonthTradeStats } from '../lib/calendar';
import { Trade } from '../types/trade';
import { formatCurrency, formatPercent } from '../lib/formatting';
import {
  X,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  TrendingUp,
  Award,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  monthStats: MonthTradeStats | null;
  currency?: string;
  onClose: () => void;
  onSelectTrade: (trade: Trade) => void;
  onOpenCalendarMonth?: (year: number, month: number) => void;
}

export const MonthDetailsModal: React.FC<Props> = ({
  monthStats,
  currency = 'EUR',
  onClose,
  onSelectTrade,
  onOpenCalendarMonth,
}) => {
  if (!monthStats) return null;

  const {
    monthLabel,
    year,
    month,
    netPnL,
    totalTrades,
    winRate,
    profitFactor,
    avgTradePnL,
    tradingDaysCount,
    winningDaysCount,
    losingDaysCount,
    bestDay,
    worstDay,
    weeks,
    trades,
  } = monthStats;

  return (
    <AnimatePresence>
      <div
        id="month-details-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          id="month-details-modal"
          className="bg-white dark:bg-[#131820] text-[#1A1D23] dark:text-[#E6E8EB] border border-slate-200/60 dark:border-[#1C2430] rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 flex flex-col font-sans"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200/60 dark:border-[#1C2430] flex items-center justify-between bg-[#F7F8FA] dark:bg-[#181F2A]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 flex items-center justify-center text-[#7C3AED] dark:text-[#8B5CF6]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#1A1D23] dark:text-[#E6E8EB] capitalize">
                  Bilan du {monthLabel}
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-normal">
                  Synthèse mensuelle des performances, semaines &amp; exécutions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenCalendarMonth && (
                <button
                  onClick={() => {
                    onOpenCalendarMonth(year, month);
                    onClose();
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <span>Vue Calendrier</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-2xl text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-200/60 dark:hover:bg-[#1C2430] transition cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-90px)]">
            {/* Top 4 KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Total P&L */}
              <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] block mb-1 uppercase tracking-wider">
                  P&amp;L Net Total
                </span>
                <span
                  className={`text-lg sm:text-xl font-bold tabular-nums font-mono block ${
                    netPnL > 0
                      ? 'text-[#10B981]'
                      : netPnL < 0
                      ? 'text-[#EF4444]'
                      : 'text-[#1A1D23] dark:text-[#E6E8EB]'
                  }`}
                >
                  {formatCurrency(netPnL, currency, { showSign: true })}
                </span>
              </div>

              {/* Total Trades & Winrate */}
              <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] block mb-1 uppercase tracking-wider">Trades &amp; Win Rate</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg sm:text-xl font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                    {totalTrades}
                  </span>
                  <span className="text-xs font-bold text-[#10B981] font-mono tabular-nums">
                    ({formatPercent(winRate, 1)})
                  </span>
                </div>
              </div>

              {/* Profit Factor */}
              <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] block mb-1 uppercase tracking-wider">
                  Profit Factor
                </span>
                <span className="text-lg sm:text-xl font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] block">
                  {profitFactor !== null ? profitFactor.toFixed(2) : 'N/A'}
                </span>
              </div>

              {/* Moyenne / Trade */}
              <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] block mb-1 uppercase tracking-wider">
                  Espérance / Trade
                </span>
                <span
                  className={`text-lg sm:text-xl font-bold tabular-nums font-mono block ${
                    avgTradePnL > 0
                      ? 'text-[#10B981]'
                      : avgTradePnL < 0
                      ? 'text-[#EF4444]'
                      : 'text-[#1A1D23] dark:text-[#E6E8EB]'
                  }`}
                >
                  {formatCurrency(avgTradePnL, currency, { showSign: true })}
                </span>
              </div>
            </div>

            {/* Middle Section: Synthèse par Semaine */}
            <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] mb-3">Synthèse par Semaine</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {weeks
                  .filter((w) => w.totalTrades > 0)
                  .map((w, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB]">Semaine {w.weekIndex}</span>
                        <span className="text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-medium">{w.totalTrades} trades</span>
                      </div>
                      <div
                        className={`text-base font-bold tabular-nums font-mono ${
                          w.netPnL > 0
                            ? 'text-[#10B981]'
                            : w.netPnL < 0
                            ? 'text-[#EF4444]'
                            : 'text-[#1A1D23] dark:text-[#E6E8EB]'
                        }`}
                      >
                        {formatCurrency(w.netPnL, currency, { showSign: true })}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#6B7280] dark:text-[#8B92A0] pt-1 border-t border-slate-200/60 dark:border-[#1C2430]">
                        <span>Win Rate:</span>
                        <span className="font-bold font-mono text-[#1A1D23] dark:text-[#E6E8EB]">{w.winRate}%</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Additional stats: Jours de trading & Extrêmes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] block mb-1 uppercase tracking-wider">
                  Jours de Trading
                </span>
                <span className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono block">
                  {tradingDaysCount} jours (<span className="text-[#10B981]">{winningDaysCount}G</span> / <span className="text-[#EF4444]">{losingDaysCount}P</span>)
                </span>
              </div>

              <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] block mb-1 uppercase tracking-wider">
                  Meilleure Journée
                </span>
                <span className="text-base font-bold text-[#10B981] tabular-nums font-mono block">
                  {bestDay ? formatCurrency(bestDay.netPnL, currency, { showSign: true }) : '—'}
                </span>
                {bestDay && (
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-mono">{bestDay.dateStr}</span>
                )}
              </div>

              <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] block mb-1 uppercase tracking-wider">
                  Pire Journée
                </span>
                <span
                  className={`text-base font-bold tabular-nums font-mono block ${
                    worstDay && worstDay.netPnL < 0 ? 'text-[#EF4444]' : 'text-[#1A1D23] dark:text-[#E6E8EB]'
                  }`}
                >
                  {worstDay ? formatCurrency(worstDay.netPnL, currency, { showSign: true }) : '—'}
                </span>
                {worstDay && (
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-mono">{worstDay.dateStr}</span>
                )}
              </div>
            </div>

            {/* Trades du mois Table */}
            <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200/60 dark:border-[#1C2430] bg-slate-100/60 dark:bg-[#131820] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB]">Trades du Mois</h3>
                <span className="text-xs text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-medium">
                  {trades.length} positions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F8FA] dark:bg-[#181F2A] border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">DATE</th>
                      <th className="py-3 px-4">TYPE</th>
                      <th className="py-3 px-4">PAIRE</th>
                      <th className="py-3 px-4">SETUP</th>
                      <th className="py-3 px-4">P&amp;L</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-[#1C2430] font-sans">
                    {trades.map((trade) => {
                      const isBuy = trade.direction === 'BUY';
                      const pnl = trade.netPnL ?? 0;
                      const dateFormatted = trade.closedAt || trade.openedAt || '';

                      return (
                        <tr key={trade.id} className="hover:bg-slate-100 dark:hover:bg-[#1C2430] transition">
                          <td className="py-3 px-4 whitespace-nowrap text-[#6B7280] dark:text-[#8B92A0] font-mono text-[11px]">
                            {dateFormatted.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                isBuy
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-[#10B981] border border-emerald-200 dark:border-emerald-500/20'
                                  : 'bg-rose-50 dark:bg-rose-500/10 text-[#EF4444] border border-rose-200 dark:border-rose-500/20'
                              }`}
                            >
                              {isBuy ? 'LONG' : 'SHORT'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                            {trade.symbol}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-[#6B7280] dark:text-[#8B92A0]">
                            {trade.setup || '—'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-bold font-mono tabular-nums">
                            <span
                              className={
                                pnl > 0
                                  ? 'text-[#10B981]'
                                  : pnl < 0
                                  ? 'text-[#EF4444]'
                                  : 'text-[#1A1D23] dark:text-[#E6E8EB]'
                              }
                            >
                              {formatCurrency(pnl, currency, { showSign: true })}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => onSelectTrade(trade)}
                              className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#8B92A0] hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-slate-200/60 dark:hover:bg-[#1C2430] transition cursor-pointer"
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

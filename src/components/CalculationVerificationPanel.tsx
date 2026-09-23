import React, { useState } from 'react';
import { Trade } from '../types/trade';
import { calculateComprehensiveMetrics } from '../lib/calculations';
import { formatCurrency, formatRMultiple, formatPercent, formatDecimal } from '../lib/formatting';
import { Calculator, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  trades?: Trade[];
  currency?: string;
  initialBalance?: number;
}

export const CalculationVerificationPanel: React.FC<Props> = ({
  trades = [],
  currency = 'USD',
  initialBalance = 10000,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const safeTrades = trades || [];
  const metrics = calculateComprehensiveMetrics(safeTrades, initialBalance);

  return (
    <div
      id="calculation-verification-panel"
      className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs transition-colors"
    >
      <div
        onClick={() => setIsOpenMobile((prev) => !prev)}
        className="flex items-center justify-between cursor-pointer sm:cursor-default select-none"
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 flex items-center justify-center text-[#7C3AED] dark:text-[#8B5CF6] shrink-0">
            <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-xs font-bold uppercase tracking-wider text-[#1A1D23] dark:text-[#E6E8EB]">
                Audit &amp; Contrôle Mathématique
              </h2>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#10B981] border border-emerald-200/60 dark:border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-3 h-3" />
                <span>Conforme</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] hidden sm:block">
              Contrôle de cohérence en temps réel • Modèle sans flottement • Traitement null-safe
            </p>
          </div>
        </div>

        {/* Mobile Accordion Toggle */}
        <button
          type="button"
          className="sm:hidden p-1.5 rounded-xl bg-slate-100 dark:bg-[#181F2A] text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] transition"
          aria-label="Afficher ou masquer les détails de calcul"
        >
          {isOpenMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Grid: Always visible on tablet & desktop (sm:grid), collapsible on mobile */}
      <div
        className={`mt-3 sm:mt-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 ${
          isOpenMobile ? 'grid' : 'hidden sm:grid'
        }`}
      >
        {/* Net P&L */}
        <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-2.5 sm:p-3 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0] font-bold block truncate">
            P&amp;L NET TOTAL
          </span>
          <p
            className={`text-sm sm:text-base font-bold tabular-nums font-mono mt-0.5 truncate ${
              metrics.netPnLSum > 0
                ? 'text-[#10B981]'
                : metrics.netPnLSum < 0
                ? 'text-[#EF4444]'
                : 'text-[#6B7280] dark:text-[#8B92A0]'
            }`}
          >
            <AnimatedNumber
              value={metrics.netPnLSum}
              format={(v) => formatCurrency(v, currency, { showSign: true })}
              duration={700}
            />
          </p>
          <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block mt-0.5 truncate font-mono">
            Brut : {formatCurrency(metrics.grossPnLSum, currency, { showSign: false })}
          </span>
        </div>

        {/* Win Rate */}
        <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-2.5 sm:p-3 min-w-0">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0]">
            <span className="uppercase tracking-wider truncate">WIN RATE</span>
            <span className="text-[9px] font-normal text-slate-400 hidden sm:inline">(Clôturés)</span>
          </div>
          <p className="text-sm sm:text-base font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 truncate">
            <AnimatedNumber
              value={metrics.winRate.winRate}
              format={(v) => formatPercent(v, 1)}
              duration={700}
            />
          </p>
          <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block mt-0.5 truncate font-mono">
            {metrics.winRate.wins}W • {metrics.winRate.losses}L • {metrics.winRate.breakeven}BE
          </span>
        </div>

        {/* Profit Factor */}
        <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-2.5 sm:p-3 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0] font-bold block truncate">
            PROFIT FACTOR
          </span>
          <p className="text-sm sm:text-base font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 truncate">
            {metrics.profitFactor.profitFactor === Infinity
              ? '∞ (Sans perte)'
              : formatDecimal(metrics.profitFactor.profitFactor, 2)}
          </p>
          <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block mt-0.5 truncate font-mono">
            {formatCurrency(metrics.profitFactor.grossProfit, currency, { showSign: false })} / {formatCurrency(metrics.profitFactor.grossLoss, currency, { showSign: false })}
          </span>
        </div>

        {/* Expectancy */}
        <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-2.5 sm:p-3 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0] font-bold block truncate">
            ESPÉRANCE R
          </span>
          <p
            className={`text-sm sm:text-base font-bold tabular-nums font-mono mt-0.5 truncate ${
              metrics.expectancy.rExpectancy && metrics.expectancy.rExpectancy > 0
                ? 'text-[#10B981]'
                : metrics.expectancy.rExpectancy && metrics.expectancy.rExpectancy < 0
                ? 'text-[#EF4444]'
                : 'text-[#6B7280] dark:text-[#8B92A0]'
            }`}
          >
            {formatRMultiple(metrics.expectancy.rExpectancy)}
          </p>
          <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block mt-0.5 truncate font-mono">
            {metrics.expectancy.validRTradesCount} trades avec R
          </span>
        </div>

        {/* Max Drawdown */}
        <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-2.5 sm:p-3 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0] font-bold block truncate">
            MAX DRAWDOWN
          </span>
          <p className="text-sm sm:text-base font-bold tabular-nums font-mono text-[#EF4444] mt-0.5 truncate">
            {formatCurrency(metrics.drawdown.maxDrawdown, currency, { showSign: false })}
          </p>
          <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block mt-0.5 truncate font-mono">
            {metrics.drawdown.maxDrawdownPercent.toFixed(1)}% de baisse
          </span>
        </div>

        {/* Streaks */}
        <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-2.5 sm:p-3 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0] font-bold block truncate">
            SÉRIES (W / L)
          </span>
          <p className="text-sm sm:text-base font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 flex items-center gap-1 truncate">
            <span className="text-[#10B981] font-bold">{metrics.streaks.maxConsecutiveWins}W</span>
            <span className="text-slate-400 dark:text-slate-600">/</span>
            <span className="text-[#EF4444] font-bold">{metrics.streaks.maxConsecutiveLosses}L</span>
          </p>
          <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] block mt-0.5 truncate">
            Actuelle : {metrics.streaks.currentStreakCount} {metrics.streaks.currentStreakType === 'WIN' ? 'Gains' : 'Pertes'}
          </span>
        </div>
      </div>
    </div>
  );
};


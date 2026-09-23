import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  BrainCircuit,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Clock,
  Calendar,
  Layers,
  BarChart3,
  Target,
  CheckCircle2,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Sliders,
  DollarSign,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Line,
  ComposedChart,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Trade } from '../types/trade';
import { Setup } from '../types/setup';
import { buildCoachContext } from '../lib/coachContext';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import { calculateAIAnalysisCharts } from '../lib/calculations/aiCharts';
import { formatCurrency, formatPercent } from '../lib/formatting';

interface AIAnalysisViewProps {
  trades: Trade[];
  setups: Setup[];
  initialBalance: number;
  userTimezone?: string;
  postLossAlertWindowMinutes?: number;
}

type TabType = 'analyse' | 'graphiques' | 'recommandations';

export const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({
  trades,
  setups,
  initialBalance,
  userTimezone = 'Indian/Antananarivo',
  postLossAlertWindowMinutes = 60,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('analyse');

  // Build full quantified trading context
  const coachContext = useMemo(() => {
    return buildCoachContext(trades, setups, initialBalance, postLossAlertWindowMinutes);
  }, [trades, setups, initialBalance, postLossAlertWindowMinutes]);

  // Calculations for charts, indicators, and leak alerts
  const chartData = useMemo(() => {
    return calculateAIAnalysisCharts(trades, userTimezone);
  }, [trades, userTimezone]);

  // AI Hook for Gemini Executive Report
  const { report, isAnalyzing, error, lastAnalyzedAt, isUsingFallback, runAnalysis } = useAIAnalysis();

  // Auto-run analysis on initial mount if not yet analyzed
  useEffect(() => {
    if (!report && trades.length > 0 && !isAnalyzing) {
      runAnalysis(coachContext);
    }
  }, [report, trades.length, coachContext, isAnalyzing, runAnalysis]);

  const handleRefreshAnalysis = () => {
    runAnalysis(coachContext, true);
  };

  const closedCount = coachContext.summary.closedTrades;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Horizontal Tab Navigation */}
      <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7C3AED] dark:bg-[#8B5CF6] flex items-center justify-center text-white shadow-xs">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                  Analyse IA & Audit de Performance
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded-full bg-violet-50 dark:bg-violet-950/60 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/50">
                  SMC & Quant
                </span>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-[#8B92A0]">
                Diagnostic approfondi de votre edge statistique, sessions et discipline
              </p>
            </div>
          </div>

          {/* Action button & Status */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {lastAnalyzedAt && (
              <div className="text-right hidden sm:block">
                <p className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] font-mono">
                  Dernière analyse
                </p>
                <p className="text-xs font-semibold text-[#1A1D23] dark:text-[#E6E8EB] font-mono tabular-nums">
                  {new Date(lastAnalyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
            <button
              onClick={handleRefreshAnalysis}
              disabled={isAnalyzing || trades.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl text-white bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Analyse en cours...' : 'Rafraîchir l’analyse'}</span>
            </button>
          </div>
        </div>

        {/* 3 Horizontal Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#1C2430] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('analyse')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'analyse'
                ? 'bg-[#7C3AED] dark:bg-[#8B5CF6] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#8B92A0] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Analyse</span>
          </button>

          <button
            onClick={() => setActiveTab('graphiques')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'graphiques'
                ? 'bg-[#7C3AED] dark:bg-[#8B5CF6] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#8B92A0] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Graphiques</span>
          </button>

          <button
            onClick={() => setActiveTab('recommandations')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'recommandations'
                ? 'bg-[#7C3AED] dark:bg-[#8B5CF6] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#8B92A0] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Recommandations</span>
            {chartData.recommendations.some((r) => r.severity === 'CRITICAL') && (
              <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {/* ======================= TAB 1: ANALYSE ======================= */}
        {activeTab === 'analyse' && (
          <motion.div
            key="tab-analyse"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            {/* Executive Synthesis Card */}
            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-[#1C2430]">
                {/* Left: Summary text */}
                <div className="space-y-3 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-[#7C3AED] dark:text-[#8B5CF6]">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#8B5CF6] font-mono">
                      Synthèse Exécutive
                    </h3>
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed text-[#1A1D23] dark:text-[#E6E8EB]">
                    {report?.executiveSummary ||
                      'Veuillez cliquer sur "Rafraîchir l’analyse" pour générer la synthèse complète de votre historique de trading.'}
                  </p>
                </div>

                {/* Right: Edge Score Gauge / Badge */}
                <div className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3.5 sm:p-5 flex items-center justify-between sm:justify-start gap-3 sm:gap-4 shrink-0 w-full sm:w-auto">
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-14 h-14 sm:w-16 sm:h-16 transform -rotate-90">
                      <circle
                        cx="28"
                        cy="28"
                        r="23"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        fill="transparent"
                        className="text-slate-200 dark:text-slate-800 sm:hidden"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r="23"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        fill="transparent"
                        strokeDasharray="144.5"
                        strokeDashoffset={144.5 - (144.5 * (report?.edgeScore || chartData.keyIndicators.edgeScore)) / 100}
                        strokeLinecap="round"
                        className="text-violet-500 sm:hidden"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="transparent"
                        className="text-slate-200 dark:text-slate-800 hidden sm:block"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="transparent"
                        strokeDasharray="163.36"
                        strokeDashoffset={163.36 - (163.36 * (report?.edgeScore || chartData.keyIndicators.edgeScore)) / 100}
                        strokeLinecap="round"
                        className="text-violet-500 hidden sm:block"
                      />
                    </svg>
                    <span className="absolute text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {report?.edgeScore || chartData.keyIndicators.edgeScore}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Score d’Edge
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-violet-600 dark:text-violet-400 truncate block">
                      {report?.verdictKey || (chartData.keyIndicators.edgeScore >= 75 ? 'Edge Confirmé' : 'En Optimisation')}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                      sur {closedCount} trades
                    </span>
                  </div>
                </div>
              </div>

              {/* Points Forts vs Axes d'Amélioration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                {/* Points Forts */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Points Forts Identifiés (3)
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {(report?.strengths || [
                      'Discipline globale constante sur la taille de position',
                      'Excellente gestion du risque sur les sessions principales',
                      'Espérance mathématique positive',
                    ]).map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Axes d'Amélioration */}
                <div className="bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-800/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-pink-700 dark:text-pink-300">
                    <Target className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Axes d’Amélioration Prioritaires (3)
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {(report?.improvements || [
                      'Éliminer les prises de position en dehors des sessions Killzones',
                      'Éviter le revenge trading immédiatement après un stop loss',
                      'Améliorer le ratio R:R moyen sur les setups secondaires',
                    ]).map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actionable Golden Rule */}
              {report?.actionableRule && (
                <div className="mt-5 p-3.5 bg-violet-50/70 dark:bg-[#181F2A] border border-violet-200/60 dark:border-[#1C2430] rounded-xl flex items-center gap-3">
                  <Zap className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0" />
                  <p className="text-xs font-semibold text-[#1A1D23] dark:text-[#E6E8EB]">
                    <span className="text-[#7C3AED] dark:text-[#8B5CF6] font-bold font-mono">Règle d’Or : </span>
                    {report.actionableRule}
                  </p>
                </div>
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {/* Metric 1 */}
              <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                  P&L Net
                </span>
                <p
                  className={`text-sm sm:text-base lg:text-lg font-black mt-0.5 sm:mt-1 font-mono tabular-nums truncate ${
                    coachContext.summary.netPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}
                  title={formatCurrency(coachContext.summary.netPnL)}
                >
                  {formatCurrency(coachContext.summary.netPnL)}
                </p>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block truncate">Total cumulé</span>
              </div>

              {/* Metric 2 */}
              <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                  Win Rate
                </span>
                <p className="text-sm sm:text-base lg:text-lg font-black text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 sm:mt-1 font-mono tabular-nums truncate">
                  {formatPercent(coachContext.summary.winRate)}
                </p>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block truncate">
                  {coachContext.summary.wins}W / {coachContext.summary.losses}L
                </span>
              </div>

              {/* Metric 3 */}
              <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                  Profit Factor
                </span>
                <p className="text-sm sm:text-base lg:text-lg font-black text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 sm:mt-1 font-mono tabular-nums truncate">
                  {coachContext.summary.profitFactor !== null
                    ? coachContext.summary.profitFactor.toFixed(2)
                    : 'N/A'}
                </p>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block truncate">Gains / Pertes</span>
              </div>

              {/* Metric 4 */}
              <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                  Discipline
                </span>
                <p className="text-sm sm:text-base lg:text-lg font-black text-[#7C3AED] dark:text-[#8B5CF6] mt-0.5 sm:mt-1 font-mono tabular-nums truncate">
                  {coachContext.summary.disciplineRate}%
                </p>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block truncate">Sans faute déclarée</span>
              </div>

              {/* Metric 5 */}
              <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                  Espérance R
                </span>
                <p className="text-sm sm:text-base lg:text-lg font-black text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 sm:mt-1 font-mono tabular-nums truncate">
                  {coachContext.summary.rExpectancy !== null
                    ? `${coachContext.summary.rExpectancy > 0 ? '+' : ''}${coachContext.summary.rExpectancy.toFixed(2)} R`
                    : 'N/A'}
                </p>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block truncate">Moyenne par trade</span>
              </div>

              {/* Metric 6 */}
              <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                  Max Drawdown
                </span>
                <p className="text-sm sm:text-base lg:text-lg font-black text-[#EF4444] mt-0.5 sm:mt-1 font-mono tabular-nums truncate">
                  -{formatPercent(coachContext.summary.maxDrawdownPercent)}
                </p>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block truncate">
                  {formatCurrency(coachContext.summary.maxDrawdownMoney)}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ======================= TAB 2: GRAPHIQUES ======================= */}
        {activeTab === 'graphiques' && (
          <motion.div
            key="tab-graphiques"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Chart 1: Performance par Killzone */}
            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <span>Performance par Killzone</span>
                  </h3>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#8B92A0]">
                    Calcul automatique basé sur l&apos;heure d&apos;ouverture (UTC+3)
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.sessionChartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1C2430" vertical={false} opacity={0.5} />
                    <XAxis
                      dataKey="session"
                      tick={{ fill: '#8B92A0', fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fill: '#8B92A0', fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-3 text-xs shadow-xl text-[#1A1D23] dark:text-[#E6E8EB] space-y-1">
                              <p className="font-bold text-[#7C3AED] dark:text-[#8B5CF6]">{data.session}</p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">P&L Net :</span>
                                <span className={`font-bold font-mono ${data.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                  {formatCurrency(data.pnl)}
                                </span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">Trades :</span>
                                <span className="font-bold font-mono">{data.trades}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                                <span className="font-bold font-mono">{formatPercent(data.winRate)}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#64748B" />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      {chartData.sessionChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'}
                          opacity={entry.trades === 0 ? 0.2 : 0.9}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Performance par Timeframe */}
            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <span>Performance par Timeframe</span>
                  </h3>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#8B92A0]">
                    Distribution de la rentabilité par unité de temps
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.timeframeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1C2430" vertical={false} opacity={0.5} />
                    <XAxis dataKey="timeframe" tick={{ fill: '#8B92A0', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8B92A0', fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-3 text-xs shadow-xl text-[#1A1D23] dark:text-[#E6E8EB] space-y-1">
                              <p className="font-bold text-[#7C3AED] dark:text-[#8B5CF6]">{data.timeframe}</p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">P&L Net :</span>
                                <span className={`font-bold font-mono ${data.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                  {formatCurrency(data.pnl)}
                                </span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">Trades :</span>
                                <span className="font-bold font-mono">{data.trades}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                                <span className="font-bold font-mono">{formatPercent(data.winRate)}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#64748B" />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      {chartData.timeframeChartData.map((entry, index) => (
                        <Cell
                          key={`cell-tf-${index}`}
                          fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Performance par Jour de la Semaine */}
            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <span>Performance par Jour de la Semaine</span>
                  </h3>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#8B92A0]">
                    P&L cumulé du Lundi au Vendredi
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.dayOfWeekChartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1C2430" vertical={false} opacity={0.5} />
                    <XAxis dataKey="day" tick={{ fill: '#8B92A0', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8B92A0', fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-3 text-xs shadow-xl text-[#1A1D23] dark:text-[#E6E8EB] space-y-1">
                              <p className="font-bold text-[#7C3AED] dark:text-[#8B5CF6]">{data.day}</p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">P&L Net :</span>
                                <span className={`font-bold font-mono ${data.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                  {formatCurrency(data.pnl)}
                                </span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">Trades :</span>
                                <span className="font-bold font-mono">{data.trades}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                                <span className="font-bold font-mono">{formatPercent(data.winRate)}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#64748B" />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      {chartData.dayOfWeekChartData.map((entry, index) => (
                        <Cell
                          key={`cell-day-${index}`}
                          fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Performance par Heure de la Journée */}
            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1A1D23] dark:text-[#E6E8EB] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <span>Performance par Heure de la Journée</span>
                  </h3>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#8B92A0]">
                    Détection des heures d'or vs créneaux de pertes
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.hourlyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1C2430" vertical={false} opacity={0.5} />
                    <XAxis dataKey="hour" tick={{ fill: '#8B92A0', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#8B92A0', fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-xl p-3 text-xs shadow-xl text-[#1A1D23] dark:text-[#E6E8EB] space-y-1">
                              <p className="font-bold text-[#7C3AED] dark:text-[#8B5CF6]">Heure : {data.hour}</p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">P&L Net :</span>
                                <span className={`font-bold font-mono ${data.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                  {formatCurrency(data.pnl)}
                                </span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-[#6B7280] dark:text-[#8B92A0]">Trades :</span>
                                <span className="font-bold font-mono">{data.trades}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#64748B" />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {chartData.hourlyChartData.map((entry, index) => (
                        <Cell
                          key={`cell-hr-${index}`}
                          fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {/* ======================= TAB 3: RECOMMANDATIONS ======================= */}
        {activeTab === 'recommandations' && (
          <motion.div
            key="tab-recommandations"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            {/* Top 5 Key Indicators */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                5 Indicateurs Clés de Discipline & Psychologie
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* Indicator 1: Discipline */}
                <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2 min-w-0">
                  <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                    1. Taux de Discipline
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg sm:text-xl font-black text-[#7C3AED] dark:text-[#8B5CF6] font-mono tabular-nums">
                      {chartData.keyIndicators.disciplineRate}%
                    </span>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">Obj. &gt; 85%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-[#181F2A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full"
                      style={{ width: `${Math.min(100, chartData.keyIndicators.disciplineRate)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                    Trades sans faute déclarée
                  </p>
                </div>

                {/* Indicator 2: Stop Loss Respect */}
                <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2 min-w-0">
                  <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                    2. Respect du Stop Loss
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg sm:text-xl font-black text-[#10B981] font-mono tabular-nums">
                      {chartData.keyIndicators.stopLossRespectRate}%
                    </span>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">Obj. 100%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-[#181F2A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#10B981] rounded-full"
                      style={{ width: `${Math.min(100, chartData.keyIndicators.stopLossRespectRate)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                    Sans SL déplacé ni oublié
                  </p>
                </div>

                {/* Indicator 3: Post-Loss Management */}
                <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2 min-w-0">
                  <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                    3. Gestion Post-Perte
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-lg sm:text-xl font-black font-mono tabular-nums ${
                        chartData.keyIndicators.postLossDisparity >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {chartData.keyIndicators.postLossWinRate}%
                    </span>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                      vs {chartData.keyIndicators.globalWinRate}% glob.
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-[#181F2A] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        chartData.keyIndicators.postLossDisparity >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                      }`}
                      style={{ width: `${Math.min(100, chartData.keyIndicators.postLossWinRate)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                    Winrate après un SL
                  </p>
                </div>

                {/* Indicator 4: Selectivity */}
                <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2 min-w-0">
                  <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                    4. Sélectivité
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg sm:text-xl font-black text-[#1A1D23] dark:text-[#E6E8EB] font-mono tabular-nums">
                      {chartData.keyIndicators.avgTradesPerDay} <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0]">tr/j</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate ${
                        chartData.keyIndicators.overtradingRisk === 'FAIBLE'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}
                    >
                      {chartData.keyIndicators.overtradingRisk}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-[#181F2A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full"
                      style={{ width: `${Math.min(100, chartData.keyIndicators.avgTradesPerDay * 20)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                    Risque d'overtrading
                  </p>
                </div>

                {/* Indicator 5: Edge Score */}
                <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2 min-w-0">
                  <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#8B92A0] uppercase tracking-wider block truncate">
                    5. Score d'Edge
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg sm:text-xl font-black text-[#7C3AED] dark:text-[#8B5CF6] tabular-nums font-mono">
                      {chartData.keyIndicators.edgeScore}/100
                    </span>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">Solide</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-[#181F2A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full"
                      style={{ width: `${chartData.keyIndicators.edgeScore}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                    Avantage statistique
                  </p>
                </div>
              </div>
            </div>

            {/* Pattern-Based Leak Detection Alerts & Recommendations List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0]">
                Alertes de Fuites de Capital & Actions Correctives
              </h3>

              <div className="space-y-3">
                {chartData.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 min-w-0 overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {rec.severity === 'CRITICAL' ? (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 shrink-0">
                            CRITIQUE
                          </span>
                        ) : rec.severity === 'IMPORTANT' ? (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-400 border border-pink-200 dark:border-pink-900/50 shrink-0">
                            IMPORTANT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 shrink-0">
                            SUGGESTION
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-slate-400 shrink-0">
                          • {rec.category}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">
                          {rec.title}
                        </h4>
                      </div>

                      <span className="text-[11px] sm:text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2.5 py-1 rounded-lg border border-pink-200/50 dark:border-pink-800/40 shrink-0 self-start sm:self-auto tabular-nums">
                        {rec.impactEstimate}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {rec.description}
                    </p>

                    <div className="bg-[#F7F8FA] dark:bg-[#181F2A] rounded-xl p-3 border border-slate-200/60 dark:border-[#1C2430] flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-[#1A1D23] dark:text-[#E6E8EB]">
                        <strong className="text-[#7C3AED] dark:text-[#8B5CF6] font-bold">Action corrective : </strong>
                        {rec.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

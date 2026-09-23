import React, { useState } from 'react';
import { Trade } from '../types/trade';
import { DataQualityBadge } from './DataQualityBadge';
import {
  formatCurrency,
  formatRMultiple,
  formatPercent,
  formatKillzone,
  formatIrlErl,
  formatHtfBias,
  formatTechnicalValue,
} from '../lib/formatting';
import { calculateRiskReward, isTradeRRComplete } from '../lib/calculations/riskReward';
import { normalizeChartUrl } from '../lib/imageUtils';
import {
  X,
  Copy,
  Check,
  Fingerprint,
  Layers,
  Activity,
  DollarSign,
  Brain,
  Code,
  Scale,
  Camera,
  Link2,
  ExternalLink,
  Maximize2,
  Clock,
  Crosshair,
  AlertCircle,
} from 'lucide-react';

interface TradeDetailModalProps {
  trade: Trade | null;
  currency?: string;
  onClose: () => void;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  trade,
  currency = 'EUR',
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'smc' | 'financials' | 'psychology' | 'raw'>('overview');

  if (!trade) return null;

  const rr = calculateRiskReward({
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    exitPrice: trade.exitPrice,
  });
  const plannedRR = trade.plannedRR ?? rr.plannedRR;
  const realizedRR = trade.realizedRR ?? rr.realizedRR;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(trade, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderValue = (val: unknown, fallback = 'Non renseigné') => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-400 dark:text-slate-500 italic font-normal">{fallback}</span>;
    }
    if (typeof val === 'boolean') {
      return val ? (
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-[11px]">Oui</span>
      ) : (
        <span className="text-slate-500 dark:text-slate-400 font-normal px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">Non</span>
      );
    }
    const formatted = formatTechnicalValue(val, fallback);
    return <span className="text-slate-900 dark:text-slate-100 font-medium tabular-nums font-mono">{formatted}</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      id="trade-detail-modal"
    >
      <div className="bg-white dark:bg-[#101827] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-xs shadow-xs ${
                trade.direction === 'BUY'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
              }`}
            >
              {trade.direction === 'BUY' ? 'LONG' : 'SHORT'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {trade.symbol}
                </h3>
                <span className="text-xs text-slate-400 font-normal tabular-nums font-mono">
                  #{trade.ticket ?? trade.id.slice(0, 8)}
                </span>
                <DataQualityBadge quality={trade.dataQuality} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                {new Date(trade.openedAt).toISOString().slice(0, 16).replace('T', ' ')} • {formatKillzone(trade.killzone || trade.session)} • {trade.timeframe ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'JSON'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-900/30">
          {[
            { id: 'overview', label: 'Overview & Execution', icon: Activity },
            { id: 'smc', label: 'Setup & ICT / SMC', icon: Layers },
            { id: 'financials', label: 'PnL & Risk', icon: DollarSign },
            { id: 'psychology', label: 'Review & Psychology', icon: Brain },
            { id: 'raw', label: 'Database Audit', icon: Code },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 px-3 text-xs border-b-2 transition cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400 dark:text-slate-500 block">NET P&amp;L</span>
                  <p className={`text-base font-semibold tabular-nums mt-0.5 ${
                    trade.netPnL && trade.netPnL > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : trade.netPnL && trade.netPnL < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500'
                  }`}>
                    {formatCurrency(trade.netPnL, currency)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400 dark:text-slate-500 block">R MULTIPLE</span>
                  {trade.status === 'CLOSED' && !isTradeRRComplete(trade) ? (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Données incomplètes
                      </span>
                    </div>
                  ) : (
                    <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatRMultiple(trade.rMultiple)}
                    </p>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400 dark:text-slate-500 block">ENTRY PRICE</span>
                  <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {trade.entryPrice !== null ? trade.entryPrice : 'Not recorded'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400 dark:text-slate-500 block">EXIT PRICE</span>
                  <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {trade.exitPrice !== null ? trade.exitPrice : 'Open Position'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">Position Attributes</h4>
                  <div className="space-y-1.5 font-normal">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Stop Loss:</span>
                      {renderValue(trade.stopLoss)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Take Profit:</span>
                      {renderValue(trade.takeProfit)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Quantity / Lots:</span>
                      {renderValue(trade.quantity ?? trade.lotSize)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contract Size:</span>
                      {renderValue(trade.contractSize)}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">Execution Timestamps</h4>
                  <div className="space-y-1.5 font-normal">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Opened At:</span>
                      <span className="tabular-nums text-slate-800 dark:text-slate-200">{new Date(trade.openedAt).toISOString().slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Closed At:</span>
                      <span className="tabular-nums text-slate-800 dark:text-slate-200">
                        {trade.closedAt ? new Date(trade.closedAt).toISOString().slice(0, 16).replace('T', ' ') : 'Running (Open)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Timezone:</span>
                      <span className="text-slate-800 dark:text-slate-200">{trade.timezone}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk / Reward Analysis (RR Visé vs RR Réalisé) */}
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-[#F7F8FA] dark:bg-[#181F2A] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <span className="font-semibold text-[#1A1D23] dark:text-[#E6E8EB] text-xs font-mono uppercase tracking-wider">
                      Analyse du Ratio Risque / Rendement
                    </span>
                  </div>
                  {rr.riskDistance !== null && (
                    <span className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-mono">
                      Distance Risque (SL) : <strong className="text-[#EF4444] font-bold">{rr.riskDistance} pts</strong>
                      {rr.rewardDistance !== null && (
                        <> • Objectif (TP) : <strong className="text-[#10B981] font-bold">{rr.rewardDistance} pts</strong></>
                      )}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Planned RR */}
                  <div className="p-3 rounded-xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#7C3AED] dark:text-[#8B5CF6] block font-mono">
                        RR VISÉ (Planifié au TP)
                      </span>
                      <p className="text-xl font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono mt-0.5">
                        {plannedRR !== null && plannedRR !== undefined ? `${plannedRR}R` : 'Non défini'}
                      </p>
                    </div>
                    {plannedRR !== null && plannedRR !== undefined && (
                      <span className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] text-xs font-bold tabular-nums font-mono border border-violet-200/60 dark:border-violet-800/40">
                        1:{plannedRR}
                      </span>
                    )}
                  </div>

                  {/* Realized RR */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    realizedRR !== null && realizedRR !== undefined && realizedRR > 0
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : realizedRR !== null && realizedRR !== undefined && realizedRR < 0
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                  }`}>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                        RR RÉALISÉ (Sortie Réelle)
                      </span>
                      <p className={`text-xl font-bold tabular-nums mt-0.5 ${
                        realizedRR !== null && realizedRR !== undefined && realizedRR > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : realizedRR !== null && realizedRR !== undefined && realizedRR < 0
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}>
                        {realizedRR !== null && realizedRR !== undefined ? `${realizedRR}R` : trade.status === 'OPEN' ? 'Position En Cours' : 'Non calculable'}
                      </p>
                    </div>
                    {realizedRR !== null && plannedRR !== null && plannedRR > 0 && (
                      <div className="text-right">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${
                          realizedRR >= plannedRR
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {realizedRR >= plannedRR
                            ? 'Objectif atteint ✓'
                            : `${Math.round((realizedRR / plannedRR) * 100)}% du TP`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Proof Section */}
              {(trade.screenshotBefore || trade.tradingViewUrl) && (
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                        Preuve Visuelle du Setup
                      </h4>
                    </div>
                    {trade.tradingViewUrl && (
                      <a
                        href={normalizeChartUrl(trade.tradingViewUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ouvrir sur TradingView</span>
                      </a>
                    )}
                  </div>

                  {trade.screenshotBefore && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                        Capture d&apos;écran du graphique à l&apos;entrée :
                      </span>
                      <div
                        className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer max-h-64 flex items-center justify-center shadow-xs"
                        onClick={() => setZoomImage(trade.screenshotBefore)}
                        title="Cliquer pour voir en plein écran"
                      >
                        <img
                          src={trade.screenshotBefore}
                          alt="Capture d'écran de l'entrée"
                          className="w-full h-auto max-h-64 object-contain transition duration-200 group-hover:scale-101"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white gap-2 font-medium text-xs">
                          <Maximize2 className="w-4 h-4" />
                          <span>Agrandir l&apos;image</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SETUP & SMC CONTEXT */}
          {activeTab === 'smc' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Trading Setup Model</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {trade.setup ?? 'Unassigned Setup'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {trade.timeframe && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-500/30 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>TF : {trade.timeframe}</span>
                      </span>
                    )}
                    {trade.entryTrigger && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold border border-violet-200 dark:border-violet-500/30 text-xs">
                        <Crosshair className="w-3 h-3" />
                        <span>Trigger : {trade.entryTrigger}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">Market Context &amp; Bias</h4>
                  <div className="space-y-1.5 font-normal">
                    <div className="flex justify-between">
                      <span className="text-slate-500">HTF Narrative / Bias:</span>
                      {renderValue(trade.htfBias)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Killzone:</span>
                      {renderValue(trade.killzone || trade.session)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Liquidity Sweep Taken:</span>
                      {renderValue(trade.liquidityTaken)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">IRL / ERL Framework:</span>
                      {renderValue(trade.irlErl)}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">ICT / SMC Mechanics</h4>
                  <div className="space-y-1.5 font-normal">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Displacement:</span>
                      {renderValue(trade.displacement)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Market Structure Shift (MSS):</span>
                      {renderValue(trade.mss)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CISD:</span>
                      {renderValue(trade.cisd)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fair Value Gap (FVG):</span>
                      {renderValue(trade.fvg)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Inverse FVG (IFVG):</span>
                      {renderValue(trade.ifvg)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Order Block (OB):</span>
                      {renderValue(trade.ob)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">Entry &amp; Target Strategy</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-medium tracking-wider block">Entry Model:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-normal">{trade.entryModel ?? 'Not recorded'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-medium tracking-wider block">SL Model:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-normal">{trade.slModel ?? 'Not recorded'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-medium tracking-wider block">TP Model:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-normal">{trade.tpModel ?? 'Not recorded'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIALS */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">Accounting &amp; Fees</h4>
                  <div className="space-y-1.5 font-normal">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross P&amp;L:</span>
                      {renderValue(trade.grossPnL !== null ? formatCurrency(trade.grossPnL, currency) : null)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Commission:</span>
                      {renderValue(trade.commission !== null ? formatCurrency(trade.commission, currency) : null)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Swap / Financing:</span>
                      {renderValue(trade.swap !== null ? formatCurrency(trade.swap, currency) : null)}
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 font-medium">
                      <span className="text-slate-700 dark:text-slate-300">Net P&amp;L:</span>
                      <span className={`tabular-nums font-semibold ${trade.netPnL && trade.netPnL > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(trade.netPnL, currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">Risk Management Metrics</h4>
                  <div className="space-y-1.5 font-normal">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Initial Risk Amount:</span>
                      {renderValue(trade.initialRiskAmount !== null ? formatCurrency(trade.initialRiskAmount, currency) : null)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Risk Percent (%):</span>
                      {renderValue(trade.riskPercent !== null ? formatPercent(trade.riskPercent, 2) : null)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">R-Multiple:</span>
                      {renderValue(trade.rMultiple !== null ? formatRMultiple(trade.rMultiple) : null)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Balance Prior:</span>
                      {renderValue(trade.balanceBefore !== null ? formatCurrency(trade.balanceBefore, currency) : null)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PSYCHOLOGY & NOTES */}
          {activeTab === 'psychology' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-slate-400 uppercase text-[10px] font-medium tracking-wider block">Emotional State at Execution</span>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {trade.emotion ?? 'Not recorded'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-slate-400 uppercase text-[10px] font-medium tracking-wider block">Mistake / Rule Invalidation</span>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {trade.mistake ?? 'NONE'}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-slate-400 uppercase text-[10px] font-medium tracking-wider block">Trade Notes &amp; Observations</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-normal">
                  {trade.notes || 'No qualitative notes recorded for this position.'}
                </p>
              </div>

              {trade.tags && trade.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 text-[10px] uppercase font-medium tracking-wider mr-1">Tags:</span>
                  {trade.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RAW AUDIT JSON */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs">
                <Fingerprint className="w-4 h-4 text-indigo-500" />
                <span>Deterministic Source ID: <strong className="tabular-nums font-medium text-slate-900 dark:text-slate-200">{trade.sourceId}</strong></span>
              </div>

              <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-72 border border-slate-800">
                {JSON.stringify(trade, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Fullscreen Screenshot Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-950/70 text-white hover:bg-slate-950 transition cursor-pointer z-10"
              aria-label="Fermer le zoom"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomImage}
              alt="Capture d'écran plein écran"
              className="max-h-[85vh] w-auto object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};


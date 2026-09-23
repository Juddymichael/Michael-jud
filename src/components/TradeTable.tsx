import React, { useState } from 'react';
import { Trade } from '../types/trade';
import { DataQualityBadge } from './DataQualityBadge';
import { formatCurrency, formatRMultiple, formatKillzone, formatTradeStatus } from '../lib/formatting';
import { isTradeRRComplete } from '../lib/calculations/riskReward';
import {
  Trash2,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Layers,
  Sparkles,
  Upload,
  AlertCircle,
} from 'lucide-react';

interface Props {
  trades?: Trade[];
  onDelete: (id: string) => void;
  onSelect: (trade: Trade) => void;
  onSeed: () => void;
  onOpenCreate: () => void;
  onOpenImport?: () => void;
}

export const TradeTable: React.FC<Props> = ({
  trades = [],
  onDelete,
  onSelect,
  onSeed,
  onOpenCreate,
  onOpenImport,
}) => {
  const safeTrades = trades || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [mobilePageSize, setMobilePageSize] = useState<number>(6);

  const filteredTrades = safeTrades.filter((trade) => {
    if (!trade) return false;
    if (filterStatus !== 'ALL' && trade.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchSymbol = trade.symbol ? trade.symbol.toLowerCase().includes(q) : false;
      const matchTicket = trade.ticket ? trade.ticket.toLowerCase().includes(q) : false;
      const matchSetup = trade.setup ? trade.setup.toLowerCase().includes(q) : false;
      const matchTags = trade.tags && Array.isArray(trade.tags)
        ? trade.tags.some((t) => t && t.toLowerCase().includes(q))
        : false;
      if (!matchSymbol && !matchTicket && !matchSetup && !matchTags) return false;
    }
    return true;
  });

  if (safeTrades.length === 0) {
    return (
      <div
        id="empty-database-state"
        className="bg-white dark:bg-[#131820] border border-dashed border-slate-200/60 dark:border-[#1C2430] rounded-3xl p-12 text-center shadow-xs"
      >
        <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 flex items-center justify-center mx-auto text-[#7C3AED] dark:text-[#8B5CF6] mb-4 shadow-xs">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB]">Journal de Trading Vide</h3>
        <p className="text-xs text-[#6B7280] dark:text-[#8B92A0] max-w-md mx-auto mt-1.5 font-medium">
          Aucun trade enregistré dans votre journal. Importez vos trades depuis votre broker (CSV, Excel, PDF, Word) ou enregistrez votre premier trade.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          {onOpenImport && (
            <button
              id="btn-empty-import-trades"
              onClick={onOpenImport}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-2xl bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white transition-all duration-200 shadow-xs cursor-pointer btn-press btn-icon-animate group"
            >
              <Upload className="w-4 h-4 btn-icon-bounce" />
              <span>Importer Relevé (CSV, Excel, PDF, Word)</span>
            </button>
          )}
          <button
            id="btn-empty-create-trade"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-slate-100 dark:hover:bg-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] border border-slate-200/60 dark:border-[#1C2430] transition-all duration-200 cursor-pointer shadow-xs btn-press"
          >
            <span>Enregistrer un Trade</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="trade-table-container"
      className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-3xl overflow-hidden shadow-xs font-sans"
    >
      {/* Table toolbar */}
      <div className="p-4 border-b border-slate-200/60 dark:border-[#1C2430] flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[#F7F8FA] dark:bg-[#181F2A]">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#6B7280] dark:text-[#8B92A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par symbole, ticket, setup, tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl pl-10 pr-3 py-2 text-xs text-[#1A1D23] dark:text-[#E6E8EB] placeholder-[#6B7280] dark:placeholder-[#8B92A0] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] transition font-medium shadow-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40 hover:opacity-90 font-bold transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importer Fichier</span>
            </button>
          )}

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] rounded-2xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] font-bold shadow-xs cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="CLOSED">Clôturés (Closed)</option>
            <option value="OPEN">En cours (Open)</option>
          </select>

          <span className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-mono pl-2 font-bold">
            {filteredTrades.length} sur {trades.length} trades
          </span>
        </div>
      </div>

      {/* Mobile Card List (visible on small screens) */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-[#1C2430]">
        {filteredTrades.slice(0, mobilePageSize).map((trade) => {
          const isBuy = trade.direction === 'BUY';
          const pnl = trade.netPnL;

          return (
            <div
              key={trade.id}
              id={`trade-mobile-card-${trade.id}`}
              className="p-3 space-y-2 hover:bg-slate-50 dark:hover:bg-[#181F2A] transition"
            >
              {/* Header: Symbol, Direction, Status & Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-xs text-[#1A1D23] dark:text-[#E6E8EB] truncate">
                    {trade.symbol}
                  </span>
                  <span
                    className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 font-mono ${
                      isBuy
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#10B981] border border-emerald-200/60 dark:border-emerald-800/40'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-[#EF4444] border border-rose-200/60 dark:border-rose-800/40'
                    }`}
                  >
                    {isBuy ? (
                      <ArrowUpRight className="w-2.5 h-2.5 mr-0.5 inline stroke-[2.5]" />
                    ) : (
                      <ArrowDownRight className="w-2.5 h-2.5 mr-0.5 inline stroke-[2.5]" />
                    )}
                    {trade.direction}
                  </span>
                  {trade.ticket && (
                    <span className="text-[9px] text-[#6B7280] dark:text-[#8B92A0] font-semibold tabular-nums font-mono shrink-0">
                      #{trade.ticket}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onSelect(trade)}
                    className="p-1 rounded-lg bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-slate-200 dark:hover:bg-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] transition cursor-pointer border border-slate-200/60 dark:border-[#1C2430]"
                    title="Inspecter le trade"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(trade.id)}
                    className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-[#EF4444] transition cursor-pointer border border-rose-200/60 dark:border-rose-800/40"
                    title="Supprimer le trade"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* PnL & Key Stats row */}
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430]">
                <div>
                  <span className="text-[8px] uppercase tracking-wider font-semibold text-[#6B7280] dark:text-[#8B92A0] block font-mono">
                    P&amp;L Net
                  </span>
                  <div className="text-xs font-bold tabular-nums font-mono">
                    {pnl !== null ? (
                      <span
                        className={
                          pnl > 0
                            ? 'text-[#10B981]'
                            : pnl < 0
                            ? 'text-[#EF4444]'
                            : 'text-[#6B7280] dark:text-[#8B92A0]'
                        }
                      >
                        {pnl > 0 ? '+' : ''}{formatCurrency(pnl, 'EUR')}
                      </span>
                    ) : (
                      <span className="text-[#6B7280] dark:text-[#8B92A0]">—</span>
                    )}
                  </div>
                </div>

                {trade.rMultiple !== null && isTradeRRComplete(trade) ? (
                  <div className="text-center">
                    <span className="text-[8px] uppercase tracking-wider font-semibold text-[#6B7280] dark:text-[#8B92A0] block font-mono">
                      R-Multiple
                    </span>
                    <span
                      className={`text-[11px] font-bold tabular-nums font-mono ${
                        trade.rMultiple > 0
                          ? 'text-[#10B981]'
                          : trade.rMultiple < 0
                          ? 'text-[#EF4444]'
                          : 'text-[#6B7280] dark:text-[#8B92A0]'
                      }`}
                    >
                      {formatRMultiple(trade.rMultiple)}
                    </span>
                  </div>
                ) : trade.status === 'CLOSED' && !isTradeRRComplete(trade) ? (
                  <div className="text-center">
                    <span className="text-[8px] uppercase tracking-wider font-semibold text-[#6B7280] dark:text-[#8B92A0] block font-mono">
                      R-Multiple
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Incomplet
                    </span>
                  </div>
                ) : null}

                <div className="text-right">
                  <span className="text-[8px] uppercase tracking-wider font-semibold text-[#6B7280] dark:text-[#8B92A0] block font-mono">
                    Date
                  </span>
                  <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-mono">
                    {new Date(trade.openedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>

              {/* Sub-info: Setup / Killzone & Prices */}
              <div className="flex items-center justify-between text-[10px] text-[#6B7280] dark:text-[#8B92A0]">
                <span className="truncate max-w-[150px]">
                  {trade.setup || 'Sans setup'} · {formatKillzone(trade.killzone || trade.session)}
                </span>
                <span className="tabular-nums font-mono shrink-0 text-[10px]">
                  {trade.entryPrice !== null ? trade.entryPrice.toFixed(trade.entryPrice < 10 ? 4 : 2) : '—'} →{' '}
                  {trade.exitPrice !== null ? trade.exitPrice.toFixed(trade.exitPrice < 10 ? 4 : 2) : '—'}
                </span>
              </div>
            </div>
          );
        })}

        {/* Mobile Progressive Load More Controls */}
        {filteredTrades.length > 6 && (
          <div className="p-2.5 text-center bg-[#F7F8FA] dark:bg-[#181F2A] flex items-center justify-center gap-2">
            {mobilePageSize < filteredTrades.length ? (
              <>
                <button
                  type="button"
                  onClick={() => setMobilePageSize((prev) => prev + 6)}
                  className="text-[11px] font-bold text-[#7C3AED] dark:text-[#8B5CF6] bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition cursor-pointer"
                >
                  Afficher + ({Math.min(6, filteredTrades.length - mobilePageSize)} trades)
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePageSize(filteredTrades.length)}
                  className="text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] px-2 py-1.5 hover:underline cursor-pointer"
                >
                  Tous ({filteredTrades.length})
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMobilePageSize(6)}
                className="text-[11px] font-bold text-[#6B7280] dark:text-[#8B92A0] bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition cursor-pointer"
              >
                Réduire l&apos;affichage
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop Table (hidden on mobile, visible on md+) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F8FA] dark:bg-[#181F2A] border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider font-mono font-bold">
            <tr>
              <th className="py-3 px-4 font-bold">Ticket / Ref</th>
              <th className="py-3 px-4 font-bold">Symbole / Dir</th>
              <th className="py-3 px-4 font-bold">Date Ouverture</th>
              <th className="py-3 px-4 font-bold">Entrée / Sortie</th>
              <th className="py-3 px-4 font-bold">P&amp;L Net</th>
              <th className="py-3 px-4 font-bold">R-Multiple</th>
              <th className="py-3 px-4 font-bold">Risque / Solde</th>
              <th className="py-3 px-4 font-bold">Setup / Killzone</th>
              <th className="py-3 px-4 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1C2430] font-sans">
            {filteredTrades.map((trade) => {
              const isBuy = trade.direction === 'BUY';
              const pnl = trade.netPnL;

              return (
                <tr
                  key={trade.id}
                  id={`trade-row-${trade.id}`}
                  className="hover:bg-slate-50 dark:hover:bg-[#181F2A] transition group"
                >
                  {/* Ticket & Fingerprint */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-[#1A1D23] dark:text-[#E6E8EB] font-bold tabular-nums font-mono">
                      {trade.ticket ? `#${trade.ticket}` : '—'}
                    </div>
                    <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate max-w-[90px] font-mono" title={trade.sourceId}>
                      {trade.sourceId}
                    </div>
                  </td>

                  {/* Symbol & Direction */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB]">{trade.symbol}</span>
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg font-mono ${
                          isBuy
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#10B981] border border-emerald-200/60 dark:border-emerald-800/40'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-[#EF4444] border border-rose-200/60 dark:border-rose-800/40'
                        }`}
                      >
                        {isBuy ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5 inline stroke-[2.5]" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5 inline stroke-[2.5]" />
                        )}
                        {trade.direction}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium font-mono">
                      {formatTradeStatus(trade.status)}
                    </span>
                  </td>

                  {/* Open Date */}
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums font-mono text-[#6B7280] dark:text-[#8B92A0] font-medium">
                    <div className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">{new Date(trade.openedAt).toISOString().slice(0, 10)}</div>
                    <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">
                      {new Date(trade.openedAt).toISOString().slice(11, 19)} UTC
                    </div>
                  </td>

                  {/* Entry & Exit Prices */}
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums font-mono font-medium">
                    <div className="text-[#1A1D23] dark:text-[#E6E8EB] font-bold">
                      {trade.entryPrice !== null ? trade.entryPrice.toFixed(trade.entryPrice < 10 ? 4 : 2) : '—'}
                    </div>
                    <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">
                      Sortie: {trade.exitPrice !== null ? trade.exitPrice.toFixed(trade.exitPrice < 10 ? 4 : 2) : '—'}
                    </div>
                  </td>

                  {/* Net P&L */}
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums font-mono">
                    {pnl !== null ? (
                      <span
                        className={`font-bold ${
                          pnl > 0
                            ? 'text-[#10B981]'
                            : pnl < 0
                            ? 'text-[#EF4444]'
                            : 'text-[#6B7280] dark:text-[#8B92A0]'
                        }`}
                      >
                        {formatCurrency(pnl, 'EUR')}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700 font-mono text-xs select-none">—</span>
                    )}
                    <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium">
                      Frais: {trade.commission !== null ? formatCurrency(trade.commission, 'EUR') : <span className="text-slate-300 dark:text-slate-700 font-mono select-none">—</span>}
                    </div>
                  </td>

                  {/* R-Multiple */}
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums font-mono">
                    {trade.rMultiple !== null && isTradeRRComplete(trade) ? (
                      <span
                        className={`font-bold ${
                          trade.rMultiple > 0
                            ? 'text-[#10B981]'
                            : trade.rMultiple < 0
                            ? 'text-[#EF4444]'
                            : 'text-[#6B7280] dark:text-[#8B92A0]'
                        }`}
                      >
                        {formatRMultiple(trade.rMultiple)}
                      </span>
                    ) : trade.status === 'CLOSED' && !isTradeRRComplete(trade) ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        title="Données incomplètes : Stop Loss ou prix de sortie manquant pour calculer le R-Multiple"
                      >
                        <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                        Données incomplètes
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700 font-mono text-xs select-none">
                        —
                      </span>
                    )}
                  </td>

                  {/* Risk / Balance */}
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums font-mono text-[11px] text-[#6B7280] dark:text-[#8B92A0] font-medium">
                    <div>
                      Risque:{' '}
                      {trade.initialRiskAmount !== null ? (
                        formatCurrency(trade.initialRiskAmount, 'EUR', { showSign: false })
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 select-none font-mono">—</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">
                      Solde:{' '}
                      {trade.balanceBefore !== null ? (
                        formatCurrency(trade.balanceBefore, 'EUR', { showSign: false })
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 select-none font-mono">—</span>
                      )}
                    </div>
                  </td>

                  {/* Setup & Killzone */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-[#1A1D23] dark:text-[#E6E8EB] font-bold truncate max-w-[130px]" title={trade.setup ?? ''}>
                      {trade.setup || '—'}
                    </div>
                    <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium font-mono">
                      {formatKillzone(trade.killzone || trade.session)} • {trade.timeframe || '—'}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onSelect(trade)}
                        className="p-2 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-slate-200 dark:hover:bg-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition-all duration-200 cursor-pointer border border-slate-200/60 dark:border-[#1C2430] shadow-xs btn-press group/btn"
                        title="Inspecter le trade"
                      >
                        <Eye className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-115" />
                      </button>
                      <button
                        onClick={() => onDelete(trade.id)}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-[#EF4444] transition-all duration-200 cursor-pointer border border-rose-200/60 dark:border-rose-800/40 shadow-xs btn-press group/del"
                        title="Supprimer le trade"
                      >
                        <Trash2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover/del:scale-115 group-hover/del:rotate-6" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


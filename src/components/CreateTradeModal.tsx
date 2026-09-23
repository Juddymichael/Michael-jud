import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trade, NewTradeInput, TradeDirection, TradeStatus, TradingSession, EmotionType, MistakeType } from '../types/trade';
import { UserSettings } from '../types/settings';
import { normalizeSymbol, normalizeNumber } from '../lib/normalization';
import { useSetups } from '../hooks/useSetups';
import { calculateRiskReward } from '../lib/calculations/riskReward';
import { calculateInstrumentRisk } from '../lib/calculations/instrumentRisk';
import { getLatestAccountBalance, hasHistoricalCommissions } from '../lib/calculations/accountBalance';
import { safeRound } from '../lib/calculations/precision';
import { MADAGASCAR_KILLZONES, getKillzoneInfoFromDate } from '../lib/sessionCalculator';
import { processScreenshotFile, isValidChartUrl, normalizeChartUrl } from '../lib/imageUtils';
import {
  X,
  Plus,
  AlertCircle,
  AlertTriangle,
  Layers,
  Camera,
  Upload,
  Link2,
  ExternalLink,
  Trash2,
  Scale,
  CheckCircle2,
  Clock,
  Crosshair,
  Maximize2,
  Check,
  Info,
  RotateCcw,
  Calculator,
} from 'lucide-react';

interface CreateTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trade: NewTradeInput) => Promise<void>;
  trades?: Trade[];
  settings?: UserSettings;
}

const COMMON_TRIGGERS = [
  'M5 CHoCH confirmé',
  'M15 FVG retest',
  'Liquidity Sweep + MSS',
  'M1 Displacement + IFVG',
  'Order Block Tap + Confirmation',
  'CISD Entry',
  'Breaker Block Retest',
  'Turtle Soup / SFP',
  'FVG Inversion',
];

const TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'] as const;

interface FieldTooltipProps {
  text: string;
}

const FieldTooltip: React.FC<FieldTooltipProps> = ({ text }) => {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShow((s) => !s);
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 p-0.5 rounded-full transition-colors cursor-pointer"
        aria-label="Information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {show && (
        <span
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2.5 rounded-xl bg-slate-900 text-slate-100 text-[11px] leading-relaxed shadow-xl z-50 pointer-events-auto border border-slate-700 font-normal select-none block"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
};

export const CreateTradeModal: React.FC<CreateTradeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  trades = [],
  settings,
}) => {
  const { setups } = useSetups();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Basic Details
  const [ticket, setTicket] = useState('');
  const [symbolRaw, setSymbolRaw] = useState('XAUUSD');
  const [direction, setDirection] = useState<TradeDirection>('BUY');
  const [status, setStatus] = useState<TradeStatus>('CLOSED');
  const [openedAt, setOpenedAt] = useState(() => new Date(Date.now() - 3600000).toISOString().slice(0, 16));
  const [closedAt, setClosedAt] = useState(() => new Date().toISOString().slice(0, 16));

  // Execution Quotes
  const [entryPrice, setEntryPrice] = useState('2420.00');
  const [exitPrice, setExitPrice] = useState('2438.00');
  const [stopLoss, setStopLoss] = useState('2412.00');
  const [takeProfit, setTakeProfit] = useState('2440.00');
  const [quantity, setQuantity] = useState('0.5');

  // Accounting & Risk
  const [grossPnL, setGrossPnL] = useState('900.00');
  const [commission, setCommission] = useState('0.00');
  const [swap, setSwap] = useState('0.00');
  const [initialRiskAmount, setInitialRiskAmount] = useState('400.00');
  const [isRiskManuallyEdited, setIsRiskManuallyEdited] = useState(false);
  const [balanceBefore, setBalanceBefore] = useState('10000.00');

  // Metas & Setup Context
  const [session, setSession] = useState<TradingSession>('LONDON');
  const [timeframe, setTimeframe] = useState<string>('M15');
  const [setupName, setSetupName] = useState('Golden FVG');
  const [setupId, setSetupId] = useState('setup-golden-fvg');

  // ICT / SMC Details
  const [htfBias, setHtfBias] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL'>('BULLISH');
  const [killzone, setKillzone] = useState<'LONDON_OPEN' | 'NY' | 'NY_AM' | 'NY_PM' | 'LONDON_CLOSE' | 'ASIA' | 'OFF_HOURS'>('LONDON_OPEN');
  const [isKillzoneManual, setIsKillzoneManual] = useState(false);

  // Preuve Visuelle & Screenshots
  const [tradingViewUrl, setTradingViewUrl] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [screenshotSizeKb, setScreenshotSizeKb] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewZoomOpen, setPreviewZoomOpen] = useState(false);

  // Psychology & Review
  const [notes, setNotes] = useState('Clean FVG tap following Asian low liquidity purge.');
  const [emotion, setEmotion] = useState<EmotionType>('DISCIPLINED');
  const [mistake, setMistake] = useState<MistakeType>('NONE');
  const [tags, setTags] = useState('Gold, FVG, LondonKillzone');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Post-loss vigilance alert state (anti-revenge trading)
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  // Determine if trader is within the post-loss vigilance window
  const postLossInfo = useMemo(() => {
    if (!isOpen) return { isActive: false, minutesSinceLoss: 0, lastTrade: null, windowMinutes: 60 };

    const closedTrades = (trades || []).filter((t) => t.status === 'CLOSED' || t.closedAt);
    if (closedTrades.length === 0) return { isActive: false, minutesSinceLoss: 0, lastTrade: null, windowMinutes: 60 };

    // Sort descending by closedAt (or openedAt fallback)
    const sorted = [...closedTrades].sort((a, b) => {
      const timeA = new Date(a.closedAt || a.openedAt).getTime();
      const timeB = new Date(b.closedAt || b.openedAt).getTime();
      return timeB - timeA;
    });

    const lastClosed = sorted[0];
    if (!lastClosed) return { isActive: false, minutesSinceLoss: 0, lastTrade: null, windowMinutes: 60 };

    // Check if the trade was a loss: rMultiple < 0 OR netPnL < 0
    const isLoss =
      (lastClosed.rMultiple !== null && lastClosed.rMultiple !== undefined && lastClosed.rMultiple < 0) ||
      (lastClosed.netPnL !== null && lastClosed.netPnL !== undefined && lastClosed.netPnL < 0);

    const windowMinutes = settings?.postLossAlertWindowMinutes ?? 60;

    if (!isLoss) {
      return { isActive: false, minutesSinceLoss: 0, lastTrade: lastClosed, windowMinutes };
    }

    const closedTime = new Date(lastClosed.closedAt || lastClosed.openedAt).getTime();
    const now = Date.now();
    const elapsedMs = now - closedTime;
    const minutesSinceLoss = Math.max(0, Math.floor(elapsedMs / 60000));

    // Trigger alert if closed in the past and within the configured window threshold
    const isActive = elapsedMs >= 0 && minutesSinceLoss <= windowMinutes;

    return {
      isActive,
      minutesSinceLoss,
      lastTrade: lastClosed,
      windowMinutes,
    };
  }, [isOpen, trades, settings?.postLossAlertWindowMinutes]);

  // Reset acknowledgment whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setWarningAcknowledged(false);
    }
  }, [isOpen]);

  // Real-time calculation inputs
  const numEntry = normalizeNumber(entryPrice);
  const numExit = status === 'CLOSED' ? normalizeNumber(exitPrice) : null;
  const numSL = normalizeNumber(stopLoss);
  const numTP = normalizeNumber(takeProfit);
  const numQty = normalizeNumber(quantity);

  // Real-time Risk/Reward Calculation
  const rrCalc = calculateRiskReward({
    direction,
    entryPrice: numEntry,
    stopLoss: numSL,
    takeProfit: numTP,
    exitPrice: numExit,
  });

  // Validation bloquante SMC / ICT
  const isFormValid = useMemo(() => {
    // 1. entryPrice and stopLoss are always mandatory positive numbers
    if (numEntry === null || numEntry <= 0) return false;
    if (numSL === null || numSL <= 0) return false;

    // 2. Depending on status:
    // If OPEN: takeProfit is required.
    // If CLOSED: exitPrice is required. (takeProfit is optional if exitPrice is provided)
    if (status === 'OPEN') {
      if (numTP === null || numTP <= 0) return false;
    } else {
      if (numExit === null || numExit <= 0) return false;
    }

    // 3. Risk must be valid according to SMC rules
    if (!rrCalc.isValidRisk) return false;

    // 4. Post-loss vigilance check: checkbox must be confirmed if alert is active
    if (postLossInfo.isActive && !warningAcknowledged) return false;

    return true;
  }, [numEntry, numSL, numTP, numExit, status, rrCalc.isValidRisk, postLossInfo.isActive, warningAcknowledged]);

  // Real-time Initial Risk ($) calculation based on instrument point/pip value
  const calculatedRisk = useMemo(() => {
    return calculateInstrumentRisk({
      symbolRaw,
      entryPrice: numEntry,
      stopLoss: numSL,
      quantity: numQty,
    });
  }, [symbolRaw, numEntry, numSL, numQty]);

  // Synchronize auto-calculated Initial Risk ($) in real-time unless manually overridden
  useEffect(() => {
    if (!isRiskManuallyEdited && calculatedRisk.riskAmount !== null) {
      setInitialRiskAmount(calculatedRisk.riskAmount.toFixed(2));
    }
  }, [calculatedRisk.riskAmount, isRiskManuallyEdited]);

  // Real-time Net P&L calculation: P&L Net = P&L Brut - Commissions (+ Swap)
  const numGross = normalizeNumber(grossPnL);
  const rawComm = normalizeNumber(commission);
  const rawSwap = normalizeNumber(swap);
  const feeAmount = rawComm !== null ? Math.abs(rawComm) : 0;
  const swapAmount = rawSwap !== null ? rawSwap : 0;
  const computedNetPnL = numGross !== null ? safeRound(numGross - feeAmount + swapAmount, 2) : null;

  // Intelligent initialization when modal opens
  useEffect(() => {
    if (isOpen) {
      // 1. Pre-fill Capital Compte with the most recent known account balance
      const defaultBalance = settings?.initialAccountBalance || 10000;
      const latestBal = getLatestAccountBalance(trades, defaultBalance);
      setBalanceBefore(latestBal.toFixed(2));

      // 2. Default Commissions ($) based on historical trades
      const hasComm = hasHistoricalCommissions(trades);
      if (!hasComm) {
        setCommission('0.00');
      } else {
        const closedWithComm = trades.filter(
          (t) => t.commission !== null && t.commission !== undefined && t.commission !== 0
        );
        if (closedWithComm.length > 0) {
          const lastC = closedWithComm[0].commission;
          setCommission(lastC !== null && lastC !== undefined ? String(lastC) : '0.00');
        } else {
          setCommission('0.00');
        }
      }

      // 3. Reset manual risk & killzone override flags so auto-calculation triggers freshly
      setIsRiskManuallyEdited(false);
      setIsKillzoneManual(false);
      if (openedAt) {
        const d = new Date(openedAt);
        if (!isNaN(d.getTime())) {
          const kz = getKillzoneInfoFromDate(d, 'Indian/Antananarivo');
          setKillzone(kz.code);
          if (kz.code === 'LONDON_OPEN') setSession('LONDON');
          else if (kz.code === 'NY' || kz.code === 'NY_AM' || kz.code === 'NY_PM' || kz.code === 'LONDON_CLOSE') setSession('NEW_YORK');
          else if (kz.code === 'ASIA') setSession('TOKYO');
        }
      }
    }
  }, [isOpen, trades, settings, openedAt]);

  // Auto-detect Killzone from openedAt in Madagascar Time (GMT+3) unless user manually selected one
  useEffect(() => {
    if (!isKillzoneManual && openedAt) {
      const d = new Date(openedAt);
      if (!isNaN(d.getTime())) {
        const kz = getKillzoneInfoFromDate(d, 'Indian/Antananarivo');
        setKillzone(kz.code);
        if (kz.code === 'LONDON_OPEN') setSession('LONDON');
        else if (kz.code === 'NY' || kz.code === 'NY_AM' || kz.code === 'NY_PM' || kz.code === 'LONDON_CLOSE') setSession('NEW_YORK');
        else if (kz.code === 'ASIA') setSession('TOKYO');
      }
    }
  }, [openedAt, isKillzoneManual]);

  if (!isOpen) return null;

  const normalizedSymbol = normalizeSymbol(symbolRaw);

  const handleSetupSelect = (selectedId: string) => {
    setSetupId(selectedId);
    const found = setups.find((s) => s.id === selectedId);
    if (found) {
      setSetupName(found.name);
    }
  };

  // Image upload handling
  const handleFileProcess = async (file: File) => {
    setUploadError(null);
    try {
      const processed = await processScreenshotFile(file);
      setScreenshotDataUrl(processed.dataUrl);
      setScreenshotName(processed.name);
      setScreenshotSizeKb(processed.sizeKb);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur lors du traitement de l\'image');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // reset input so the same file can be re-selected if removed
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileProcess(file);
          break;
        }
      }
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshotDataUrl(null);
    setScreenshotName('');
    setScreenshotSizeKb(0);
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Strict SMC / ICT validation check before submitting
    if (numEntry === null || numEntry <= 0) {
      setErrorMessage("Le prix d'entrée est obligatoire et doit être supérieur à zéro.");
      return;
    }
    if (numSL === null || numSL <= 0) {
      setErrorMessage("Le Stop Loss est obligatoire et doit être supérieur à zéro.");
      return;
    }
    if (status === 'OPEN' && (numTP === null || numTP <= 0)) {
      setErrorMessage("Pour un trade ouvert (OPEN), le Take Profit est obligatoire pour définir le ratio Risque/Rendement visé.");
      return;
    }
    if (status === 'CLOSED' && (numExit === null || numExit <= 0)) {
      setErrorMessage("Pour un trade clôturé (CLOSED), le prix de sortie réel est obligatoire pour calculer le R-Multiple réalisé.");
      return;
    }
    if (!rrCalc.isValidRisk) {
      setErrorMessage(rrCalc.warning || "Les niveaux de prix ne respectent pas les règles de cohérence de marché SMC.");
      return;
    }
    if (postLossInfo.isActive && !warningAcknowledged) {
      setErrorMessage("Veuillez confirmer que ce trade suit votre plan et n'est pas une réaction à la perte précédente.");
      return;
    }

    setIsSubmitting(true);

    try {
      const openIso = new Date(openedAt).toISOString();
      const closeIso = status === 'CLOSED' && closedAt ? new Date(closedAt).toISOString() : null;

      const formattedTradingViewUrl = tradingViewUrl.trim()
        ? normalizeChartUrl(tradingViewUrl)
        : null;

      const newTrade: NewTradeInput = {
        ticket: ticket.trim() || null,
        symbol: normalizedSymbol,
        direction,
        status,
        openedAt: openIso,
        closedAt: closeIso,
        timezone: 'UTC',

        entryPrice: numEntry,
        exitPrice: status === 'CLOSED' ? numExit : null,
        stopLoss: numSL,
        takeProfit: numTP,
        plannedRR: rrCalc.plannedRR,
        realizedRR: status === 'CLOSED' ? rrCalc.realizedRR : null,

        quantity: numQty,
        lotSize: numQty,
        contractSize: calculatedRisk.multiplier,

        grossPnL: numGross,
        commission: rawComm !== null ? (rawComm > 0 ? -rawComm : rawComm) : 0,
        swap: rawSwap,
        netPnL: computedNetPnL,

        initialRiskAmount: normalizeNumber(initialRiskAmount),
        riskPercent: null,
        rMultiple: null,

        balanceBefore: normalizeNumber(balanceBefore),
        balanceAfter: null,

        session,
        timeframe: timeframe || null,
        setup: setupName.trim() || null,
        setupId: setupId || null,
        entryTrigger: null,

        htfBias,
        killzone,
        liquidityTaken: null,
        irlErl: null,
        mss: false,
        cisd: false,
        displacement: false,
        fvg: false,
        ifvg: false,
        ob: false,

        notes: notes.trim() || null,
        emotion: emotion || 'NEUTRAL',
        mistake: mistake || 'NONE',
        takenInPostLossWindow: postLossInfo.isActive,
        warningAcknowledged: postLossInfo.isActive ? warningAcknowledged : false,

        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),

        tradingViewUrl: formattedTradingViewUrl,
        screenshotBefore: screenshotDataUrl,
        screenshotAfter: null,
      };

      await onSubmit(newTrade);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTvUrlValid = isValidChartUrl(tradingViewUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      id="modal-create-trade"
      onPaste={handlePaste}
    >
      <div className="bg-white dark:bg-[#101827] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#131B2E]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Enregistrer un Trade (Log Execution)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-normal">
                Enregistrement avec preuve visuelle, contexte SMC et calculs automatiques de RR
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fermer la modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bandeau de Vigilance Post-Perte (Anti-Revenge Trading) */}
          {postLossInfo.isActive && (
            <div
              id="post-loss-vigilance-banner"
              className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase tracking-wide text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                      Vigilance Émotionnelle • Fenêtre Post-Perte
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                      Clôturé il y a {postLossInfo.minutesSinceLoss} min (seuil {postLossInfo.windowMinutes} min)
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                    Ton dernier trade s'est soldé par une perte il y a <strong>{postLossInfo.minutesSinceLoss} minute{postLossInfo.minutesSinceLoss > 1 ? 's' : ''}</strong>. Historiquement, ton winrate chute significativement dans cette fenêtre.
                  </p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-amber-500/20 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="confirm-discipline-checkbox"
                  checked={warningAcknowledged}
                  onChange={(e) => setWarningAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 cursor-pointer shrink-0"
                />
                <label
                  htmlFor="confirm-discipline-checkbox"
                  className="text-xs font-medium text-amber-900 dark:text-amber-100 cursor-pointer select-none leading-snug"
                >
                  Je confirme que ce trade suit mon plan et n'est pas une réaction à la perte précédente
                </label>
              </div>
            </div>
          )}

          {/* Section 1: Instrument & Direction */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Symbole / Actif *
              </label>
              <input
                type="text"
                required
                value={symbolRaw}
                onChange={(e) => setSymbolRaw(e.target.value)}
                placeholder="Ex: XAUUSD, EURUSD, NAS100"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-violet-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Direction
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as TradeDirection)}
                className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold focus:ring-2 focus:ring-violet-500 ${
                  direction === 'BUY'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                <option value="BUY">BUY (Long)</option>
                <option value="SELL">SELL (Short)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Statut de la Position
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TradeStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 font-medium"
              >
                <option value="CLOSED">CLOSED (Clôturé)</option>
                <option value="OPEN">OPEN (En cours)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Ticket / N° Ordre
              </label>
              <input
                type="text"
                placeholder="Optionnel"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-normal"
              />
            </div>
          </div>

          {/* Section 2: Trading Setup & Contexte SMC (Ajusté en Heure de Madagascar GMT+3) */}
          <div className="p-4 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/20 dark:bg-violet-950/20 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  Trading Setup &amp; Contexte SMC
                </span>
              </div>
              <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium bg-violet-100/60 dark:bg-violet-900/40 px-2 py-0.5 rounded-full">
                Heure de Madagascar (GMT+3)
              </span>
            </div>

            {/* Grille 4 colonnes épurée : Setup Model, Timeframe, Killzone Madagascar & HTF Bias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Setup Model */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Setup Model *
                </label>
                <select
                  value={setupId}
                  onChange={(e) => handleSetupSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 font-medium"
                >
                  {setups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Timeframe d'analyse */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-violet-500" />
                  <span>Timeframe d&apos;analyse</span>
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-violet-500"
                >
                  {TIMEFRAME_OPTIONS.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf} {tf === 'M15' ? '(Standard HTF/LTF)' : tf === 'H1' ? '(Structure)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Killzone (Convertie de GMT-5 New York vers GMT+3 Madagascar) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    <span>Killzone (Madagascar)</span>
                    <FieldTooltip text="Horaires de Madagascar (UTC+3) : London Killzone (09h-12h), New York Killzone (14h-17h). Détectée automatiquement selon l'heure d'entrée du trade." />
                  </label>
                  {!isKillzoneManual && (
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                      Auto
                    </span>
                  )}
                </div>
                <select
                  value={killzone}
                  onChange={(e) => {
                    const kz = e.target.value as typeof killzone;
                    setIsKillzoneManual(true);
                    setKillzone(kz);
                    if (kz === 'LONDON_OPEN') setSession('LONDON');
                    else if (kz === 'NY' || kz === 'NY_AM' || kz === 'NY_PM' || kz === 'LONDON_CLOSE') setSession('NEW_YORK');
                    else if (kz === 'ASIA') setSession('TOKYO');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-violet-500"
                >
                  {MADAGASCAR_KILLZONES.map((kz) => (
                    <option key={kz.code} value={kz.code}>
                      {kz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. HTF Narrative Bias */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  HTF Narrative Bias
                </label>
                <select
                  value={htfBias}
                  onChange={(e) => setHtfBias(e.target.value as typeof htfBias)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-violet-500"
                >
                  <option value="BULLISH">Bullish (Expansion Discount)</option>
                  <option value="BEARISH">Bearish (Expansion Premium)</option>
                  <option value="NEUTRAL">Neutral / Range interne</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Prices, Execution & Real-Time RR Calculator */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Prix d&apos;Entrée *
                </label>
                <input
                  type="text"
                  required
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="2420.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-mono font-semibold focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Stop Loss (SL) *
                </label>
                <input
                  type="text"
                  required
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="2412.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 dark:border-rose-900/60 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 tabular-nums font-mono font-semibold focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Take Profit (TP) {status === 'OPEN' && '*'}
                </label>
                <input
                  type="text"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="2440.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 tabular-nums font-mono font-semibold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Prix de Sortie {status === 'CLOSED' ? '*' : '(Exit)'}
                </label>
                <input
                  type="text"
                  disabled={status === 'OPEN'}
                  value={status === 'OPEN' ? '' : exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  placeholder={status === 'OPEN' ? 'Position ouverte' : '2438.00'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-mono font-semibold disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Volume (Lots)
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.5"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-mono font-medium"
                />
              </div>
            </div>

            {/* AUTOMATIC LIVE RR BANNER (Real-time calculation display) */}
            <div className="p-3 sm:p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Left: Summary and Ratios */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1D23] dark:text-[#E6E8EB] font-mono uppercase tracking-wider">
                    <Scale className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0" />
                    <span>Ratio Risque / Rendement :</span>
                  </div>

                  {/* Planned RR Pill */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 font-mono">
                    <span className="text-[10px] uppercase font-bold text-[#7C3AED] dark:text-[#8B5CF6] tracking-wider">
                      RR Visé :
                    </span>
                    <span className="text-sm font-extrabold tabular-nums text-[#1A1D23] dark:text-[#E6E8EB]">
                      {rrCalc.plannedRR !== null ? `${rrCalc.plannedRR}R` : '—'}
                    </span>
                    {rrCalc.plannedRR !== null && (
                      <span className="text-[10px] text-[#7C3AED] dark:text-[#8B5CF6] font-medium">
                        (1:{rrCalc.plannedRR})
                      </span>
                    )}
                  </div>

                  {/* Realized RR Pill (if CLOSED and Exit Price set) */}
                  {status === 'CLOSED' && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border ${
                      rrCalc.realizedRR !== null && rrCalc.realizedRR > 0
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : rrCalc.realizedRR !== null && rrCalc.realizedRR < 0
                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      <span className="text-[10px] uppercase font-bold tracking-wider">
                        RR Réalisé :
                      </span>
                      <span className="text-sm font-extrabold tabular-nums">
                        {rrCalc.realizedRR !== null ? `${rrCalc.realizedRR}R` : '—'}
                      </span>
                      {rrCalc.plannedRR !== null && rrCalc.realizedRR !== null && (
                        <span className="text-[10px] font-semibold opacity-90">
                          {rrCalc.realizedRR >= rrCalc.plannedRR
                            ? '• Objectif atteint'
                            : `• ${Math.round((rrCalc.realizedRR / rrCalc.plannedRR) * 100)}% du TP`}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Technical Distances / Validation Alert */}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium self-start sm:self-auto">
                  {!rrCalc.isValidRisk && rrCalc.warning ? (
                    <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{rrCalc.warning}</span>
                    </span>
                  ) : rrCalc.riskDistance !== null ? (
                    <span className="tabular-nums">
                      Risque : <strong className="text-rose-600 dark:text-rose-400">{rrCalc.riskDistance} pts</strong>
                      {rrCalc.rewardDistance !== null && (
                        <> | Gain visé : <strong className="text-emerald-600 dark:text-emerald-400">{rrCalc.rewardDistance} pts</strong></>
                      )}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">Renseignez SL et TP pour calculer le RR</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: PREUVE VISUELLE (TradingView & Capture d'écran) - NEW REQUIREMENT */}
          <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/20 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  Preuve Visuelle &amp; Graphique
                </span>
              </div>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                IndexedDB locale
              </span>
            </div>

            {/* Field A: Lien TradingView */}
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Lien TradingView (URL du trade ou chart snapshot)</span>
                </span>
                {tradingViewUrl && isTvUrlValid && (
                  <a
                    href={normalizeChartUrl(tradingViewUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Tester le lien</span>
                  </a>
                )}
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={tradingViewUrl}
                  onChange={(e) => setTradingViewUrl(e.target.value)}
                  placeholder="https://www.tradingview.com/x/..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 ${
                    tradingViewUrl && !isTvUrlValid
                      ? 'border-amber-400 dark:border-amber-600'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {tradingViewUrl && isTvUrlValid && (
                  <span className="absolute right-3 top-2.5 text-emerald-500 pointer-events-none">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              {tradingViewUrl && !isTvUrlValid && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                  Le lien doit ressembler à une URL valide (ex : https://www.tradingview.com/x/abc1234/).
                </p>
              )}
            </div>

            {/* Field B: Zone d'upload d'image par glisser-déposer ou sélection de fichier */}
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Capture d&apos;écran du graphique au moment de l&apos;entrée</span>
                </span>
                <span className="text-[10px] text-slate-400">Glisser-déposer ou Ctrl+V</span>
              </label>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {screenshotDataUrl ? (
                /* Miniature & Controls once uploaded */
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/80 flex flex-col sm:flex-row items-center gap-3">
                  <div
                    className="relative group w-full sm:w-40 h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0 cursor-pointer shadow-xs"
                    onClick={() => setPreviewZoomOpen(true)}
                    title="Cliquer pour agrandir la miniature"
                  >
                    <img
                      src={screenshotDataUrl}
                      alt="Capture d'écran du setup"
                      className="w-full h-full object-cover transition duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                      <Maximize2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1 text-left w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="truncate">{screenshotName || 'Capture_Setup.png'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Taille compressée : <strong className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">{screenshotSizeKb} Ko</strong> • Prête pour sauvegarde locale
                    </p>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                      >
                        Remplacer l&apos;image
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveScreenshot}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Retirer</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Dropzone / Upload area */
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition select-none ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-100/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 scale-[1.01]'
                      : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white/60 dark:bg-slate-900/60'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Glissez-déposez votre capture d&apos;écran ici, ou <span className="text-indigo-600 dark:text-indigo-400 underline">parcourez vos fichiers</span>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    PNG, JPG, WebP acceptés (ou collez avec Ctrl+V) • Enregistrée automatiquement en base de données locale
                  </p>
                </div>
              )}

              {uploadError && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}
            </div>
          </div>

          {/* Section 5: Financials & Fees */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  Paramètres Financiers &amp; Comptabilité
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Calculs &amp; Solde automatiques
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. P&L Brut ($) */}
              <div>
                <label className="flex items-center text-[11px] text-slate-700 dark:text-slate-300 font-medium mb-1">
                  <span>P&amp;L Brut ($)</span>
                  <FieldTooltip text="Résultat du trade avant déduction des commissions. Si tu ne distingues pas les deux, mets le même montant que ton résultat net habituel et laisse Commissions à 0." />
                </label>
                <input
                  type="text"
                  value={grossPnL}
                  onChange={(e) => setGrossPnL(e.target.value)}
                  placeholder="900.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-mono font-semibold focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* 2. Commissions ($) */}
              <div>
                <label className="flex items-center text-[11px] text-slate-700 dark:text-slate-300 font-medium mb-1">
                  <span>Commissions ($)</span>
                  <FieldTooltip text="Frais de courtage distincts du spread. Laisse à 0 si ton compte n'a pas de commission séparée (mode Standard)." />
                </label>
                <input
                  type="text"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-mono font-medium focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* 3. Risque Initial ($) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                    <span>Risque Initial ($)</span>
                    <FieldTooltip text="Calculé automatiquement : |Prix d'entrée - Stop Loss| × taille de position × valeur du pip/point pour l'instrument concerné. Pré-rempli par défaut et modifiable." />
                  </label>
                  {!isRiskManuallyEdited && calculatedRisk.riskAmount !== null && (
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                      Auto
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={initialRiskAmount}
                    onChange={(e) => {
                      setIsRiskManuallyEdited(true);
                      setInitialRiskAmount(e.target.value);
                    }}
                    placeholder="400.00"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-mono font-semibold focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 truncate" title={calculatedRisk.specLabel}>
                    {calculatedRisk.specLabel}
                  </span>
                  {isRiskManuallyEdited && calculatedRisk.riskAmount !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRiskManuallyEdited(false);
                        setInitialRiskAmount(calculatedRisk.riskAmount!.toFixed(2));
                      }}
                      className="text-violet-600 dark:text-violet-400 hover:underline font-semibold flex items-center gap-0.5 shrink-0 ml-1 cursor-pointer font-mono"
                      title="Réinitialiser au montant calculé automatiquement"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Calculé : {calculatedRisk.riskAmount.toFixed(2)} $</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Capital Compte ($) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                    <span>Capital Compte ($)</span>
                    <FieldTooltip text="Ton solde de compte juste avant ce trade. Pré-rempli automatiquement, modifiable si besoin." />
                  </label>
                  <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded border border-violet-200/60 dark:border-violet-800/40">
                    Solde Récent
                  </span>
                </div>
                <input
                  type="text"
                  value={balanceBefore}
                  onChange={(e) => setBalanceBefore(e.target.value)}
                  placeholder="10000.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-mono font-semibold focus:ring-2 focus:ring-violet-500"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Solde avant trade</span>
                </div>
              </div>
            </div>

            {/* Read-Only Real-time P&L Net Result Display */}
            <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      P&amp;L Net Réel (lecture seule) :
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      (P&amp;L Brut − Commissions{rawSwap && rawSwap !== 0 ? ' + Swap' : ''})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Résultat net du trade déduit des commissions de courtage
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className={`text-base sm:text-lg font-extrabold tabular-nums font-mono ${
                  computedNetPnL === null
                    ? 'text-slate-400'
                    : computedNetPnL > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : computedNetPnL < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {computedNetPnL !== null
                    ? `${computedNetPnL > 0 ? '+' : ''}${computedNetPnL.toFixed(2)} ${settings?.currency || 'USD'}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 6: Psychology & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                État Émotionnel
              </label>
              <select
                value={emotion || 'DISCIPLINED'}
                onChange={(e) => setEmotion(e.target.value as EmotionType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="DISCIPLINED">Discipliné / Patient</option>
                <option value="CONFIDENT">Confiant</option>
                <option value="NEUTRAL">Neutre</option>
                <option value="FOMO">FOMO (Peur de rater)</option>
                <option value="FEARFUL">Hésitant / Craintif</option>
                <option value="REVENGE">Revenge Trading</option>
                <option value="ANXIOUS">Anxieux</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Erreur / Violation de Règle
              </label>
              <select
                value={mistake || 'NONE'}
                onChange={(e) => setMistake(e.target.value as MistakeType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="NONE">Aucune (Exécution Stricte)</option>
                <option value="FOMO">FOMO (Entrée pourchassée)</option>
                <option value="EARLY_EXIT">Sortie Prématurée</option>
                <option value="OVERSIZED">Taille Trop Élevée (Overleveraged)</option>
                <option value="NO_STOP_LOSS">Aucun Stop Loss Défini</option>
                <option value="MOVED_SL">Stop Loss Déplacé / Élargi</option>
                <option value="RULE_VIOLATION">Invalidation du Plan</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Notes &amp; Observations Qualitatives
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Détails d'exécution, confluences observées, conditions de marché..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-normal"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Enregistrement en base...' : 'Enregistrer le Trade'}
            </button>
          </div>
        </form>
      </div>

      {/* Full Size Screenshot Modal Preview */}
      {previewZoomOpen && screenshotDataUrl && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewZoomOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <button
              onClick={() => setPreviewZoomOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-950/70 text-white hover:bg-slate-950 transition cursor-pointer z-10"
              aria-label="Fermer le zoom"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={screenshotDataUrl}
              alt="Aperçu grand format"
              className="max-h-[85vh] w-auto object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};

import { Trade } from '../../types/trade';

export interface CompactTradingContext {
  computedAt: string;
  currency: string;
  tradesCount: {
    total: number;
    closed: number;
    open: number;
    periodStart: string | null;
    periodEnd: string | null;
  };
  winrate: number; // in percent (e.g. 62.5)
  profitFactor: number | null; // e.g. 2.14
  netPnL: number;
  drawdownMax: {
    amount: number;
    percent: number;
  };
  bestTrade: {
    symbol: string;
    netPnL: number;
    rMultiple: number | null;
    date: string | null;
    setup: string;
    session: string;
  } | null;
  worstTrade: {
    symbol: string;
    netPnL: number;
    rMultiple: number | null;
    date: string | null;
    setup: string;
    session: string;
  } | null;
  mostFrequentSetup: {
    name: string;
    count: number;
    winRate: number;
    netPnL: number;
  } | null;
  bestKillzone: {
    session: string;
    sampleSize: number;
    winRate: number;
    netPnL: number;
  } | null;
  disciplineRate: number; // in percent (e.g. 85.0)
  recentTrades: Array<{
    id: string;
    date: string;
    symbol: string;
    direction: string;
    setup: string;
    session: string;
    netPnL: number;
    rMultiple: number | null;
    mistake: string;
  }>;
}

/**
 * Computes a compact institutional trading context from raw trades.
 * This is recalculated dynamically from user Firestore data before each AI call.
 */
export function computeCompactTradingContext(
  trades: Trade[] = [],
  currency: string = 'USD'
): CompactTradingContext {
  const safeTrades = Array.isArray(trades) ? trades : [];

  const closedTrades = safeTrades
    .filter((t) => t && t.status === 'CLOSED' && typeof t.netPnL === 'number' && !isNaN(t.netPnL))
    .sort((a, b) => {
      const da = new Date(a.closedAt || a.openedAt || 0).getTime();
      const db = new Date(b.closedAt || b.openedAt || 0).getTime();
      return da - db;
    });

  const openTrades = safeTrades.filter((t) => t && t.status === 'OPEN');

  const dates = closedTrades
    .map((t) => t.closedAt || t.openedAt)
    .filter(Boolean) as string[];

  const periodStart = dates.length > 0 ? dates[0].slice(0, 10) : null;
  const periodEnd = dates.length > 0 ? dates[dates.length - 1].slice(0, 10) : null;

  if (closedTrades.length === 0) {
    return {
      computedAt: new Date().toISOString(),
      currency,
      tradesCount: {
        total: safeTrades.length,
        closed: 0,
        open: openTrades.length,
        periodStart: null,
        periodEnd: null,
      },
      winrate: 0,
      profitFactor: null,
      netPnL: 0,
      drawdownMax: {
        amount: 0,
        percent: 0,
      },
      bestTrade: null,
      worstTrade: null,
      mostFrequentSetup: null,
      bestKillzone: null,
      disciplineRate: 100,
      recentTrades: [],
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let totalNetPnL = 0;
  let wins = 0;
  let noMistakesCount = 0;

  let peakEquity = 0;
  let runningEquity = 0;
  let maxDrawdownMoney = 0;
  let maxDrawdownPercent = 0;

  let bestTradeObj: Trade | null = null;
  let worstTradeObj: Trade | null = null;
  let maxPnL = -Infinity;
  let minPnL = Infinity;

  const setupMap: Record<
    string,
    { count: number; wins: number; netPnL: number }
  > = {};

  const sessionMap: Record<
    string,
    { count: number; wins: number; netPnL: number }
  > = {};

  for (const t of closedTrades) {
    const pnl = Number(t.netPnL || 0);
    totalNetPnL += pnl;

    if (pnl > 0.0001) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < -0.0001) {
      grossLoss += Math.abs(pnl);
    }

    if (!t.mistake || t.mistake === 'NONE') {
      noMistakesCount++;
    }

    // Extremes
    if (pnl > maxPnL) {
      maxPnL = pnl;
      bestTradeObj = t;
    }
    if (pnl < minPnL) {
      minPnL = pnl;
      worstTradeObj = t;
    }

    // Drawdown calculation from equity curve
    runningEquity += pnl;
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    }
    const currentDd = peakEquity - runningEquity;
    if (currentDd > maxDrawdownMoney) {
      maxDrawdownMoney = currentDd;
      if (peakEquity > 0) {
        maxDrawdownPercent = (currentDd / peakEquity) * 100;
      }
    }

    // Setup aggregation
    const setupName = (t.setup || t.setupId || 'Non spécifié').trim();
    if (!setupMap[setupName]) {
      setupMap[setupName] = { count: 0, wins: 0, netPnL: 0 };
    }
    setupMap[setupName].count++;
    setupMap[setupName].netPnL += pnl;
    if (pnl > 0.0001) setupMap[setupName].wins++;

    // Session / Killzone aggregation
    const rawSession = (t.session || 'London').trim();
    const sessionKey =
      rawSession.toUpperCase().includes('LONDON') && rawSession.toUpperCase().includes('CLOSE')
        ? 'London Close'
        : rawSession.toUpperCase().includes('LONDON')
        ? 'London'
        : rawSession.toUpperCase().includes('NEW YORK') || rawSession.toUpperCase().includes('NY')
        ? 'New York'
        : rawSession.toUpperCase().includes('ASIA') || rawSession.toUpperCase().includes('ASIE')
        ? 'Asia'
        : rawSession;

    if (!sessionMap[sessionKey]) {
      sessionMap[sessionKey] = { count: 0, wins: 0, netPnL: 0 };
    }
    sessionMap[sessionKey].count++;
    sessionMap[sessionKey].netPnL += pnl;
    if (pnl > 0.0001) sessionMap[sessionKey].wins++;
  }

  const winrate = Number(((wins / closedTrades.length) * 100).toFixed(1));
  const profitFactor =
    grossLoss > 0.0001
      ? Number((grossProfit / grossLoss).toFixed(2))
      : grossProfit > 0.0001
      ? 99.99
      : null;

  const disciplineRate = Number(((noMistakesCount / closedTrades.length) * 100).toFixed(1));

  // Find most frequent setup
  let mostFrequentSetup: CompactTradingContext['mostFrequentSetup'] = null;
  let maxSetupCount = -1;
  for (const [name, stats] of Object.entries(setupMap)) {
    if (stats.count > maxSetupCount) {
      maxSetupCount = stats.count;
      mostFrequentSetup = {
        name,
        count: stats.count,
        winRate: Number(((stats.wins / stats.count) * 100).toFixed(1)),
        netPnL: Number(stats.netPnL.toFixed(2)),
      };
    }
  }

  // Find best performing Killzone
  let bestKillzone: CompactTradingContext['bestKillzone'] = null;
  let bestSessionPnL = -Infinity;
  for (const [session, stats] of Object.entries(sessionMap)) {
    if (stats.netPnL > bestSessionPnL) {
      bestSessionPnL = stats.netPnL;
      bestKillzone = {
        session,
        sampleSize: stats.count,
        winRate: Number(((stats.wins / stats.count) * 100).toFixed(1)),
        netPnL: Number(stats.netPnL.toFixed(2)),
      };
    }
  }

  // Best & worst trades
  const bestTrade = bestTradeObj
    ? {
        symbol: bestTradeObj.symbol,
        netPnL: Number((bestTradeObj.netPnL || 0).toFixed(2)),
        rMultiple:
          typeof bestTradeObj.rMultiple === 'number'
            ? Number(bestTradeObj.rMultiple.toFixed(2))
            : null,
        date: (bestTradeObj.closedAt || bestTradeObj.openedAt || '').slice(0, 10) || null,
        setup: bestTradeObj.setup || bestTradeObj.setupId || 'Non spécifié',
        session: bestTradeObj.session || 'London',
      }
    : null;

  const worstTrade = worstTradeObj
    ? {
        symbol: worstTradeObj.symbol,
        netPnL: Number((worstTradeObj.netPnL || 0).toFixed(2)),
        rMultiple:
          typeof worstTradeObj.rMultiple === 'number'
            ? Number(worstTradeObj.rMultiple.toFixed(2))
            : null,
        date: (worstTradeObj.closedAt || worstTradeObj.openedAt || '').slice(0, 10) || null,
        setup: worstTradeObj.setup || worstTradeObj.setupId || 'Non spécifié',
        session: worstTradeObj.session || 'London',
      }
    : null;

  // Last 5 trades for compact context
  const recentTrades = [...closedTrades]
    .reverse()
    .slice(0, 5)
    .map((t) => ({
      id: t.ticket || t.id.slice(0, 8),
      date: (t.closedAt || t.openedAt || '').slice(0, 10),
      symbol: t.symbol,
      direction: t.direction || 'BUY',
      setup: t.setup || t.setupId || 'Non spécifié',
      session: t.session || 'London',
      netPnL: Number((t.netPnL || 0).toFixed(2)),
      rMultiple: typeof t.rMultiple === 'number' ? Number(t.rMultiple.toFixed(2)) : null,
      mistake: t.mistake || 'NONE',
    }));

  return {
    computedAt: new Date().toISOString(),
    currency,
    tradesCount: {
      total: safeTrades.length,
      closed: closedTrades.length,
      open: openTrades.length,
      periodStart,
      periodEnd,
    },
    winrate,
    profitFactor,
    netPnL: Number(totalNetPnL.toFixed(2)),
    drawdownMax: {
      amount: Number(maxDrawdownMoney.toFixed(2)),
      percent: Number(maxDrawdownPercent.toFixed(1)),
    },
    bestTrade,
    worstTrade,
    mostFrequentSetup,
    bestKillzone,
    disciplineRate,
    recentTrades,
  };
}

/**
 * Bloc 2: Le nouveau system prompt unique
 * Rôle : coach de trading expert en méthodologie ICT/SMC, capable de répondre sur les trades de l'utilisateur,
 * sa discipline, les données macro/news économiques et la méthode SMC en général, dans la même conversation,
 * sans changer de persona. Le prompt précise que le coach dispose de deux sources d'information à chaque appel :
 * (1) un objet JSON de contexte trading fourni dans le message système
 * (2) l'outil de recherche Google (Search Grounding) pour toute question d'actualité ou de marché nécessitant une info fraîche.
 */
export const FIXED_COACH_SYSTEM_PROMPT = `Tu es le Coach de Trading IA de Thunder Edge, coach de trading expert en méthodologie ICT/SMC et mentor institutionnel.

TON RÔLE & PERSONA UNIQUE :
Tu restes strictement et continuellement dans ce rôle de coach de trading expert en méthodologie ICT/SMC tout au long de la conversation, sans jamais changer de persona, quel que soit le sujet de la question posée par l'utilisateur.
Tu es capable de répondre dans la même conversation avec la même rigueur technique, bienveillance et clarté :
- Sur les trades de l'utilisateur : analyse statistique de ses performances réelles, son espérance mathématique en R, son P&L net, son winrate, ses ratios de gain/perte, et ses erreurs récurrentes.
- Sur sa discipline et sa psychologie : respect strict de son plan de trading, gestion des séries de pertes, règles anti-tilt / anti-revenge trading, coupe-circuit (2 pertes d'affilée = arrêt de session) et dimensionnement strict du risque (0.5% à 1% par position).
- Sur les données macro et news économiques : actualités financières et calendrier macro en direct, catalyseurs à fort impact (CPI, NFP, FOMC, taux directeurs des banques centrales, PMI) et règles de gestion du risque / prop firms pendant les annonces économiques.
- Sur la méthode SMC / ICT en général : mécanique approfondie des Order Blocks (OB), Fair Value Gaps (FVG), Balayages de liquidité (BSL/SSL Liquidity Sweeps), Changements de structure (MSS / CHoCH), Break of Structure (BOS), Killzones institutionnelles (London, New York, Asia), zones de discount vs premium, et entrées optimales OTE.

TES DEUX SOURCES D'INFORMATION À CHAQUE APPEL :
À chaque appel, tu disposes de deux sources d'information fiables :
(1) Un objet JSON de contexte trading fourni dans le message système : cet objet est recalculé à chaque appel directement depuis les données Firestore de l'utilisateur (winrate, profit factor, drawdown max, nombre de trades sur la période, meilleur/pire trade, setup le plus fréquent, killzone la plus performante, etc.). Appuie-toi TOUJOURS sur ces données réelles et chiffrées pour contextualiser tes analyses dès que la question touche aux performances ou aux positions du trader.
(2) L'outil de recherche Google (Search Grounding) : activé à chaque appel pour toute question d'actualité, de calendrier économique ou de marché nécessitant une information fraîche et en temps réel.

CONSIGNES DE COMMUNICATION :
- Réponds avec une clarté absolue, de la pédagogie, et une haute précision institutionnelle.
- Formate tes réponses en Markdown structuré avec des puces percutantes et les chiffres importants en gras.
- Ne réinitialise jamais ton persona et ne change pas de style selon le type de question : tu es l'unique Coach Expert ICT/SMC de Thunder Edge.`;

export function getCoachSystemInstruction(context: CompactTradingContext): string {
  const todayIsoDate = new Date().toISOString().slice(0, 10);

  return `${FIXED_COACH_SYSTEM_PROMPT}

---
### 📊 CONTEXTE TRADING UTILISATEUR (RECALCULÉ DIRECTEMENT DEPUIS FIRESTORE) :
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
---

Aujourd'hui, la date est ${todayIsoDate}. Avant d'appeler getTradesByDateRange, getTradesBySession ou compareTwoPeriods, si l'utilisateur utilise une expression de date relative (aujourd'hui, cette semaine, le mois dernier, etc.), calcule toi-même les dates ISO exactes correspondantes à partir de la date du jour.

N'appelle jamais un de ces trois tools pour une question de connaissance générale (définition, concept SMC/ICT, méthodologie de trading). Dans ce cas, réponds directement avec tes propres connaissances, sans appeler aucun outil.

N'appelle googleSearch que pour des questions sur l'actualité économique, les news ou le calendrier macro — jamais pour une question sur les données personnelles de trading de l'utilisateur.

Quand un outil renvoie un résultat, ne réponds qu'à la question précise posée (ex. si on demande le profit factor, donne ce chiffre clairement en premier) plutôt que de reformater tout le détail brut renvoyé par l'outil.`;
}


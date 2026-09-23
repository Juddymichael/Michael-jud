import { Trade } from '../../types/trade';
import { getTradeSession } from '../sessionCalculator';

export interface SessionChartData {
  session: string; // Killzone label (e.g. London Killzone, New York Killzone)
  pnl: number;
  trades: number;
  winRate: number;
  wins: number;
  losses: number;
}

export interface TimeframeChartData {
  timeframe: string;
  pnl: number;
  trades: number;
  winRate: number;
  wins: number;
  losses: number;
}

export interface DayOfWeekChartData {
  day: string;
  dayIndex: number;
  pnl: number;
  trades: number;
  winRate: number;
  wins: number;
}

export interface HourlyChartData {
  hour: string;
  hourNum: number;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface KeyIndicatorData {
  disciplineRate: number;
  stopLossRespectRate: number;
  postLossWinRate: number;
  globalWinRate: number;
  postLossDisparity: number; // difference in winrate
  avgTradesPerDay: number;
  overtradingRisk: 'FAIBLE' | 'MODÉRÉ' | 'ÉLEVÉ';
  edgeScore: number;
}

export interface RecommendationItem {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'IMPORTANT' | 'SUGGESTION';
  category: 'Psychologie' | 'Risk Management' | 'Timing & Killzone' | 'Choix de Setup';
  impactEstimate: string;
  description: string;
  action: string;
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const ORDERED_WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

export function calculateAIAnalysisCharts(trades: Trade[], userTimezone: string = 'Indian/Antananarivo') {
  const safeTrades = (trades || []).filter((t) => t !== null && t !== undefined);
  const closedTrades = safeTrades.filter(
    (t) => t.status !== 'OPEN' && t.netPnL !== null && t.netPnL !== undefined
  );

  // 1. Killzone Breakdown (Strictly computed with getTradeKillzone / getTradeSession)
  const sessionMap = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
  // Pre-seed standard Killzones in chronological order
  const standardSessions = ['Asian Killzone', 'London Killzone', 'New York Killzone', 'London Close Killzone', 'Hors Killzone'];
  for (const s of standardSessions) {
    sessionMap.set(s, { pnl: 0, trades: 0, wins: 0, losses: 0 });
  }

  for (const t of closedTrades) {
    const s = getTradeSession(t, userTimezone);
    const cur = sessionMap.get(s) || { pnl: 0, trades: 0, wins: 0, losses: 0 };
    const pnl = t.netPnL ?? 0;
    cur.pnl += pnl;
    cur.trades++;
    if (pnl > 0.0001) cur.wins++;
    else if (pnl < -0.0001) cur.losses++;
    sessionMap.set(s, cur);
  }

  const sessionChartData: SessionChartData[] = Array.from(sessionMap.entries())
    .map(([session, data]) => ({
      session,
      pnl: Math.round(data.pnl * 100) / 100,
      trades: data.trades,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 1000) / 10 : 0,
      wins: data.wins,
      losses: data.losses,
    }))
    .filter((d) => d.trades > 0 || standardSessions.includes(d.session));

  // 2. Timeframe Breakdown
  const tfMap = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
  for (const t of closedTrades) {
    let tf = (t.timeframe || '').trim().toUpperCase();
    if (!tf) tf = 'Non spécifié';
    const cur = tfMap.get(tf) || { pnl: 0, trades: 0, wins: 0, losses: 0 };
    const pnl = t.netPnL ?? 0;
    cur.pnl += pnl;
    cur.trades++;
    if (pnl > 0.0001) cur.wins++;
    else if (pnl < -0.0001) cur.losses++;
    tfMap.set(tf, cur);
  }

  // Sort timeframes logically if known
  const TF_ORDER: Record<string, number> = {
    M1: 1,
    M3: 2,
    M5: 3,
    M15: 4,
    M30: 5,
    H1: 6,
    H2: 7,
    H4: 8,
    D1: 9,
    W1: 10,
    'Non spécifié': 99,
  };

  const timeframeChartData: TimeframeChartData[] = Array.from(tfMap.entries())
    .map(([timeframe, data]) => ({
      timeframe,
      pnl: Math.round(data.pnl * 100) / 100,
      trades: data.trades,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 1000) / 10 : 0,
      wins: data.wins,
      losses: data.losses,
    }))
    .sort((a, b) => (TF_ORDER[a.timeframe] || 50) - (TF_ORDER[b.timeframe] || 50));

  // 3. Day of Week Breakdown (Monday to Friday + others)
  const dayMap = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const d of ORDERED_WEEKDAYS) {
    dayMap.set(d, { pnl: 0, trades: 0, wins: 0 });
  }

  for (const t of closedTrades) {
    const dateStr = t.openedAt || t.closedAt;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      let dayIdx = d.getUTCDay();
      // Trades placed Sunday evening (market open / Asian killzone) belong to Monday
      if (dayIdx === 0) dayIdx = 1;
      // Weekend settlement belongs to Friday
      if (dayIdx === 6) dayIdx = 5;

      const dayName = ORDERED_WEEKDAYS[dayIdx - 1];
      const cur = dayMap.get(dayName) || { pnl: 0, trades: 0, wins: 0 };
      const pnl = t.netPnL ?? 0;
      cur.pnl += pnl;
      cur.trades++;
      if (pnl > 0.0001) cur.wins++;
      dayMap.set(dayName, cur);
    }
  }

  const dayOfWeekChartData: DayOfWeekChartData[] = ORDERED_WEEKDAYS.map((day, idx) => {
    const data = dayMap.get(day) || { pnl: 0, trades: 0, wins: 0 };
    return {
      day,
      dayIndex: idx + 1,
      pnl: Math.round(data.pnl * 100) / 100,
      trades: data.trades,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 1000) / 10 : 0,
      wins: data.wins,
    };
  });

  // 4. Hourly Breakdown (00h to 23h)
  const hourMap = new Map<number, { pnl: number; trades: number; wins: number }>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { pnl: 0, trades: 0, wins: 0 });
  }

  for (const t of closedTrades) {
    const d = new Date(t.openedAt || t.closedAt);
    if (!isNaN(d.getTime())) {
      // Get hour in target timezone
      let hour = d.getHours();
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          hour12: false,
        });
        hour = parseInt(formatter.format(d), 10) % 24;
      } catch {}

      const cur = hourMap.get(hour) || { pnl: 0, trades: 0, wins: 0 };
      const pnl = t.netPnL ?? 0;
      cur.pnl += pnl;
      cur.trades++;
      if (pnl > 0.0001) cur.wins++;
      hourMap.set(hour, cur);
    }
  }

  const hourlyChartData: HourlyChartData[] = Array.from(hourMap.entries())
    .map(([h, data]) => ({
      hour: `${h.toString().padStart(2, '0')}h`,
      hourNum: h,
      pnl: Math.round(data.pnl * 100) / 100,
      trades: data.trades,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 1000) / 10 : 0,
    }))
    // Filter to active hours (hours with trades or between 06h and 22h)
    .filter((d) => d.trades > 0 || (d.hourNum >= 6 && d.hourNum <= 22));

  // 5. Calculate Top 5 Key Indicators
  let cleanTrades = 0;
  let slRespectedTrades = 0;
  let totalWins = 0;
  const activeDays = new Set<string>();

  for (const t of closedTrades) {
    const pnl = t.netPnL ?? 0;
    if (pnl > 0.0001) totalWins++;

    // Discipline
    if (!t.mistake || t.mistake === 'NONE') cleanTrades++;

    // SL respect
    const mistake = (t.mistake || '').toUpperCase();
    if (mistake !== 'NO_STOP_LOSS' && mistake !== 'MOVED_SL' && mistake !== 'PAS_DE_STOP_LOSS' && mistake !== 'SL_DÉPLACÉ') {
      slRespectedTrades++;
    }

    // Active days count
    const dStr = (t.closedAt || t.openedAt).slice(0, 10);
    if (dStr) activeDays.add(dStr);
  }

  const disciplineRate = closedTrades.length > 0 ? Math.round((cleanTrades / closedTrades.length) * 100) : 100;
  const stopLossRespectRate = closedTrades.length > 0 ? Math.round((slRespectedTrades / closedTrades.length) * 100) : 100;
  const globalWinRate = closedTrades.length > 0 ? Math.round((totalWins / closedTrades.length) * 1000) / 10 : 0;

  // Post loss analysis
  let postLossTrades = 0;
  let postLossWins = 0;
  for (let i = 1; i < closedTrades.length; i++) {
    const prev = closedTrades[i - 1];
    const curr = closedTrades[i];
    if (prev.netPnL && prev.netPnL < -0.0001) {
      postLossTrades++;
      if (curr.netPnL && curr.netPnL > 0.0001) postLossWins++;
    }
  }
  const postLossWinRate = postLossTrades > 0 ? Math.round((postLossWins / postLossTrades) * 1000) / 10 : globalWinRate;
  const postLossDisparity = Math.round((postLossWinRate - globalWinRate) * 10) / 10;

  const numDays = Math.max(1, activeDays.size);
  const avgTradesPerDay = Math.round((closedTrades.length / numDays) * 10) / 10;
  let overtradingRisk: 'FAIBLE' | 'MODÉRÉ' | 'ÉLEVÉ' = 'FAIBLE';
  if (avgTradesPerDay > 5) overtradingRisk = 'ÉLEVÉ';
  else if (avgTradesPerDay > 3) overtradingRisk = 'MODÉRÉ';

  // Overall Edge Score
  let edgeScore = 50;
  if (globalWinRate >= 55) edgeScore += 15;
  else if (globalWinRate >= 45) edgeScore += 5;
  else edgeScore -= 10;

  if (disciplineRate >= 85) edgeScore += 15;
  else if (disciplineRate >= 70) edgeScore += 5;
  else edgeScore -= 10;

  if (stopLossRespectRate >= 90) edgeScore += 10;
  else edgeScore -= 10;

  if (postLossDisparity >= 0) edgeScore += 10;
  else if (postLossDisparity < -15) edgeScore -= 10;

  edgeScore = Math.max(10, Math.min(98, Math.round(edgeScore)));

  const keyIndicators: KeyIndicatorData = {
    disciplineRate,
    stopLossRespectRate,
    postLossWinRate,
    globalWinRate,
    postLossDisparity,
    avgTradesPerDay,
    overtradingRisk,
    edgeScore,
  };

  // 6. Generate Smart Recommendations & Leak Alerts
  const recommendations: RecommendationItem[] = [];

  // Check 1: Out of Killzone Leaks
  const outOfSession = sessionChartData.find((s) => s.session === 'Hors Killzone' || s.session === 'Hors session');
  if (outOfSession && outOfSession.trades > 0 && outOfSession.pnl < 0) {
    recommendations.push({
      id: 'leak-session',
      title: 'Fuite de capital sur les trades "Hors Killzone"',
      severity: 'CRITICAL',
      category: 'Timing & Killzone',
      impactEstimate: `+${Math.abs(Math.round(outOfSession.pnl))}$ récupérables`,
      description: `Vous avez réalisé ${outOfSession.trades} trades en dehors des Killzones majeures avec un bilan négatif de ${Math.round(outOfSession.pnl)}$. Le manque de liquidité et de volatilité institutionnelle dégrade votre avantage.`,
      action: 'Bloquez vos exécutions hors des créneaux London Killzone et New York Killzone.',
    });
  }

  // Check 2: Stop loss respect leak
  if (stopLossRespectRate < 90) {
    recommendations.push({
      id: 'leak-sl',
      title: 'Non-respect ou déplacement du Stop Loss',
      severity: 'CRITICAL',
      category: 'Risk Management',
      impactEstimate: 'Protection du capital',
      description: `Sur ${closedTrades.length - slRespectedTrades} trades, le Stop Loss n'a pas été rigoureusement respecté ou a été reculé pendant la position, exposant votre compte à un risque asymétrique destructeur.`,
      action: 'Adoptez la règle du "Set and Forget" : une fois le SL placé sur invalidation technique, il ne doit jamais être élargi.',
    });
  }

  // Check 3: Post-Loss Drop (Revenge Trading)
  if (postLossTrades >= 3 && postLossDisparity < -10) {
    recommendations.push({
      id: 'leak-post-loss',
      title: 'Chute de lucidité post-perte (Revenge Trading)',
      severity: 'IMPORTANT',
      category: 'Psychologie',
      impactEstimate: `+${Math.abs(postLossDisparity)}% de winrate visé`,
      description: `Votre winrate chute de ${globalWinRate}% à ${postLossWinRate}% immédiatement après avoir encaissé une perte. Ce biais traduit une précipitation à vouloir "se refaire" sans attendre un setup A+.`,
      action: 'Instaurez un temps mort obligatoire de 15 minutes minimum après chaque trade clôturé en perte.',
    });
  }

  // Check 4: Overtrading
  if (overtradingRisk === 'ÉLEVÉ') {
    recommendations.push({
      id: 'leak-overtrading',
      title: 'Fréquence de trading excessive (Overtrading)',
      severity: 'IMPORTANT',
      category: 'Psychologie',
      impactEstimate: 'Réduction des commissions & fatigue',
      description: `Vous prenez en moyenne ${avgTradesPerDay} trades par jour actif. La dilution de l'attention sur trop d'opportunités réduit la qualité d'exécution.`,
      action: 'Fixez un plafond strict de 2 à 3 trades maximum par Killzone.',
    });
  }

  // Check 5: Setup Specialization
  recommendations.push({
    id: 'opt-specialization',
    title: 'Concentration sur vos configurations à plus haute espérance',
    severity: 'SUGGESTION',
    category: 'Choix de Setup',
    impactEstimate: 'Optimisation du Profit Factor',
    description: 'Vos configurations phares délivrent une rentabilité nettement supérieure à vos entrées secondaires ou improvisées.',
    action: 'Auditez vos setups dans "My Edge Analyzer" et éliminez les patterns affichant une espérance négative.',
  });

  return {
    sessionChartData,
    timeframeChartData,
    dayOfWeekChartData,
    hourlyChartData,
    keyIndicators,
    recommendations,
  };
}

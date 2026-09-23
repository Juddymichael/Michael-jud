import { CoachContextPayload } from './coachContext';
import { formatCurrency, formatPercent, formatRMultiple } from './formatting';

export interface AIAnalysisReport {
  executiveSummary: string;
  strengths: string[];
  improvements: string[];
  edgeScore: number;
  verdictKey: string;
  actionableRule: string;
}

export function generateLocalAnalysis(context: CoachContextPayload): AIAnalysisReport {
  const { summary, setups, sessions, pairs, mistakes, postLossBehavior, myEdgeVerdict } = context;

  const totalTrades = summary.closedTrades;
  const winRate = summary.winRate;
  const pf = summary.profitFactor ?? 0;
  const netPnL = summary.netPnL;
  const discipline = summary.disciplineRate;

  // Calculate local score
  let score = 50;
  if (winRate >= 55) score += 15;
  else if (winRate >= 45) score += 5;
  else score -= 10;

  if (pf >= 2.0) score += 20;
  else if (pf >= 1.4) score += 10;
  else if (pf < 1.0) score -= 15;

  if (discipline >= 85) score += 15;
  else if (discipline >= 70) score += 5;
  else score -= 10;

  if (summary.maxDrawdownPercent < 10) score += 10;
  else if (summary.maxDrawdownPercent > 20) score -= 10;

  score = Math.max(15, Math.min(96, Math.round(score)));

  // Strengths
  const strengths: string[] = [];
  if (discipline >= 80) {
    strengths.push(`Taux de discipline élevé (${discipline}%) : respect strict des règles de trading sur la majorité des positions.`);
  }
  if (myEdgeVerdict.bestSession) {
    const bestSess = sessions.find((s) => s.session === myEdgeVerdict.bestSession);
    if (bestSess) {
      strengths.push(`Excellente performance sur la session ${bestSess.session} (${formatCurrency(bestSess.netPnL)} avec ${formatPercent(bestSess.winRate)} de winrate).`);
    }
  }
  if (myEdgeVerdict.bestSetup) {
    const bestSet = setups.find((s) => s.name === myEdgeVerdict.bestSetup);
    if (bestSet) {
      strengths.push(`Setup phare "${bestSet.name}" très profitable (${formatCurrency(bestSet.netPnL)}, PF: ${bestSet.profitFactor?.toFixed(2) || 'N/A'}).`);
    }
  }
  if (strengths.length < 3 && summary.rExpectancy && summary.rExpectancy > 0.4) {
    strengths.push(`Espérance mathématique positive de ${formatRMultiple(summary.rExpectancy)} par trade, garantissant une asymétrie favorable.`);
  }
  if (strengths.length < 3) {
    strengths.push(`Gestion rigoureuse du risque avec un drawdown maximum contenu à ${formatPercent(summary.maxDrawdownPercent)} (${formatCurrency(summary.maxDrawdownMoney)}).`);
  }

  // Improvements
  const improvements: string[] = [];
  if (mistakes.length > 0 && mistakes[0].totalCost > 0) {
    improvements.push(`Fuite de capital identifiée sur l'erreur "${mistakes[0].mistake}" (${formatCurrency(mistakes[0].totalCost)} de pertes évitables sur ${mistakes[0].count} trades).`);
  }
  if (postLossBehavior.tradesImmediatelyAfterLoss >= 2) {
    const diff = postLossBehavior.winrateOutsidePostLossWindow - postLossBehavior.winrateInPostLossWindow;
    if (diff > 0) {
      improvements.push(`Baisse de performance post-perte : winrate de ${formatPercent(postLossBehavior.winrateInPostLossWindow)} dans la fenêtre de ${postLossBehavior.windowMinutes} min contre ${formatPercent(postLossBehavior.winrateOutsidePostLossWindow)} hors fenêtre (risque de revenge trading).`);
    } else {
      improvements.push(`Discipline post-perte : winrate de ${formatPercent(postLossBehavior.winrateInPostLossWindow)} dans la fenêtre de vigilance contre ${formatPercent(postLossBehavior.winrateOutsidePostLossWindow)} hors fenêtre.`);
    }
  }
  if (myEdgeVerdict.worstSession) {
    const worstSess = sessions.find((s) => s.session === myEdgeVerdict.worstSession);
    if (worstSess && worstSess.netPnL < 0) {
      improvements.push(`Sous-performance notable sur la session ${worstSess.session} (${formatCurrency(worstSess.netPnL)}) : envisagez de restreindre le trading sur ce créneau.`);
    }
  }
  if (improvements.length < 3 && discipline < 85) {
    improvements.push(`Renforcer le respect du Stop Loss initial pour hisser le taux de discipline au-delà du seuil institutionnel de 85%.`);
  }
  if (improvements.length < 3) {
    improvements.push(`Augmenter la sélectivité pour éliminer les setups secondaires à faible échantillon statistique.`);
  }

  // Verdict
  let verdictKey = "Edge En Développement";
  if (score >= 80) verdictKey = "Edge Confirmé & Robuste";
  else if (score >= 65) verdictKey = "Performance Positive & Structurée";
  else if (score >= 50) verdictKey = "Discipline à Stabiliser";
  else verdictKey = "Ajustement Stratégique Requis";

  // Executive summary
  const pnlFormatted = formatCurrency(netPnL);
  const winRateFormatted = formatPercent(winRate);
  const pfFormatted = pf.toFixed(2);
  const expFormatted = summary.rExpectancy ? formatRMultiple(summary.rExpectancy) : 'N/A';

  const executiveSummary = totalTrades < 5
    ? `L'analyse porte sur un échantillon préliminaire de ${totalTrades} trades clôturés. Avec un P&L net de ${pnlFormatted} (${winRateFormatted} de winrate), les bases sont posées mais nécessitent un volume de trades plus conséquent pour valider statistiquement la robustesse de votre avantage de marché.`
    : `Sur un échantillon de ${totalTrades} trades clôturés, votre trading affiche un P&L net cumulé de ${pnlFormatted} avec un winrate de ${winRateFormatted} et un Profit Factor de ${pfFormatted}. Votre espérance par trade s'établit à ${expFormatted}, soutenue par une discipline globale de ${discipline}%. La priorité absolue réside dans l'élimination des fuites hors session et le contrôle émotionnel immédiat après un trade perdant.`;

  const actionableRule = mistakes.length > 0 && mistakes[0].mistake !== 'NONE'
    ? `Règle d'or : Interdiction d'exécuter un trade sous l'impulsion de "${mistakes[0].mistake}". Attendre confirmation HTF systématique.`
    : `Règle d'or : Limiter vos interventions exclusivement à vos sessions de prédilection (${myEdgeVerdict.bestSession || 'London/New York'}) avec un risque maximum fixé par trade.`;

  return {
    executiveSummary,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    edgeScore: score,
    verdictKey,
    actionableRule,
  };
}

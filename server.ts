import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { COACH_TOOLS, executeCoachTool } from './src/lib/coach/coachTools';
import { generateLocalAnalysis } from './src/lib/localAnalysisEngine';
import { generateSmartCoachResponse } from './src/lib/coach/smartTradingEngine';
import {
  computeCompactTradingContext,
  getCoachSystemInstruction,
} from './src/lib/coach/compactTradingContext';
import {
  loadAppletConfig,
  verifyFirebaseIdToken,
  fetchUserTradesFromFirestore,
} from './src/lib/coach/serverFirestore';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Track any API key that was rejected with 401 UNAUTHENTICATED
let cachedAuthFailedKey: string | null = null;

// Helper to check for a valid Gemini API key format (Google AI Studio keys start with 'AIza')
function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key.length < 20) return false;
  // If this key was already checked and rejected by the API, skip remote calls
  if (cachedAuthFailedKey === key) return false;
  // Valid Google AI Studio / GCP API keys start with 'AIza'
  if (!key.startsWith('AIza')) {
    return false;
  }
  return true;
}

// Lazy initializer for Google GenAI client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Analysis endpoint (Structured JSON report)
app.post('/api/coach/analyze', async (req, res) => {
  try {
    const { context } = req.body;
    let reportData: any = null;

    if (hasValidGeminiKey()) {
      try {
        const ai = getGenAI();
        const contextJson = context ? JSON.stringify(context, null, 2) : 'Aucun trade disponible.';

        const prompt = `
Tu es l'analyste en chef quantitatif et psychologue de trading pour Thunder Edge.
Analyse les données réelles et vérifiées du trader fournies ci-dessous :

\`\`\`json
${contextJson}
\`\`\`

Génère un rapport d'audit exécutif institutionnel au format JSON strict avec la structure exacte suivante :
{
  "executiveSummary": "Un paragraphe percutant (3-4 phrases en français) résumant la performance globale, la santé de l'edge et le profil de risque du trader.",
  "strengths": [
    "Point fort 1 basé sur des chiffres réels (ex: winrate élevé sur London, bon R:R)",
    "Point fort 2 (ex: discipline exemplaire sur les stop loss)",
    "Point fort 3 (ex: setup le plus rentable identifié)"
  ],
  "improvements": [
    "Axe d'amélioration 1 prioritaire chiffré (ex: fuite de capital sur les trades hors session)",
    "Axe d'amélioration 2 (ex: réaction après une série de pertes)",
    "Axe d'amélioration 3 (ex: gestion des erreurs déclarées)"
  ],
  "edgeScore": 78, // Nombre entier entre 0 et 100 évaluant la solidité statistique de son edge
  "verdictKey": "Edge Solide & Éprouvé", // Titre court synthétique (ex: 'Edge Validé', 'Phase d'Optimisation', 'Discipline à Renforcer')
  "actionableRule": "Une règle concrète et immédiatement applicable dès la prochaine session de trading."
}

RÈGLES STRICTES :
1. Base-toi EXCLUSIVEMENT sur les chiffres fournis dans le JSON. Ne pas inventer de données.
2. Si le nombre de trades est faible (< 5), mentionne-le avec prudence et adapte l'edgeScore.
3. Données de Risk/Reward et Espérance : Le JSON contient summary.incompleteTrades et summary.incompleteRatioPercent.
   - Si summary.incompleteRatioPercent > 15%, tu DOIS OBLIGATOIREMENT inclure un avertissement explicite dans le "executiveSummary" indiquant qu'une part significative de l'historique (${context?.summary?.incompleteRatioPercent || 0}% de trades incomplets) manque de niveaux de risque/sortie précis, ce qui rend l'Espérance R provisoire ou sous-évaluée.
4. Analyse Obligatoire du Revenge Trading & Vigilance Post-Perte :
   - Le JSON contient postLossBehavior avec winrateInPostLossWindow, winrateOutsidePostLossWindow, tradesImmediatelyAfterLoss et windowMinutes (${context?.postLossBehavior?.windowMinutes || 60} min).
   - Tu DOIS OBLIGATOIREMENT comparer dans le "executiveSummary" le winrate dans la fenêtre post-perte (winrateInPostLossWindow: ${context?.postLossBehavior?.winrateInPostLossWindow !== undefined ? context.postLossBehavior.winrateInPostLossWindow.toFixed(1) + '%' : 'N/A'}) par rapport au winrate hors fenêtre post-perte (winrateOutsidePostLossWindow: ${context?.postLossBehavior?.winrateOutsidePostLossWindow !== undefined ? context.postLossBehavior.winrateOutsidePostLossWindow.toFixed(1) + '%' : 'N/A'}).
   - Si une chute de performance ou un réflexe de revenge trading est mis en évidence, formule une consigne de discipline pour la fenêtre de vigilance post-perte.
5. Le format de sortie doit être un JSON pur et valide.
`;

        const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                temperature: 0.2,
              },
            });

            if (response && response.text) {
              const parsed = JSON.parse(response.text.trim());
              if (parsed && parsed.executiveSummary) {
                reportData = parsed;
                break;
              }
            }
          } catch (mErr: any) {
            const errMsg = String(mErr?.message || '');
            const isAuthError =
              mErr?.status === 401 ||
              mErr?.status === 403 ||
              errMsg.includes('401') ||
              errMsg.includes('UNAUTHENTICATED');
            if (isAuthError) {
              cachedAuthFailedKey = process.env.GEMINI_API_KEY?.trim() || null;
              break;
            }
          }
          if (reportData) break;
        }
      } catch {
        // Quietly switch to local analysis engine
      }
    }

    if (!reportData) {
      // Deterministic quantitative fallback
      reportData = generateLocalAnalysis(context || {
        summary: {
          closedTrades: 0,
          winRate: 0,
          profitFactor: 0,
          netPnL: 0,
          disciplineRate: 0,
          maxDrawdownPercent: 0,
          maxDrawdownMoney: 0,
        },
        setups: [],
        sessions: [],
        pairs: [],
        mistakes: [],
        postLossBehavior: {
          windowMinutes: 60,
          tradesImmediatelyAfterLoss: 0,
          winrateInPostLossWindow: 0,
          winrateOutsidePostLossWindow: 0,
        },
        myEdgeVerdict: {},
      });
    }

    return res.json({
      success: true,
      report: reportData,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    const fallbackReport = generateLocalAnalysis(req.body?.context || {
      summary: {
        closedTrades: 0,
        winRate: 0,
        profitFactor: 0,
        netPnL: 0,
        disciplineRate: 0,
        maxDrawdownPercent: 0,
        maxDrawdownMoney: 0,
      },
      setups: [],
      sessions: [],
      pairs: [],
      mistakes: [],
      postLossBehavior: {
        windowMinutes: 60,
        tradesImmediatelyAfterLoss: 0,
        winrateInPostLossWindow: 0,
        winrateOutsidePostLossWindow: 0,
      },
      myEdgeVerdict: {},
    });

    return res.json({
      success: true,
      report: fallbackReport,
      generatedAt: new Date().toISOString(),
    });
  }
});

// Conversational AI Coach endpoint with function calling
app.post('/api/coach/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Le message est requis.' });
    }

    const isDemoMode = req.headers['x-demo-mode'] === 'true';
    let trades: any[] = [];
    let authenticatedUid: string | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && !isDemoMode) {
      const idToken = authHeader.split(' ')[1];
      const appConfig = loadAppletConfig();

      try {
        const authUser = await verifyFirebaseIdToken(idToken, [
          appConfig.apiKey,
          appConfig.fallbackApiKey || '',
        ]);
        if (authUser && authUser.uid) {
          authenticatedUid = authUser.uid;
          trades = await fetchUserTradesFromFirestore(authUser.uid, idToken, appConfig);
        }
      } catch {
        // Fallback to client-provided trades if token verification or Firestore fails
      }
    }

    // If no trades from Firestore or unauthenticated/demo, use client-provided trades
    const clientTrades = Array.isArray(req.body.demoTrades)
      ? req.body.demoTrades
      : Array.isArray(req.body.trades)
      ? req.body.trades
      : [];
    if (clientTrades.length > 0 && (trades.length === 0 || clientTrades.length >= trades.length)) {
      trades = clientTrades;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const ai = getGenAI();

    // Model selection (gemini-3.8-flash default, gemini-3.5-flash for search, gemini-3.1-pro-preview, gemini-3.1-flash-lite)
    const validModels = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'];
    const chosenModel = validModels.includes(req.body.model) ? req.body.model : 'gemini-3.8-flash';

    // Bloc 3: Calculate compact JSON context from user Firestore trades (recalculated dynamically at every call)
    // Le contexte trading reste séparé de l'historique et n'est jamais tronqué ni résumé.
    const userCurrency = req.body.currency || 'USD';
    const compactTradingContext = computeCompactTradingContext(trades, userCurrency);

    // Bloc 2: Fixed unique system prompt with injected freshly recalculated context
    const systemInstruction = getCoachSystemInstruction(compactTradingContext);

    // Bloc 4: Troncature de l'historique - n'envoyer que les 3 à 5 derniers tours (user/assistant)
    // au lieu de l'historique complet. Le contexte trading (Bloc 3) reste séparé.
    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      // 1 tour = 1 message utilisateur + 1 réponse assistant. On conserve les 4 derniers tours (jusqu'à 8 messages)
      const MAX_PREVIOUS_TURNS = 4;
      const recentHistory = history.slice(-(MAX_PREVIOUS_TURNS * 2));
      let expectedRole: 'user' | 'model' = 'user';

      for (const item of recentHistory) {
        const itemRole = item.role === 'user' ? 'user' : (item.role === 'model' || item.role === 'assistant') ? 'model' : null;
        if (!itemRole || itemRole !== expectedRole) continue;

        const textContent = String(item.content || '').trim();
        if (textContent) {
          contents.push({
            role: itemRole,
            parts: [{ text: textContent }],
          });
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        }
      }

      // Si le dernier message assaini était déjà un message user, le retirer afin que le prompt actuel soit le tour utilisateur actif
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents.pop();
      }
    }

    // Ajouter le message actuel de l'utilisateur
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const toolInvocations: Array<{
      name: string;
      args: Record<string, any>;
      result?: Record<string, any>;
    }> = [];

    const searchSources: Array<{ title: string; url: string }> = [];

    let currentResponse: any = null;
    let loopCount = 0;
    const MAX_TOOL_TURNS = 5;

    // Bloc 5: Activation du Search Grounding sur les appels à Gemini
    // Permet au modèle de chercher lui-même une info d'actualité (news économiques, calendrier macro) quand la question le nécessite,
    // sans aucune logique de routage manuelle côté code.
    const toolsConfig: any[] = [
      { googleSearch: {} },
      { functionDeclarations: COACH_TOOLS },
    ];

    const requestConfig: any = {
      systemInstruction,
      tools: toolsConfig,
      toolConfig: { includeServerSideToolInvocations: true },
    };

    const modelCandidates = [
      chosenModel || 'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let geminiError: any = !hasValidGeminiKey();
    if (hasValidGeminiKey()) {
      for (const modelToTry of modelCandidates) {
        try {
          loopCount = 0;
          let turnResponse: any = null;
          const turnContents = [...contents];

          while (loopCount < MAX_TOOL_TURNS) {
            loopCount++;

            const generatePromise = ai.models.generateContent({
              model: modelToTry,
              contents: turnContents,
              config: requestConfig,
            });

            // Timeout of 8 seconds per turn so request never blocks indefinitely
            const generateResult = await Promise.race([
              generatePromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Délai d’attente Gemini dépassé (8s)')), 8000)
              ),
            ]);

            turnResponse = generateResult;
            const functionCalls = generateResult.functionCalls;

            if (!functionCalls || functionCalls.length === 0) {
              // No more tool calls, we have the final textual answer
              break;
            }

            // Record model candidate in conversation
            if (generateResult.candidates?.[0]?.content) {
              turnContents.push(generateResult.candidates[0].content);
            }

            // Execute all tool calls requested by the model
            const toolResponseParts: any[] = [];
            for (const call of functionCalls) {
              const { name, args } = call;
              let resultData: any;
              try {
                resultData = executeCoachTool(name, (args as any) || {}, trades);
              } catch (err: any) {
                resultData = { error: err?.message || 'Erreur lors de l’exécution de l’outil.' };
              }

              toolInvocations.push({
                name,
                args: (args as any) || {},
                result: resultData,
              });

              toolResponseParts.push({
                functionResponse: {
                  name,
                  response: resultData,
                },
              });
            }

            turnContents.push({
              role: 'user',
              parts: toolResponseParts,
            });
          }

          if (turnResponse?.text) {
            currentResponse = turnResponse;
            // Extract Google Search Grounding metadata if available
            const groundingMeta = currentResponse?.candidates?.[0]?.groundingMetadata;
            if (groundingMeta && Array.isArray(groundingMeta.groundingChunks)) {
              for (const chunk of groundingMeta.groundingChunks) {
                if (chunk.web?.uri) {
                  searchSources.push({
                    title: chunk.web.title || chunk.web.uri,
                    url: chunk.web.uri,
                  });
                }
              }
            }
            break; // Successfully obtained a response!
          }
        } catch (mErr: any) {
          const errMsg = String(mErr?.message || '');
          const isAuthError =
            mErr?.status === 401 ||
            mErr?.status === 403 ||
            errMsg.includes('401') ||
            errMsg.includes('UNAUTHENTICATED') ||
            errMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED');

          if (isAuthError) {
            cachedAuthFailedKey = process.env.GEMINI_API_KEY?.trim() || null;
            // Break immediately so we don't try other models with the same invalid key
            break;
          }
        }
      }

      if (!currentResponse?.text) {
        geminiError = true;
      }
    }

    let replyText = currentResponse?.text;

    // Intelligently generate response with specialized smart trading engine
    if (!replyText) {
      const smartResult = await generateSmartCoachResponse(
        message,
        trades,
        userCurrency,
        compactTradingContext,
        history
      );
      replyText = smartResult.reply;
      toolInvocations.push(...smartResult.toolInvocations);
      if (smartResult.searchSources) {
        searchSources.push(...smartResult.searchSources);
      }
    }

    return res.json({
      success: true,
      reply: replyText,
      toolInvocations,
      searchSources: searchSources.length > 0 ? searchSources : undefined,
      compactTradingContext,
      model: chosenModel,
      tradesEvaluatedCount: trades.length,
    });
  } catch (error: any) {
    console.log('[Coach Chat] Handled exception:', error instanceof Error ? error.message : 'Unknown chat error');
    return res.status(500).json({
      error: 'Une erreur est survenue lors de la discussion avec le Coach IA.',
    });
  }
});

// Setup server and Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Thunder Edge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import { useState, useCallback, useEffect, useTransition } from 'react';
import { CoachContextPayload } from '../lib/coachContext';
import { AIAnalysisReport, generateLocalAnalysis } from '../lib/localAnalysisEngine';

const STORAGE_KEY = 'thunder_edge_ai_analysis_report';
const STORAGE_TIME_KEY = 'thunder_edge_ai_analysis_timestamp';

interface UseAIAnalysisResult {
  report: AIAnalysisReport | null;
  isAnalyzing: boolean;
  error: string | null;
  lastAnalyzedAt: string | null;
  isUsingFallback: boolean;
  runAnalysis: (context: CoachContextPayload, forceRefresh?: boolean) => Promise<void>;
}

export function useAIAnalysis(): UseAIAnalysisResult {
  const [report, setReport] = useState<AIAnalysisReport | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_TIME_KEY) || null;
    } catch {
      return null;
    }
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [, startTransition] = useTransition();

  const runAnalysis = useCallback(
    async (context: CoachContextPayload, forceRefresh: boolean = false) => {
      setIsAnalyzing(true);
      setError(null);
      setIsUsingFallback(false);

      try {
        const response = await fetch('/api/coach/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Erreur serveur HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data && data.report) {
          const newReport = data.report as AIAnalysisReport;
          const time = data.generatedAt || new Date().toISOString();

          startTransition(() => {
            setReport(newReport);
            setLastAnalyzedAt(time);
            setIsUsingFallback(false);
          });

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newReport));
            localStorage.setItem(STORAGE_TIME_KEY, time);
          } catch {}
          return;
        }
        throw new Error('Réponse invalide du serveur.');
      } catch (err: any) {
        console.warn('[AI Analysis] Fallback to local analysis engine:', err.message);
        // Seamless fallback to deterministic local analysis
        const localReport = generateLocalAnalysis(context);
        const time = new Date().toISOString();

        startTransition(() => {
          setReport(localReport);
          setLastAnalyzedAt(time);
          setIsUsingFallback(true);
          setError(
            err?.message?.includes('Clé API')
              ? 'Mode local activé (Clé Gemini en attente de configuration).'
              : 'Analyse locale instantanée générée.'
          );
        });

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localReport));
          localStorage.setItem(STORAGE_TIME_KEY, time);
        } catch {}
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  return {
    report,
    isAnalyzing,
    error,
    lastAnalyzedAt,
    isUsingFallback,
    runAnalysis,
  };
}

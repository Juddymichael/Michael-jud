import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckSquare,
  Square,
  Shield,
  Clock,
  Target,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Sparkles,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';

interface RoutineItem {
  id: string;
  label: string;
  category: 'PRE_SESSION' | 'DURING' | 'POST_SESSION';
  checked: boolean;
}

const DEFAULT_ROUTINES: RoutineItem[] = [
  { id: '1', label: 'Vérifier le calendrier économique (ForexFactory / High Impact News)', category: 'PRE_SESSION', checked: false },
  { id: '2', label: 'Identifier le HTF Bias (D1 / H4 Market Structure & Liquidity Pool)', category: 'PRE_SESSION', checked: false },
  { id: '3', label: 'Tracer les Killzones actives (Asia Range, London Open, NY Open)', category: 'PRE_SESSION', checked: false },
  { id: '4', label: 'Attendre un Liquidity Sweep net + Market Structure Shift (MSS / CISD)', category: 'DURING', checked: false },
  { id: '5', label: 'Calculer le risque en % fixe (max 1% par trade) avec Stop Loss technique', category: 'DURING', checked: false },
  { id: '6', label: 'Objectif minimum 1:2 Risk/Reward avant validation de l’entrée', category: 'DURING', checked: false },
  { id: '7', label: 'Règle des 2 pertes max : arrêt immédiat du trading si 2 SL consécutifs', category: 'DURING', checked: false },
  { id: '8', label: 'Journaliser le trade avec capture d’écran et tag émotionnel dans Thunder Edge', category: 'POST_SESSION', checked: false },
  { id: '9', label: 'Débriefer les erreurs éventuelles et calculer l’écart de discipline', category: 'POST_SESSION', checked: false },
];

const STORAGE_KEY = 'thunder_edge_trading_plans';

export const TradingPlansView: React.FC = () => {
  const [routines, setRoutines] = useState<RoutineItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ROUTINES;
    } catch {
      return DEFAULT_ROUTINES;
    }
  });

  const [newRule, setNewRule] = useState('');
  const [newCategory, setNewCategory] = useState<'PRE_SESSION' | 'DURING' | 'POST_SESSION'>('PRE_SESSION');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
    } catch {}
  }, [routines]);

  const toggleCheck = (id: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const handleResetChecklist = () => {
    setRoutines((prev) => prev.map((r) => ({ ...r, checked: false })));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;
    const item: RoutineItem = {
      id: `rule-${Date.now()}`,
      label: newRule.trim(),
      category: newCategory,
      checked: false,
    };
    setRoutines([...routines, item]);
    setNewRule('');
  };

  const handleDeleteRule = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const preSession = routines.filter((r) => r.category === 'PRE_SESSION');
  const duringSession = routines.filter((r) => r.category === 'DURING');
  const postSession = routines.filter((r) => r.category === 'POST_SESSION');

  const total = routines.length;
  const completed = routines.filter((r) => r.checked).length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header card */}
      <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7C3AED] dark:bg-[#8B5CF6] flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                Plans &amp; Stratégies de Trading
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#8B92A0]">
                Checklist d&apos;exécution rigoureuse, règles de risque et routine pré-killzone
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#8B92A0] block font-mono">
                Validation du plan
              </span>
              <span className="text-sm font-black text-[#7C3AED] dark:text-[#8B5CF6] font-mono tabular-nums">
                {completed} / {total} ({progressPercent}%)
              </span>
            </div>
            <button
              onClick={handleResetChecklist}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200/60 dark:border-[#1C2430] hover:bg-slate-100 dark:hover:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] transition-colors cursor-pointer"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-[#181F2A] rounded-full mt-4 overflow-hidden">
          <div
            className="h-full bg-[#7C3AED] dark:bg-[#8B5CF6] transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3 Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pre Session */}
        <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-[#7C3AED] dark:text-[#8B5CF6]">
            <Clock className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
              1. Pré-Killzone (Préparation)
            </h3>
          </div>
          <div className="space-y-2">
            {preSession.map((r) => (
              <div
                key={r.id}
                onClick={() => toggleCheck(r.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  r.checked
                    ? 'bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40 text-[#6B7280] dark:text-[#8B92A0] line-through'
                    : 'bg-[#F7F8FA] dark:bg-[#181F2A] border-slate-200/60 dark:border-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] hover:border-[#7C3AED] dark:hover:border-[#8B5CF6]'
                }`}
              >
                {r.checked ? (
                  <CheckSquare className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-[#6B7280] dark:text-[#8B92A0] shrink-0 mt-0.5" />
                )}
                <span className="text-xs font-medium leading-tight flex-1">{r.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRule(r.id);
                  }}
                  className="opacity-0 hover:opacity-100 text-[#6B7280] dark:text-[#8B92A0] hover:text-[#EF4444] p-0.5"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* During Killzone */}
        <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-[#7C3AED] dark:text-[#8B5CF6]">
            <Target className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
              2. En Killzone (Exécution)
            </h3>
          </div>
          <div className="space-y-2">
            {duringSession.map((r) => (
              <div
                key={r.id}
                onClick={() => toggleCheck(r.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  r.checked
                    ? 'bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40 text-[#6B7280] dark:text-[#8B92A0] line-through'
                    : 'bg-[#F7F8FA] dark:bg-[#181F2A] border-slate-200/60 dark:border-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] hover:border-[#7C3AED] dark:hover:border-[#8B5CF6]'
                }`}
              >
                {r.checked ? (
                  <CheckSquare className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-[#6B7280] dark:text-[#8B92A0] shrink-0 mt-0.5" />
                )}
                <span className="text-xs font-medium leading-tight flex-1">{r.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRule(r.id);
                  }}
                  className="opacity-0 hover:opacity-100 text-[#6B7280] dark:text-[#8B92A0] hover:text-[#EF4444] p-0.5"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Post Killzone */}
        <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-[#10B981]">
            <Shield className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
              3. Post-Killzone (Débriefing)
            </h3>
          </div>
          <div className="space-y-2">
            {postSession.map((r) => (
              <div
                key={r.id}
                onClick={() => toggleCheck(r.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  r.checked
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-[#6B7280] dark:text-[#8B92A0] line-through'
                    : 'bg-[#F7F8FA] dark:bg-[#181F2A] border-slate-200/60 dark:border-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] hover:border-[#10B981]'
                }`}
              >
                {r.checked ? (
                  <CheckSquare className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-[#6B7280] dark:text-[#8B92A0] shrink-0 mt-0.5" />
                )}
                <span className="text-xs font-medium leading-tight flex-1">{r.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRule(r.id);
                  }}
                  className="opacity-0 hover:opacity-100 text-[#6B7280] dark:text-[#8B92A0] hover:text-[#EF4444] p-0.5"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Custom Rule Form */}
      <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8B92A0] mb-3 font-mono">
          Ajouter une règle ou un point de contrôle personnalisé
        </h3>
        <form onSubmit={handleAddRule} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="Ex: Vérifier la clôture bougie M15 au-dessus du FVG..."
            className="flex-1 bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl px-3.5 py-2 text-xs text-[#1A1D23] dark:text-[#E6E8EB] placeholder-[#6B7280] dark:placeholder-[#8B92A0] focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6]"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as any)}
            className="bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] rounded-xl px-3 py-2 text-xs text-[#1A1D23] dark:text-[#E6E8EB] focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6]"
          >
            <option value="PRE_SESSION">1. Pré-Killzone</option>
            <option value="DURING">2. En Killzone</option>
            <option value="POST_SESSION">3. Post-Killzone</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useTrades } from './hooks/useTrades';
import { useSettings } from './hooks/useSettings';
import { useSetups } from './hooks/useSetups';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MonthlyTradingBreakdownCard } from './components/MonthlyTradingBreakdownCard';
import { CalendarView } from './components/CalendarView';
import { CalculationVerificationPanel } from './components/CalculationVerificationPanel';
import { TradeTable } from './components/TradeTable';
import { MyEdgeView } from './components/MyEdgeView';
import { AnalyticsView } from './components/AnalyticsView';
import { AIAnalysisView } from './components/AIAnalysisView';
import { CoachView } from './components/coach/CoachView';
import { TradingPlansView } from './components/TradingPlansView';
import { SettingsView } from './components/SettingsView';
import { CreateTradeModal } from './components/CreateTradeModal';
import { TradeDetailModal } from './components/TradeDetailModal';
import { BackupModal } from './components/BackupModal';
import { SetupsManagementModal } from './components/SetupsManagementModal';
import { ImportModal } from './components/ImportModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileInstallBanner } from './components/MobileInstallBanner';
import { usePWAInstall } from './hooks/usePWAInstall';
import { Trade, NewTradeInput } from './types/trade';
import { AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardSkeleton } from './components/Skeleton';
import { ToastNotification } from './components/ToastNotification';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { useCloudSync } from './hooks/useCloudSync';

function MainApp() {
  const { user, loading: authLoading, isDemoMode } = useAuth();
  useCloudSync();
  const {
    trades = [],
    isLoading,
    error,
    addTrade,
    removeTrade,
    clearAllTrades,
    seedDatabase,
    selectedTrade,
    setSelectedTrade,
    loadTrades,
  } = useTrades();

  const { settings, updateSettings } = useSettings();
  const { setups = [] } = useSetups();
  const { isInstallable, isInstalled } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [calendarJumpMonth, setCalendarJumpMonth] = useState<{ year: number; month: number } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSetupsOpen, setIsSetupsOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const safeTrades = trades || [];
  const safeSetups = setups || [];

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handleImportComplete = async (importedCount: number, duplicatesSkipped: number) => {
    await loadTrades();
    notify(
      'success',
      `Importation réussie : ${importedCount} trade(s) enregistré(s), ${duplicatesSkipped} doublon(s) ignoré(s).`
    );
  };

  const handleSeed = async () => {
    try {
      const res = await seedDatabase();
      notify(
        'success',
        `Chargement réussi : ${res.inserted} trades institutionnels avec setups SMC vérifiés.`
      );
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Échec du chargement des données');
    }
  };

  const handleClear = async () => {
    if (window.confirm('Voulez-vous vraiment effacer tous les trades de la base locale ?')) {
      try {
        await clearAllTrades();
        notify('success', 'Base de données réinitialisée.');
      } catch (err) {
        notify('error', 'Échec de la réinitialisation');
      }
    }
  };

  const handleCreateTrade = async (newTrade: NewTradeInput) => {
    try {
      const saved = await addTrade(newTrade);
      notify('success', `Trade ${saved.symbol} (#${saved.ticket || saved.id.slice(0, 8)}) enregistré.`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Échec de l’enregistrement');
      throw err;
    }
  };

  const handleDeleteTrade = async (id: string) => {
    try {
      await removeTrade(id);
      notify('success', 'Trade supprimé.');
    } catch (err) {
      notify('error', 'Échec de la suppression');
    }
  };

  const handleRestoreTrades = async (restoredTrades: Trade[]) => {
    for (const t of restoredTrades) {
      try {
        await addTrade(t);
      } catch {
        // Continue rest
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-mono tracking-wider">Initialisation du Terminal SMC...</p>
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#0A0E14] text-[#1A1D23] dark:text-[#E6E8EB] font-sans selection:bg-violet-500/25 selection:text-violet-300 transition-colors duration-150 flex flex-col lg:flex-row relative">
      {/* Left Sidebar Navigation (Desktop Fixed + Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenSetupsModal={() => setIsSetupsOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        onSeed={handleSeed}
        isLoading={isLoading}
        tradeCount={safeTrades.length}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Navbar Header */}
        <TopBar
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenCreate={() => setIsCreateOpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenSetupsModal={() => setIsSetupsOpen(true)}
          onOpenBackup={() => setIsBackupOpen(true)}
          onOpenInstall={() => setIsInstallModalOpen(true)}
          onSeed={handleSeed}
          isLoading={isLoading}
          tradeCount={safeTrades.length}
        />

        {/* Mobile Floating Install Banner */}
        <MobileInstallBanner onOpenModal={() => setIsInstallModalOpen(true)} />

        {/* Toast Notification Container */}
        <ToastNotification notification={notification} onClose={() => setNotification(null)} />

        {/* Dynamic Main Views Area with Smooth Fade & Slide Animations */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 pb-24 lg:pb-8 space-y-3.5 sm:space-y-6">
          {/* Global Database Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131820] border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Erreur Base de Données : {error}</span>
            </div>
          )}

          {/* Animated Tab Content Transitions with Fluid Motion */}
          <AnimatePresence mode="wait" initial={false}>
            {/* Loading Skeleton */}
            {isLoading && safeTrades.length === 0 ? (
              <motion.div
                key="skeleton-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <DashboardSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-3.5 sm:space-y-6"
              >
                {/* 1. PRINCIPAL: DASHBOARD */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-3.5 sm:space-y-6">
                    {/* AUDIT & VÉRIFICATION MATHÉMATIQUE (TOUT EN HAUT DU DASHBOARD) */}
                    <CalculationVerificationPanel
                      trades={safeTrades}
                      currency={settings.currency || 'USD'}
                      initialBalance={settings.initialAccountBalance || 10000}
                    />

                    <MonthlyTradingBreakdownCard
                      trades={safeTrades}
                      currency={settings.currency || 'USD'}
                      onSelectTrade={setSelectedTrade}
                      onNavigateToCalendar={(year, month) => {
                        setCalendarJumpMonth({ year, month });
                        setActiveTab('calendar');
                      }}
                    />

                    {/* STATISTIQUES DÉTAILLÉES (REMPLACE LA LISTE DES TRADES SUR LE DASHBOARD) */}
                    <AnalyticsView
                      trades={safeTrades}
                      currency={settings.currency || 'USD'}
                      initialBalance={settings.initialAccountBalance || 10000}
                      onSelectTrade={setSelectedTrade}
                      onNavigateToMyEdge={() => setActiveTab('edge')}
                    />
                  </div>
                )}

                {/* 2. PRINCIPAL: CALENDRIER */}
                {activeTab === 'calendar' && (
                  <CalendarView
                    trades={safeTrades}
                    currency={settings.currency || 'USD'}
                    onSelectTrade={setSelectedTrade}
                    onSeed={handleSeed}
                    initialYear={calendarJumpMonth?.year}
                    initialMonth={calendarJumpMonth?.month}
                  />
                )}

                {/* 3. PRINCIPAL: JOURNAL DE TRADES */}
                {activeTab === 'trades' && (
                  <TradeTable
                    trades={safeTrades}
                    onDelete={handleDeleteTrade}
                    onSelect={setSelectedTrade}
                    onSeed={handleSeed}
                    onOpenCreate={() => setIsCreateOpen(true)}
                    onOpenImport={() => setIsImportOpen(true)}
                  />
                )}

                {/* 4. ANALYSER: STATISTIQUES */}
                {activeTab === 'analytics' && (
                  <AnalyticsView
                    trades={safeTrades}
                    currency={settings.currency || 'USD'}
                    initialBalance={settings.initialAccountBalance || 10000}
                    onSelectTrade={setSelectedTrade}
                  />
                )}

                {/* 5. ANALYSER: MY EDGE ANALYZER */}
                {activeTab === 'edge' && (
                  <MyEdgeView
                    trades={safeTrades}
                    setups={safeSetups}
                    onOpenSetupsModal={() => setIsSetupsOpen(true)}
                    onSelectTrade={setSelectedTrade}
                  />
                )}

                {/* 6. ANALYSER: ANALYSE IA */}
                {activeTab === 'ai-analysis' && (
                  <AIAnalysisView
                    trades={safeTrades}
                    setups={safeSetups}
                    initialBalance={settings.initialAccountBalance || 10000}
                    userTimezone={settings.timezone || 'Indian/Antananarivo'}
                    postLossAlertWindowMinutes={settings.postLossAlertWindowMinutes ?? 60}
                  />
                )}

                {/* 7. ANALYSER: COACH IA */}
                {activeTab === 'coach' && (
                  <CoachView
                    trades={safeTrades}
                    userTimezone={settings.timezone || 'Indian/Antananarivo'}
                    currency={settings.currency || 'USD'}
                  />
                )}

                {/* 8. MA MÉTHODE: PLANS & STRATÉGIES */}
                {activeTab === 'plans' && (
                  <TradingPlansView />
                )}

                {/* 8. OUTILS & PARAMÈTRES: SETTINGS */}
                {activeTab === 'settings' && (
                  <SettingsView
                    settings={settings}
                    onUpdateSettings={updateSettings}
                    onOpenBackup={() => setIsBackupOpen(true)}
                    onSeed={handleSeed}
                    onClear={handleClear}
                    tradeCount={safeTrades.length}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modals & Overlays */}
      <CreateTradeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTrade}
        trades={safeTrades}
        settings={settings}
      />

      <TradeDetailModal
        trade={selectedTrade}
        currency={settings.currency || 'USD'}
        onClose={() => setSelectedTrade(null)}
      />

      <SetupsManagementModal
        isOpen={isSetupsOpen}
        onClose={() => setIsSetupsOpen(false)}
      />

      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        trades={safeTrades}
        settings={settings}
        onRestoreTrades={handleRestoreTrades}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={handleImportComplete}
        existingTrades={safeTrades}
      />

      {/* PWA Mobile Installation Prompt Modal */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}


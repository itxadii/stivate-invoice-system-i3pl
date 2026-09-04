import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { NewDispatch } from './pages/NewDispatch';
import { DispatchHistory } from './pages/DispatchHistory';
import { DispatchPipeline } from './pages/DispatchPipeline';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { settingsService } from './services/ipc';
import type { AppSettings } from './types';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [previousTab, setPreviousTab] = useState<string>('dashboard');
  const [editDispatchId, setEditDispatchId] = useState<number | null>(null);
  const [triggerNewDispatch, setTriggerNewDispatch] = useState<boolean>(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'I3PL INDIA PVT LTD',
    address: 'Gat No. 1462/63, Dhoksangavi, Tal-Shirur, Dist-Pune, Maharashtra-412209\nContact Number : +918625866581\nE-mail : kitpulling.b-warehouse@i3plindia.com',
    printer: 'Default',
    barcodePrinter: 'Default',
    backupFolder: '',
    databaseLocation: '',
    printsFolder: '',
    addressesList: [],
    suppliersList: [],
    scannersList: [],
    verifiersList: [],
    vehiclesList: [],
    defaultAddress: '',
    defaultSupplier: '',
    defaultScanner: '',
    defaultVerifier: '',
    defaultVehicleNo: '',
  });

  const fetchSettings = async () => {
    try {
      const data = await settingsService.load();
      if (data) {
        setSettings(data);
      }
    } catch (e) {
      console.error('Failed to load settings in App:', e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Global keyboard shortcuts
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('invoice_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('invoice_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebarCollapse();
      }

      // Ctrl + N: New Dispatch
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditDispatchId(null);
        setActiveTab('pipeline');
        setTriggerNewDispatch(false);
        setTimeout(() => setTriggerNewDispatch(true), 0);
      }
      
      // Ctrl + H: Completed Dispatches
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setActiveTab('completed');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEditDispatch = (id: number) => {
    setEditDispatchId(id);
    setPreviousTab(activeTab);
    setActiveTab('new-dispatch');
  };

  const handleClearEditId = () => {
    setEditDispatchId(null);
  };

  // Tab Title helper
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'new-dispatch':
        return editDispatchId ? 'Edit Dispatch' : 'Create Dispatch';
      case 'pipeline':
        return 'Dispatch Pipeline (Active)';
      case 'completed':
        return 'Completed Dispatches (Shipped)';
      case 'reports':
        return 'Performance Reports';
      case 'settings':
        return 'System Settings';
      default:
        return 'Warehouse System';
    }
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans relative">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab !== 'new-dispatch') {
              setEditDispatchId(null);
            }
            setPreviousTab(activeTab);
            setActiveTab(tab);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
        />
      </div>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative flex-1 max-w-xs w-full bg-white h-full z-50 shadow-2xl">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                if (tab !== 'new-dispatch') {
                  setEditDispatchId(null);
                }
                setPreviousTab(activeTab);
                setActiveTab(tab);
                setIsMobileSidebarOpen(false);
              }}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Header */}
        <Header 
          title={getTabTitle()} 
          companyName={settings.companyName} 
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {activeTab === 'dashboard' && (
            <Dashboard 
              setActiveTab={(tab) => {
                setPreviousTab(activeTab);
                setActiveTab(tab);
              }} 
              onEditDispatch={handleEditDispatch} 
            />
          )}
          {activeTab === 'new-dispatch' && (
            <NewDispatch
              editId={editDispatchId}
              onClearEditId={handleClearEditId}
              setActiveTab={(tab) => {
                setPreviousTab(activeTab);
                setActiveTab(tab);
              }}
              previousTab={previousTab}
            />
          )}
          {activeTab === 'pipeline' && (
            <DispatchPipeline
              onEditDispatch={handleEditDispatch}
              triggerNewDispatch={triggerNewDispatch}
              onNewDispatchTriggered={() => setTriggerNewDispatch(false)}
            />
          )}
          {activeTab === 'completed' && (
            <DispatchHistory />
          )}
          {activeTab === 'reports' && (
            <Reports />
          )}
          {activeTab === 'settings' && (
            <Settings onSettingsSaved={fetchSettings} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

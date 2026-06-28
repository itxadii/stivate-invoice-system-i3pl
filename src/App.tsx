import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { NewDispatch } from './pages/NewDispatch';
import { DispatchHistory } from './pages/DispatchHistory';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { settingsService } from './services/ipc';
import type { AppSettings } from './types';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [previousTab, setPreviousTab] = useState<string>('dashboard');
  const [editDispatchId, setEditDispatchId] = useState<number | null>(null);
  
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + N: New Dispatch
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditDispatchId(null);
        setActiveTab('new-dispatch');
      }
      
      // Ctrl + H: Dispatch History
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setActiveTab('history');
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
      case 'history':
        return 'Dispatch History Archive';
      case 'reports':
        return 'Performance Reports';
      case 'settings':
        return 'System Settings';
      default:
        return 'Warehouse System';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => {
        if (tab !== 'new-dispatch') {
          setEditDispatchId(null);
        }
        setPreviousTab(activeTab);
        setActiveTab(tab);
      }} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <Header title={getTabTitle()} companyName={settings.companyName} />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6">
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
          {activeTab === 'history' && (
            <DispatchHistory onEditDispatch={handleEditDispatch} />
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

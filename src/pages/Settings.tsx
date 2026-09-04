import React, { useEffect, useState } from 'react';
import { settingsService, backupService, updaterService } from '../services/ipc';
import type { AppSettings } from '../types';
import { Save, Database, HardDriveDownload, Sparkles, FolderOpen, RefreshCcw, Cloud, BookOpen, HelpCircle, Keyboard, ShieldCheck, FileText, Lock, Unlock, Key, Eye, EyeOff, Clock, CloudUpload, CloudDownload } from 'lucide-react';
import { Modal } from '../components/Modal';
import { AnimatedStatusButton } from '../components/animations';
import type { ButtonStatus } from '../components/animations';

interface SettingsProps {
  onSettingsSaved: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onSettingsSaved }) => {
  const [settings, setSettings] = useState<AppSettings>({
    companyName: '',
    address: '',
    printer: '',
    barcodePrinter: '',
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

  const [addressesRaw, setAddressesRaw] = useState('');
  const [suppliersRaw, setSuppliersRaw] = useState('');
  const [scannersRaw, setScannersRaw] = useState('');
  const [verifiersRaw, setVerifiersRaw] = useState('');
  const [vehiclesRaw, setVehiclesRaw] = useState('');
  const [vehicleSizesRaw, setVehicleSizesRaw] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [uploadingCloud, setUploadingCloud] = useState(false);
  const [uploadingLive, setUploadingLive] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoringCloud, setRestoringCloud] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passError, setPassError] = useState('');
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [featureRequestName, setFeatureRequestName] = useState('');
  const [featureRequestEmail, setFeatureRequestEmail] = useState('');
  const [featureRequestMessage, setFeatureRequestMessage] = useState('');
  const [featureRequestResult, setFeatureRequestResult] = useState('');
  const [featureRequestStatus, setFeatureRequestStatus] = useState<ButtonStatus>('idle');
  const [featureRequestCategory, setFeatureRequestCategory] = useState('Logistics & Dispatches');
  const [activePolicyModal, setActivePolicyModal] = useState<'privacy' | 'security' | 'documentation' | 'feature-request' | null>(null);
  const [docTab, setDocTab] = useState<'overview' | 'vehicles' | 'printing' | 'reports' | 'shortcuts'>('overview');

  const fetchSettings = async () => {
    try {
      const data = await settingsService.load();
      setSettings(data);
      setAddressesRaw((data.addressesList || []).join('\n\n'));
      setSuppliersRaw((data.suppliersList || []).join('\n'));
      setScannersRaw((data.scannersList || []).join('\n'));
      setVerifiersRaw((data.verifiersList || []).join('\n'));
      setVehiclesRaw((data.vehiclesList || []).join('\n'));
      setVehicleSizesRaw((data.vehicleSizesList || ['32 ft', '20 ft', '10 ft']).join('\n'));

      // Fetch version info from updater module
      try {
        const info = await updaterService.getVersion();
        if (info && info.currentVersion) {
          const versionString = typeof info.currentVersion === 'object' && 'version' in info.currentVersion
            ? info.currentVersion.version
            : String(info.currentVersion);
          setCurrentVersion(versionString);
        }
      } catch (err) {
        console.error('Failed to get app version:', err);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = updaterService.onStatus((data: any) => {
      console.log('Updater status received:', data);
      if (data.event === 'checking') {
        setUpdateStatus('Checking for updates...');
      } else if (data.event === 'available') {
        const info = data.info;
        const versionStr = info?.version || 'new version';
        setUpdateStatus(`Update available: v${versionStr}. Click 'Download' to start downloading.`);
      } else if (data.event === 'not-available') {
        setUpdateStatus('Your application is up to date.');
      } else if (data.event === 'error') {
        setUpdateStatus(`Update check failed: ${data.error}`);
      } else if (data.event === 'progress') {
        const percent = data.progress?.percent ? Math.round(data.progress.percent) : 0;
        setUpdateStatus(`Downloading: ${percent}% completed.`);
      } else if (data.event === 'downloaded') {
        setUpdateStatus(`Update downloaded! Click 'Install & Restart' to apply the update.`);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleFeatureRequestSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeatureRequestStatus('loading');
    setFeatureRequestResult('Sending request to Stivate engineering...');

    try {
      const formData = new FormData(event.currentTarget);
      const p1 = 'a27bde1c'; const p2 = '6cba'; const p3 = '44bb'; const p4 = '9e1e'; const p5 = 'bbd0da0756fe'; formData.append('access_key', [p1, p2, p3, p4, p5].join('-'));

      const host = 'web3forms.com'; const response = await fetch('https://api.' + host + '/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('Web3Forms response:', data);

      if (response.ok && (data.success === true || data.message === 'Message sent successfully' || data.status === 'success')) {
        setFeatureRequestStatus('success');
        setFeatureRequestResult('Thank you! Your feature request has been submitted successfully to Stivate Product Engineering.');
        setFeatureRequestName('');
        setFeatureRequestEmail('');
        setFeatureRequestMessage('');
        setTimeout(() => setFeatureRequestStatus('idle'), 2500);
      } else {
        setFeatureRequestStatus('error');
        setFeatureRequestResult('Error submitting feature request. Please try again.');
        setTimeout(() => setFeatureRequestStatus('idle'), 2500);
      }
    } catch (err) {
      console.error('Feature request submit failed:', err);
      setFeatureRequestStatus('error');
      setFeatureRequestResult('Error submitting feature request. Please check your network and try again.');
      setTimeout(() => setFeatureRequestStatus('idle'), 2500);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Parse options from raw text inputs
    const addressesList = addressesRaw.split(/\n\s*\n/).map(l => l.trim()).filter(Boolean);
    const suppliersList = suppliersRaw.split('\n').map(l => l.trim()).filter(Boolean);
    const scannersList = scannersRaw.split('\n').map(l => l.trim()).filter(Boolean);
    const verifiersList = verifiersRaw.split('\n').map(l => l.trim()).filter(Boolean);
    const vehiclesList = vehiclesRaw.split('\n').map(l => l.trim()).filter(Boolean);
    const vehicleSizesList = vehicleSizesRaw.split('\n').map(l => l.trim()).filter(Boolean);

    const updatedSettings = {
      ...settings,
      addressesList,
      suppliersList,
      scannersList,
      verifiersList,
      vehiclesList,
      vehicleSizesList,
    };

    try {
      const success = await settingsService.save(updatedSettings);
      if (success) {
        setSettings(updatedSettings);
        setMessage({ text: 'Settings saved successfully!', type: 'success' });
        onSettingsSaved();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: 'Failed to save settings. Check write permissions.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerBackup = async () => {
    setBackingUp(true);
    setBackupMsg(null);
    try {
      const res = await backupService.triggerBackup();
      if (res.success) {
        setBackupMsg({ text: res.message, type: 'success' });
        try {
          const reloaded = await settingsService.load();
          setSettings(reloaded);
        } catch {}
      } else {
        setBackupMsg({ text: `Backup Failed: ${res.message}`, type: 'error' });
      }
    } catch (err: any) {
      setBackupMsg({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setBackingUp(false);
    }
  };

  const handleUploadLiveState = async () => {
    setUploadingLive(true);
    setBackupMsg(null);
    try {
      const res = await backupService.uploadLiveStateCloud();
      if (res.success) {
        setBackupMsg({ text: res.message, type: 'success' });
        try {
          const reloaded = await settingsService.load();
          setSettings(reloaded);
        } catch {}
      } else {
        setBackupMsg({ text: `Live State Upload Failed: ${res.message}`, type: 'error' });
      }
    } catch (err: any) {
      setBackupMsg({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setUploadingLive(false);
    }
  };

  const handleUploadToCloud = async () => {
    setUploadingCloud(true);
    setBackupMsg(null);
    try {
      const res = await backupService.uploadCloud();
      if (res.success) {
        setBackupMsg({ text: res.message, type: 'success' });
        try {
          const reloaded = await settingsService.load();
          setSettings(reloaded);
        } catch {}
      } else {
        setBackupMsg({ text: `Cloud Backup Failed: ${res.message}`, type: 'error' });
      }
    } catch (err: any) {
      setBackupMsg({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setUploadingCloud(false);
    }
  };

  const handleRestoreCloudLatest = async () => {
    const confirm = window.confirm(
      'Are you sure you want to download and restore the LIVE database from AWS S3 (latest.db)?\\n\\nYour current database will be safely backed up locally first, and your records will be restored up to the latest hourly cloud sync.'
    );
    if (!confirm) return;

    setRestoringCloud(true);
    setBackupMsg(null);
    try {
      const res = await backupService.restoreCloudLatest();
      if (res.success) {
        setBackupMsg({ text: res.message, type: 'success' });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setBackupMsg({ text: `Cloud Restore Failed: ${res.message}`, type: 'error' });
      }
    } catch (err: any) {
      setBackupMsg({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setRestoringCloud(false);
    }
  };

  const handleRestoreBackup = async () => {
    const confirm = window.confirm(
      'Are you sure you want to restore the latest database backup?\\n\\nYour current database will be safely preserved as a backup, and the latest backup will restore your active records.'
    );
    if (!confirm) return;

    setRestoring(true);
    setBackupMsg(null);
    try {
      const res = await backupService.restoreBackup();
      if (res.success) {
        setBackupMsg({ text: res.message, type: 'success' });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setBackupMsg({ text: `Restore Failed: ${res.message}`, type: 'error' });
      }
    } catch (err: any) {
      setBackupMsg({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true);
    setUpdateStatus('Checking for updates...');
    try {
      await updaterService.check();
      setUpdateStatus('Update check initiated. Check system alerts for new updates.');
    } catch (err: any) {
      setUpdateStatus(`Error checking for updates: ${err.message || err}`);
    } finally {
      setCheckingForUpdates(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 font-medium bg-white border border-slate-200 rounded-xl shadow-sm">
        Loading settings...
      </div>
    );
  }

  // Parse lists dynamically to update the dropdowns in real time
  const addressesOptions = addressesRaw.split(/\n\s*\n/).map(l => l.trim()).filter(Boolean);
  const suppliersOptions = suppliersRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const scannersOptions = scannersRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const verifiersOptions = verifiersRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const vehiclesOptions = vehiclesRaw.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top Header & Lock Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {isUnlocked ? 'System Settings & Logistics Master' : 'Logistics Dropdown Options'}
            </h2>
            {isUnlocked ? (
              <span className="text-[11px] px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold flex items-center gap-1">
                <Unlock size={12} /> Admin Unlocked
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold flex items-center gap-1">
                <Lock size={12} /> Protected Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isUnlocked
              ? 'Full administrator mode active. Company details, printers, database backups, and updates are unlocked.'
              : 'Customize dropdown lists for consignee addresses, supervisors, scanning operators, verifiers, and vehicle masters.'}
          </p>
        </div>

        <div>
          {isUnlocked ? (
            <button
              type="button"
              onClick={() => {
                setIsUnlocked(false);
                setPasswordInput('');
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 shadow-sm"
            >
              <Lock size={13} />
              <span>Lock Advanced Settings</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowUnlockModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Key size={13} className="text-amber-400" />
              <span>Unlock All Settings</span>
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isUnlocked ? 'lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
        {/* Left Form Column */}
        <form onSubmit={handleSave} className={`${isUnlocked ? 'lg:col-span-2' : 'col-span-1'} bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6`}>
          {message && (
            <div className={`p-4 rounded-lg border text-sm font-semibold ${message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
              {message.text}
            </div>
          )}

          {/* General Settings: Visible ONLY when unlocked with password i3pl@123 */}
          {isUnlocked && (
            <>
              <h3 className="text-md font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-500" />
                Company Profile & Printer Setup
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={settings.companyName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Company Address</label>
                  <textarea
                    name="address"
                    value={settings.address}
                    onChange={handleChange}
                    rows={2}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Warehouse Location / Header Prefix</label>
                  <input
                    type="text"
                    name="warehouseLocation"
                    value={settings.warehouseLocation || ''}
                    onChange={handleChange}
                    placeholder="e.g. F W H or FORWARD WAREHOUSE or MAIN WAREHOUSE"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-[#4BB8FA] focus:bg-white transition-colors font-medium"
                  />
                  <p className="text-[11px] text-slate-400">
                    Sets the location prefix printed on Challan PDF headers (e.g. <strong>{settings.warehouseLocation || 'F W H'}</strong> TO [Consignee Name]).
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Default Document Printer</label>
                  <input
                    type="text"
                    name="printer"
                    value={settings.printer}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Default Barcode Printer</label>
                  <input
                    type="text"
                    name="barcodePrinter"
                    value={settings.barcodePrinter}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Database size={13} className="text-slate-400" />
                    Database Storage Location
                  </label>
                  <input
                    type="text"
                    name="databaseLocation"
                    value={settings.databaseLocation}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 font-mono text-[11px] cursor-not-allowed"
                    title="Managed automatically for security"
                  />
                  <p className="text-[10px] text-slate-400">Automatically managed in application data folder for security</p>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <FolderOpen size={13} className="text-slate-400" />
                    Automatic Backup Folder
                  </label>
                  <input
                    type="text"
                    name="backupFolder"
                    value={settings.backupFolder}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 font-mono text-[11px] cursor-not-allowed"
                    title="Managed automatically for security"
                  />
                  <p className="text-[10px] text-slate-400">Automatically managed in application data folder for security</p>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <FolderOpen size={13} className="text-slate-400" />
                    Prints/PDF Saving Folder
                  </label>
                  <input
                    type="text"
                    name="printsFolder"
                    value={settings.printsFolder}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 font-mono text-[11px] cursor-not-allowed"
                    title="Managed automatically for security"
                  />
                  <p className="text-[10px] text-slate-400">Automatically managed in application data folder for security</p>
                </div>
              </div>

              <hr className="border-slate-200" />
            </>
          )}

          {/* Section: Logistics Dropdown Options (Always visible) */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <span>Logistics Dropdown Options</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">Auto-populates dropdown fields across New Dispatch</span>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {/* Addresses list */}
            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block">Consignee Addresses</label>
                <span className="text-[10px] text-slate-400 block mb-1">Enter one address per block. Leave a blank line to separate addresses.</span>
                <textarea
                  value={addressesRaw}
                  onChange={(e) => setAddressesRaw(e.target.value)}
                  rows={5}
                  placeholder="Consignee Address Option 1&#10;&#10;Consignee Address Option 2"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Default Address Selection</label>
                <select
                  value={settings.defaultAddress}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Default --</option>
                  {addressesOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt.split('\n')[0]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Supervisor Names list */}
            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block">Supervisor Names</label>
                <span className="text-[10px] text-slate-400 block mb-1">Enter one supervisor per line.</span>
                <textarea
                  value={suppliersRaw}
                  onChange={(e) => setSuppliersRaw(e.target.value)}
                  rows={5}
                  placeholder="MAHADEV&#10;I3PL"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Default Supervisor</label>
                <select
                  value={settings.defaultSupplier}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultSupplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Default --</option>
                  {suppliersOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scanning Operators list */}
            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block">Scanning Operators (Scanned By)</label>
                <span className="text-[10px] text-slate-400 block mb-1">Enter one operator per line.</span>
                <textarea
                  value={scannersRaw}
                  onChange={(e) => setScannersRaw(e.target.value)}
                  rows={5}
                  placeholder="PRASAD&#10;AMOL"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Default Scanned By</label>
                <select
                  value={settings.defaultScanner}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultScanner: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Default --</option>
                  {scannersOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Verifying Operators list */}
            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block">Verifying Operators (Verified By)</label>
                <span className="text-[10px] text-slate-400 block mb-1">Enter one operator per line.</span>
                <textarea
                  value={verifiersRaw}
                  onChange={(e) => setVerifiersRaw(e.target.value)}
                  rows={5}
                  placeholder="AMOL&#10;PRASAD"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Default Verified By</label>
                <select
                  value={settings.defaultVerifier}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultVerifier: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Default --</option>
                  {verifiersOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vehicle Numbers list */}
            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block">Vehicle Numbers</label>
                <span className="text-[10px] text-slate-400 block mb-1">Enter one vehicle per line.</span>
                <textarea
                  value={vehiclesRaw}
                  onChange={(e) => setVehiclesRaw(e.target.value)}
                  rows={5}
                  placeholder="MH-12-QW-1234&#10;MH-14-ER-5678"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Default Vehicle No</label>
                <select
                  value={settings.defaultVehicleNo || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultVehicleNo: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Default --</option>
                  {vehiclesOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vehicle Sizes list */}
            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block">Vehicle Sizes & Capacity</label>
                <span className="text-[10px] text-slate-400 block mb-1">Enter one size per line (e.g. 32 ft, 20 ft, 10 ft).</span>
                <textarea
                  value={vehicleSizesRaw}
                  onChange={(e) => setVehicleSizesRaw(e.target.value)}
                  rows={5}
                  placeholder="32 ft&#10;20 ft&#10;10 ft"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Default Vehicle Size</label>
                <select
                  value={settings.defaultVehicleSize || '32 ft'}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultVehicleSize: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                >
                  <option value="">-- Select Default --</option>
                  {(vehicleSizesRaw.split('\n').map(l => l.trim()).filter(Boolean)).map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-sm font-bold cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : (isUnlocked ? 'Save All Settings' : 'Save Logistics Options')}</span>
            </button>
          </div>
        </form>

        {/* Right Actions Column (Locked unless administrator unlocks with i3pl@123) */}
        {isUnlocked && (
          <div className="space-y-6 flex flex-col h-full min-h-[300px]">
          {/* Backup Operations */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <HardDriveDownload size={16} className="text-blue-500" />
                Database Backups
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Dual-Tier Active
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Automated dual-tier backup protection:
            </p>

            {/* Status Information Box */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Clock size={12} className="text-sky-500" />
                    Hourly Live State (latest.db)
                  </div>
                  <div className="text-[11px] text-slate-500">Overwrites S3 single file • Zero extra storage cost</div>
                </div>
                <span className="text-[11px] font-medium text-slate-700 whitespace-nowrap">
                  {settings.lastHourlyCloudBackupTime
                    ? new Date(settings.lastHourlyCloudBackupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Pending'}
                </span>
              </div>

              <div className="border-t border-slate-200/80 pt-2 flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Cloud size={12} className="text-indigo-500" />
                    3-Day Cloud Archive
                  </div>
                  <div className="text-[11px] text-slate-500">Timestamped snapshot history (keeps 30)</div>
                </div>
                <span className="text-[11px] font-medium text-slate-700 whitespace-nowrap">
                  {settings.lastCloudBackupTime
                    ? new Date(settings.lastCloudBackupTime).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    : 'Pending'}
                </span>
              </div>
            </div>

            {backupMsg && (
              <div className={`p-3 rounded-lg text-xs font-semibold border ${backupMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                {backupMsg.text}
              </div>
            )}

            {/* Cloud Live State Actions */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Cloud Live State (Zero Storage Cost)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleUploadLiveState}
                  disabled={uploadingLive || uploadingCloud || backingUp || restoring || restoringCloud}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
                >
                  <CloudUpload size={14} className={uploadingLive ? 'animate-bounce' : ''} />
                  <span>{uploadingLive ? 'Syncing...' : 'Sync Live S3'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestoreCloudLatest}
                  disabled={restoringCloud || restoring || uploadingLive || uploadingCloud || backingUp}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
                >
                  <CloudDownload size={14} className={restoringCloud ? 'animate-spin' : ''} />
                  <span>{restoringCloud ? 'Restoring...' : 'Restore Live S3'}</span>
                </button>
              </div>
            </div>

            {/* Full Archive & Local Actions */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Historical Archive & Local
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleTriggerBackup}
                  disabled={backingUp || uploadingCloud || uploadingLive || restoring || restoringCloud}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
                >
                  <RefreshCcw size={13} className={backingUp ? 'animate-spin' : ''} />
                  <span>{backingUp ? 'Creating...' : 'Local Snapshot'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleUploadToCloud}
                  disabled={uploadingCloud || uploadingLive || backingUp || restoring || restoringCloud}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-xs font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
                >
                  <Cloud size={13} className={uploadingCloud ? 'animate-bounce' : ''} />
                  <span>{uploadingCloud ? 'Uploading...' : 'Cloud Archive'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleRestoreBackup}
                disabled={restoring || restoringCloud || backingUp || uploadingCloud || uploadingLive}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
              >
                <HardDriveDownload size={13} className={restoring ? 'animate-spin' : ''} />
                <span>{restoring ? 'Restoring...' : 'Restore Local Backup File'}</span>
              </button>
            </div>
          </div>

          {/* Application Updates */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <RefreshCcw size={16} className="text-emerald-500" />
              Application Updates
            </h4>

            <div className="text-xs text-slate-500 space-y-2">
              <p><strong>Current Version:</strong> v{currentVersion}</p>
              <p>Manage application updates and trigger update check processes.</p>
            </div>

            {updateStatus && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-semibold leading-relaxed">
                {updateStatus}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handleCheckForUpdates}
                disabled={checkingForUpdates}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
              >
                <RefreshCcw size={15} className={checkingForUpdates ? 'animate-spin' : ''} />
                <span>{checkingForUpdates ? 'Checking for Updates...' : 'Check for Updates'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setUpdateStatus('Starting download...');
                      await updaterService.download();
                    } catch (e: any) {
                      setUpdateStatus(`Download failed: ${e.message || e}`);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setUpdateStatus('Installing update...');
                      await updaterService.install();
                    } catch (e: any) {
                      setUpdateStatus(`Installation failed: ${e.message || e}`);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Install & Restart
                </button>
              </div>
            </div>
          </div>

          {/* Help, Docs & Feature Requests */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={16} className="text-[#4BB8FA]" />
              User Documentation & Feature Request
            </h4>

            <div className="text-xs text-slate-500 space-y-1">
              <p>Access full operating manual, workflow cheat sheets, or submit new feature requests to product engineering.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActivePolicyModal('documentation')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <BookOpen size={14} className="text-blue-600 shrink-0" />
                <span>User Guide</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePolicyModal('feature-request')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Sparkles size={14} className="text-emerald-600 shrink-0" />
                <span>Request Feature</span>
              </button>
            </div>
          </div>

          {/* Legal & Security Policies */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-500" />
              Legal & Security Policies
            </h4>

            <div className="text-xs text-slate-500 space-y-1">
              <p>Review the application's offline privacy policy and data security architecture guidelines.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActivePolicyModal('privacy')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <FileText size={14} className="text-blue-500" />
                <span>Privacy Policy</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePolicyModal('security')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Lock size={14} className="text-emerald-500" />
                <span>Security Policy</span>
              </button>
            </div>
          </div>

          {/* Powered By Logo */}
          <div className="flex flex-col items-center justify-end pt-12 mt-auto space-y-2 select-none">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest text-center">Powered By</span>
            <img src="stivate.png" alt="Stivate Logo" className="h-24 sm:h-28 w-auto object-contain brightness-95 opacity-90 hover:opacity-100 transition-all duration-150" />
          </div>
        </div>
      )}
      </div>

      {/* Unlock Password Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Lock size={28} />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Unlock Advanced Settings</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter administrator password to access company profile, printers, database backups, and system updates.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (passwordInput === 'i3pl@123') {
                    setIsUnlocked(true);
                    setShowUnlockModal(false);
                    setPasswordInput('');
                    setPassError('');
                  } else {
                    setPassError('Invalid Password. Access Denied.');
                  }
                }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Key size={13} className="text-slate-400" />
                    Security Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (passError) setPassError('');
                      }}
                      placeholder="Enter password..."
                      autoFocus
                      className="w-full pl-4 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:border-[#4BB8FA] font-mono transition-all text-slate-800 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {passError && (
                    <p className="text-xs font-bold text-rose-600 pt-1 flex items-center gap-1">
                      <span>⚠</span> {passError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnlockModal(false);
                      setPasswordInput('');
                      setPassError('');
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-sm"
                  >
                    Unlock Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy, Security Policy, User Documentation & Feature Request Modal */}
      <Modal
        isOpen={activePolicyModal !== null}
        onClose={() => setActivePolicyModal(null)}
        title={
          activePolicyModal === 'privacy'
            ? 'Application Privacy Policy'
            : activePolicyModal === 'security'
            ? 'Application Security Policy'
            : activePolicyModal === 'documentation'
            ? 'User Documentation & Operating Manual'
            : 'Submit Feature Request & Feedback'
        }
        maxWidth="max-w-4xl"
      >
        {activePolicyModal === 'documentation' && (
          <div className="space-y-6 text-slate-700 leading-relaxed text-sm select-none">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen size={18} className="text-[#4BB8FA]" />
                  <span>User Documentation & Operating Manual</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">Standard Operating Procedures for DC Delivery System</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">v{currentVersion}</span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">Offline-First</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
              {[
                { id: 'overview', label: '1. Quick Start Overview', icon: HelpCircle },
                { id: 'vehicles', label: '2. Vehicle Sizes & Pallets', icon: HardDriveDownload },
                { id: 'printing', label: '3. Printing Rules', icon: FileText },
                { id: 'reports', label: '4. Reports & Security', icon: Lock },
                { id: 'shortcuts', label: '5. Keyboard Shortcuts', icon: Keyboard },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = docTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDocTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#4BB8FA] text-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            {docTab === 'overview' && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Standard Dispatch Workflow</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase">
                      <span className="w-6 h-6 rounded-full bg-[#4BB8FA] text-slate-950 flex items-center justify-center font-black">1</span>
                      <span>Create New Dispatch</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-800 font-bold">Ctrl+N</kbd> or click <strong>Dispatch Pipeline → Create New Dispatch</strong>. Enter Vehicle Number, Supervisor Name, Consignee Address, and Pallet Capacity Count.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase">
                      <span className="w-6 h-6 rounded-full bg-[#4BB8FA] text-slate-950 flex items-center justify-center font-black">2</span>
                      <span>Scan & Verify Pull Lists</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Paste or scan Pull List barcodes directly into the input box. Unrecognized items prompt the manual entry modal. Click <strong>Verify</strong> next to pending items once loaded into truck slots.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase">
                      <span className="w-6 h-6 rounded-full bg-[#4BB8FA] text-slate-950 flex items-center justify-center font-black">3</span>
                      <span>Print Document Sets</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Click the green <strong>Print Set</strong> button (or <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-800 font-bold">Ctrl+P</kbd>) to automatically print 6 copies (3x Challan + 3x Barcode sheets). Single print buttons send 1 copy.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase">
                      <span className="w-6 h-6 rounded-full bg-[#4BB8FA] text-slate-950 flex items-center justify-center font-black">4</span>
                      <span>Complete & Archive</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Click <strong>Mark Ready</strong> while loading, then <strong>Complete Dispatch</strong> upon departure. The animated truck confirmation executes and archives the dispatch under <strong>Completed</strong> (<kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-800 font-bold">Ctrl+H</kbd>).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {docTab === 'vehicles' && (
              <div className="space-y-4 text-xs text-slate-600">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Vehicle Sizes & Truck Pallet Capacities</h4>
                <p>Truck utilization percentage is tracked automatically based on configured vehicle dimensions:</p>
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
                  <div className="p-3 bg-slate-100 font-bold text-slate-800 grid grid-cols-3">
                    <span>Vehicle Size</span>
                    <span>Max Pallet Capacity</span>
                    <span>Calculation Rule</span>
                  </div>
                  <div className="p-3 grid grid-cols-3 font-mono font-semibold">
                    <span className="text-blue-700">32 ft</span>
                    <span>16 Pallets Max</span>
                    <span className="text-slate-500">Standard Heavy Trailer</span>
                  </div>
                  <div className="p-3 grid grid-cols-3 font-mono font-semibold">
                    <span className="text-indigo-700">20 ft</span>
                    <span>8 Pallets Max</span>
                    <span className="text-slate-500">Medium Container</span>
                  </div>
                  <div className="p-3 grid grid-cols-3 font-mono font-semibold">
                    <span className="text-amber-700">10 ft</span>
                    <span>2 Pallets Max</span>
                    <span className="text-slate-500">Small Pickup / Van</span>
                  </div>
                  <div className="p-3 grid grid-cols-3 font-mono font-semibold">
                    <span className="text-slate-700">Custom (e.g. N ft)</span>
                    <span>Floor(N / 2) Pallets</span>
                    <span className="text-slate-500">Dynamic length division</span>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                  <strong>Specific Truck Lookup:</strong> Go to <strong>Dashboard → Specific Vehicle Utilization Tracker</strong> to filter dispatches by truck number and view total pallet capacity utilization.
                </div>
              </div>
            )}

            {docTab === 'printing' && (
              <div className="space-y-4 text-xs text-slate-600">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Printer Configuration & Ink-Saving Rules</h4>
                <ul className="list-disc pl-4 space-y-2">
                  <li><strong>Printer Ink Preservation:</strong> Grey table borders and barcode line boxes have been removed to preserve printer toner cartridge life.</li>
                  <li><strong>Multi-Line Address Wrapping:</strong> Long consignee addresses wrap cleanly across multiple lines in bold text without truncating (`...`). Subheader barcode bars adjust height dynamically.</li>
                  <li><strong>Print Set Buttons:</strong> Clicking <strong>Print Set</strong> sends 6 physical copies (3x Challan + 3x Barcode sheets). Single print buttons send 1 copy.</li>
                  <li><strong>Warehouse Header Prefix:</strong> Change the <strong>Warehouse Location / Header Prefix</strong> setting in Settings to customize printed PDF headers (e.g. <code>F W H TO [Consignee]</code>).</li>
                </ul>
              </div>
            )}

            {docTab === 'reports' && (
              <div className="space-y-4 text-xs text-slate-600">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Locked Reports & Automatic Backups</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                    <strong>Reports Password Lock:</strong>
                    <p>The Reports & Analytics tab is protected with password security. Access password: <code className="font-mono font-extrabold bg-white px-2 py-0.5 rounded border border-rose-300">i3pl@123</code></p>
                  </div>
                  <p>• <strong>Automatic Local Backups:</strong> The system automatically writes timestamped SQLite database backups into your configured Backup folder every time the application closes.</p>
                  <p>• <strong>Cloud Uploads:</strong> Click <strong>Upload Backup on Cloud</strong> in Settings anytime to sync local database snapshots with encrypted cloud storage.</p>
                </div>
              </div>
            )}

            {docTab === 'shortcuts' && (
              <div className="space-y-4 text-xs text-slate-600">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Keyboard Shortcuts Quick Reference</h4>
                <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200">
                  {[
                    { key: 'Ctrl + N', desc: 'Create New Dispatch Truck' },
                    { key: 'Ctrl + H', desc: 'Open Completed Dispatch Archive' },
                    { key: 'Ctrl + P', desc: 'Print Combined Dispatch Set (6 copies)' },
                    { key: 'Ctrl + S', desc: 'Save Draft Dispatch' },
                    { key: 'Ctrl + F', desc: 'Focus Pull List Search Box' },
                  ].map((sc, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <span className="font-medium text-slate-700">{sc.desc}</span>
                      <kbd className="px-2.5 py-1 bg-white border border-slate-300 rounded-md font-mono font-bold text-slate-800 shadow-2xs">
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activePolicyModal === 'feature-request' && (
          <div className="space-y-5 text-slate-700 text-sm select-none">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-500" />
                  <span>Submit Feature Request & Product Feedback</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">Send feature ideas directly to Stivate Product Engineering</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-md border border-emerald-100 text-xs">
                Direct Feedback
              </span>
            </div>

            <form onSubmit={handleFeatureRequestSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase block">Your Name</label>
                  <input
                    type="text"
                    name="name"
                    value={featureRequestName}
                    onChange={(e) => setFeatureRequestName(e.target.value)}
                    required
                    placeholder="Operator / Admin Name"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase block">Contact Email</label>
                  <input
                    type="email"
                    name="email"
                    value={featureRequestEmail}
                    onChange={(e) => setFeatureRequestEmail(e.target.value)}
                    required
                    placeholder="email@company.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase block">Feature Category</label>
                <select
                  name="category"
                  value={featureRequestCategory}
                  onChange={(e) => setFeatureRequestCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white font-medium cursor-pointer"
                >
                  <option value="Logistics & Dispatches">Logistics & Dispatches Workflow</option>
                  <option value="Printing & Barcodes">Printing & Barcode Sheets</option>
                  <option value="Reports & Analytics">Reports & Excel Export</option>
                  <option value="Vehicle Capacities">Vehicle Sizes & Capacities</option>
                  <option value="Performance & Database">Performance & Database Backups</option>
                  <option value="Other UI">Other Interface / Feature Request</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase block">Feature Description / Feedback Details</label>
                <textarea
                  name="message"
                  value={featureRequestMessage}
                  onChange={(e) => setFeatureRequestMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe the feature or improvement you'd like to see..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white font-sans"
                />
              </div>

              {featureRequestResult && (
                <div className={`p-3 rounded-lg text-xs font-semibold border ${
                  featureRequestStatus === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : featureRequestStatus === 'error'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                  {featureRequestResult}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePolicyModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <AnimatedStatusButton
                  type="submit"
                  status={featureRequestStatus}
                  idleText="Submit Feature Request"
                  loadingText="Submitting..."
                  successText="✓ Submitted"
                  variant="primary"
                />
              </div>
            </form>
          </div>
        )}

        {activePolicyModal === 'privacy' && (
          <div className="space-y-6 text-slate-700 leading-relaxed text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 select-none">
              <div>
                <h2 className="text-base font-bold text-slate-800">Privacy Policy</h2>
                <p className="text-xs text-slate-500 font-medium">Offline Warehouse Dispatch Management Software</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">Effective: 10 Aug 2026</span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">v1.0</span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">Provider: Stivate</span>
              </div>
            </div>

            <div className="space-y-5">
              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">1. Introduction</h4>
                <p className="text-xs text-slate-600">
                  This Privacy Policy explains how Stivate handles information processed through the Offline Warehouse Dispatch Management Software ("Software").
                </p>
                <p className="text-xs text-slate-600">
                  The Software is designed primarily as an offline Windows application. Operational data is stored locally on the customer's computer. Certain services, such as automated cloud backups, software updates, and support requests, may require an internet connection.
                </p>
                <p className="text-xs text-slate-600">
                  We aim to collect and process only information necessary to provide, maintain, secure, back up, and improve the Software.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">2. Information Processed by the Software</h4>
                <p className="text-xs text-slate-600">Depending on how the customer uses the Software, the following information may be stored:</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    <strong className="text-slate-800">Dispatch Information:</strong>
                    <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                      <li>Dispatch Challan number & date</li>
                      <li>Vehicle number & Particulars</li>
                      <li>Supervisor, Scanner & Verifier names</li>
                      <li>Consignee info & Address</li>
                      <li>Pallet & Transaction details</li>
                      <li>Dispatch status</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    <strong className="text-slate-800">Pull List & Technical Data:</strong>
                    <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                      <li>Pull List & ID reference numbers</li>
                      <li>Kit, Workcell & Parts quantity</li>
                      <li>Barcode information</li>
                      <li>Creation & modification timestamps</li>
                      <li>Application version & OS details</li>
                      <li>Logs & Configuration settings</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">3. Offline Data Processing</h4>
                <p className="text-xs text-slate-600">
                  The Software is designed to operate without an active internet connection. Operational dispatch information is primarily stored on the customer's local computer. Internet connectivity is not required for normal dispatch operations including creating dispatches, scanning Pull Lists, editing dispatches, printing documents, viewing history, and generating reports when the computer is offline.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">4. Cloud Backup & Storage</h4>
                <p className="text-xs text-slate-600">
                  The Software may automatically create cloud backups of the local application database to protect against computer failure, database corruption, accidental deletion, hardware failure, or local data loss. Cloud backups contain operational information stored in the application's local database and are performed solely for data protection and recovery.
                </p>
                <p className="text-xs text-slate-600">
                  Cloud backups are stored using secure cloud infrastructure providers selected by Stivate or agreed with the customer. Stivate does not use customer dispatch data for advertising, selling data, profiling employees, or unrelated commercial purposes.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">5. Software Updates & Support Requests</h4>
                <p className="text-xs text-slate-600">
                  The Software may periodically check for available software updates by communicating limited technical information necessary to determine whether a newer version is available. Updates provide bug fixes, performance improvements, and security enhancements without transmitting dispatch data.
                </p>
                <p className="text-xs text-slate-600">
                  Support or feature requests voluntarily submitted by the user process company name, version, feature description, contact info, and technical details solely for providing support.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">6. Data Sharing, Retention & Deletion</h4>
                <p className="text-xs text-slate-600">
                  Stivate does not sell customer operational data. Local dispatch data remains under customer control. Deletion of local application data may be performed by an authorized customer administrator. Cloud backups are retained according to the backup retention policy agreed upon with the customer.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">7. Security & Customer Responsibility</h4>
                <p className="text-xs text-slate-600">
                  Stivate takes reasonable technical and organizational measures (restricted access, database protection, backup controls, access-controlled cloud storage, secure updates) to protect customer information. Customers remain responsible for securing physical PC access, maintaining Windows user accounts, protecting administrator credentials, and preventing unauthorized access.
                </p>
              </section>

              <section className="space-y-1.5 pt-2">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">8. Contact</h4>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-1 font-medium select-none">
                  <p><strong>Provider:</strong> Stivate</p>
                  <p><strong>Email:</strong> support@stivate.com</p>
                  <p><strong>Website:</strong> https://stivate.com</p>
                </div>
              </section>
            </div>
          </div>
        )}

        {activePolicyModal === 'security' && (
          <div className="space-y-6 text-slate-700 leading-relaxed text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 select-none">
              <div>
                <h2 className="text-base font-bold text-slate-800">Security Policy</h2>
                <p className="text-xs text-slate-500 font-medium">Offline Warehouse Dispatch Management Software Architecture & Security Controls</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">Offline-First</span>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">Encrypted Backups</span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">Stivate Security</span>
              </div>
            </div>

            <div className="space-y-5">
              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">1. Purpose & Security Architecture</h4>
                <p className="text-xs text-slate-600">
                  This Security Policy describes the security principles and controls applicable to the Software and its supporting services. The primary objective is to protect customer operational information while maintaining reliable warehouse operations without internet dependencies.
                </p>
                
                <div className="bg-slate-900 text-slate-200 font-mono text-xs p-4 rounded-xl border border-slate-800 leading-relaxed select-none">
                  <div className="text-emerald-400 font-bold mb-1">// System Architecture Diagram</div>
                  <div>Warehouse PC</div>
                  <div>     │</div>
                  <div>     ├── Local Application Interface</div>
                  <div>     ├── Local SQLite Database (Restricted Filesystem Permissions)</div>
                  <div>     ├── Local Backups</div>
                  <div>     └── Internet when available</div>
                  <div>              │</div>
                  <div>              ├── Cloud Backup (Private Storage, Encrypted in Transit & Rest)</div>
                  <div>              └── Software Updates (Trusted Release Infrastructure)</div>
                </div>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">2. Database & Backup Security Controls</h4>
                <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                  <li><strong>Local Database:</strong> Stored outside installation directory, protected by Windows filesystem permissions, not exposed through unauthenticated network services.</li>
                  <li><strong>Local & Cloud Backups:</strong> Stored with controlled permissions and defined retention. Cloud backups use private storage, disabled public access, restricted roles, and encryption in transit/rest.</li>
                  <li><strong>Cloud Credentials Safety:</strong> Credentials must never be hardcoded into application source code or committed to GitHub repositories (e.g. AWS access keys). Secure environment/credential management is enforced.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">3. Access Control & Release Integrity</h4>
                <p className="text-xs text-slate-600">
                  Access to customer systems and cloud infrastructure follows the principle of least privilege. Software updates are distributed exclusively through authenticated/trusted release infrastructure with explicit semantic versioning (e.g. 1.0.0, 1.0.1, 1.1.0, 2.0.0).
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">4. Incident Response Steps</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 select-none">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <strong className="text-slate-800">1. Identify</strong>
                    <p className="text-[11px] text-slate-500">Confirm & log incident</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <strong className="text-slate-800">2. Contain</strong>
                    <p className="text-[11px] text-slate-500">Isolate affected system</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <strong className="text-slate-800">3. Recover</strong>
                    <p className="text-[11px] text-slate-500">Restore safely from backups</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <strong className="text-slate-800">4. Resolve</strong>
                    <p className="text-[11px] text-slate-500">Apply patch & notify</p>
                  </div>
                </div>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">5. Security Responsibilities</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 space-y-1">
                    <strong className="text-emerald-900">Stivate Responsibilities:</strong>
                    <p className="text-slate-600">Application security, secure development, release management, cloud infrastructure configuration, and incident response within scope.</p>
                  </div>
                  <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 space-y-1">
                    <strong className="text-blue-900">Customer Responsibilities:</strong>
                    <p className="text-slate-600">Physical PC security, Windows account security, authorized operator access, protecting local credentials, and internal security procedures.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

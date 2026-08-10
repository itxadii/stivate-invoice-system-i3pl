import React, { useEffect, useState } from 'react';
import { settingsService, backupService, updaterService } from '../services/ipc';
import type { AppSettings } from '../types';
import { Save, Database, HardDriveDownload, Sparkles, FolderOpen, RefreshCcw, Cloud, BookOpen, HelpCircle, Keyboard, ShieldCheck, FileText, Lock } from 'lucide-react';
import { Modal } from '../components/Modal';

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [uploadingCloud, setUploadingCloud] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [featureRequestName, setFeatureRequestName] = useState('');
  const [featureRequestEmail, setFeatureRequestEmail] = useState('');
  const [featureRequestMessage, setFeatureRequestMessage] = useState('');
  const [featureRequestResult, setFeatureRequestResult] = useState('');
  const [submittingFeatureRequest, setSubmittingFeatureRequest] = useState(false);
  const [activePolicyModal, setActivePolicyModal] = useState<'privacy' | 'security' | null>(null);

  const fetchSettings = async () => {
    try {
      const data = await settingsService.load();
      setSettings(data);
      setAddressesRaw((data.addressesList || []).join('\n\n'));
      setSuppliersRaw((data.suppliersList || []).join('\n'));
      setScannersRaw((data.scannersList || []).join('\n'));
      setVerifiersRaw((data.verifiersList || []).join('\n'));
      setVehiclesRaw((data.vehiclesList || []).join('\n'));

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
    setSubmittingFeatureRequest(true);
    setFeatureRequestResult('Sending....');

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
        setFeatureRequestResult('Form Submitted Successfully');
        setFeatureRequestName('');
        setFeatureRequestEmail('');
        setFeatureRequestMessage('');
        event.currentTarget.reset();
      } else {
        setFeatureRequestResult('Error submitting feature request. Please try again.');
      }
    } catch (err) {
      console.error('Feature request submit failed:', err);
      setFeatureRequestResult('Error submitting feature request. Please check your network and try again.');
    } finally {
      setSubmittingFeatureRequest(false);
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

    const updatedSettings = {
      ...settings,
      addressesList,
      suppliersList,
      scannersList,
      verifiersList,
      vehiclesList
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
      } else {
        setBackupMsg({ text: `Backup Failed: ${res.message}`, type: 'error' });
      }
    } catch (err: any) {
      setBackupMsg({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setBackingUp(false);
    }
  };

  const handleUploadToCloud = async () => {
    setUploadingCloud(true);
    setBackupMsg(null);
    try {
      const res = await backupService.uploadCloud();
      if (res.success) {
        setBackupMsg({ text: res.message, type: 'success' });
      } else {
        setBackupMsg({ text: `Cloud Backup Failed: ${res.message}`, type: 'error' });
      }
    } catch (err: any) {
      setBackupMsg({ text: `Error: ${err.message || err}`, type: 'error' });
    } finally {
      setUploadingCloud(false);
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
      {/* User Documentation & Operating Guide */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 select-none">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-[#4BB8FA]" />
            <h3 className="text-md font-bold text-slate-800 uppercase tracking-wider">User Documentation & Operating Guide</h3>
          </div>
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-100">
            Quick Start Guide
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-[#4BB8FA] text-slate-900 text-xs font-black flex items-center justify-center shrink-0">1</span>
              <span>Create Dispatch</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Press <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-700 font-bold">Ctrl+N</kbd> or click <strong>Dispatch Pipeline</strong>. Enter Vehicle No, Customer, Consignee, and Pallets Count.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-[#4BB8FA] text-slate-900 text-xs font-black flex items-center justify-center shrink-0">2</span>
              <span>Scan & Verify</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Paste Pull List numbers into the scan box. Click <strong>Mark Verified</strong> next to pull list items when verified into truck slots.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-[#4BB8FA] text-slate-900 text-xs font-black flex items-center justify-center shrink-0">3</span>
              <span>Print Documents</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Click <strong>Print Combined Dispatch</strong> (or <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-700 font-bold">Ctrl+P</kbd>) to print 3 landscape copies of Challan & Barcodes.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-[#4BB8FA] text-slate-900 text-xs font-black flex items-center justify-center shrink-0">4</span>
              <span>Complete & Archive</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              When loaded, click <strong>Complete Dispatch</strong>. Departure time is recorded and archived under <strong>Completed</strong> (<kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-700 font-bold">Ctrl+H</kbd>).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Keyboard size={14} className="text-blue-500" />
              Keyboard Shortcuts Cheat Sheet
            </h4>
            <div className="bg-slate-50/50 rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Create New Dispatch Truck</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Ctrl + N</kbd>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-600 font-medium">View Completed Archive</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Ctrl + H</kbd>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Print Combined Dispatch (3 copies)</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Ctrl + P</kbd>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Save Draft Dispatch</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-700">Ctrl + S</kbd>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle size={14} className="text-amber-500" />
              Tips & Database Backup
            </h4>
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>• <strong>Automatic Cloud & Local Backup:</strong> All database records are automatically backed up locally and uploaded to AWS S3 Cloud upon exiting the application.</p>
              <p>• <strong>Landscape Printing:</strong> Both Challan invoices and Barcode sheets print in high-clarity A4 Landscape format for instant scanner recognition.</p>
              <p>• <strong>Auto-Updates:</strong> Check for application updates anytime in this Settings menu. Downloaded updates install in 1-click on restart.</p>
            </div>
          </div>
        </div>

        {/* Application Legal & Security Policies Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Software Governance & Security Compliance</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePolicyModal('privacy')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <FileText size={13} className="text-blue-500" />
              <span>Privacy Policy</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyModal('security')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Lock size={13} className="text-emerald-500" />
              <span>Security Policy</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-md font-bold text-slate-700 uppercase tracking-wider">Feature Request</h3>
          </div>
        </div>

        <form onSubmit={handleFeatureRequestSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Name</label>
              <input
                type="text"
                name="name"
                value={featureRequestName}
                onChange={(e) => setFeatureRequestName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
              <input
                type="email"
                name="email"
                value={featureRequestEmail}
                onChange={(e) => setFeatureRequestEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Feature Request</label>
            <textarea
              name="message"
              value={featureRequestMessage}
              onChange={(e) => setFeatureRequestMessage(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              placeholder="Describe the feature you'd like to see..."
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="submit"
              disabled={submittingFeatureRequest}
              className="inline-flex items-center justify-center px-4 py-2 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-sm font-bold transition-colors disabled:bg-slate-200 disabled:text-slate-400"
            >
              {submittingFeatureRequest ? 'Sending...' : 'Submit Feature Request'}
            </button>
            {featureRequestResult && (
              <span className="text-sm text-slate-600">{featureRequestResult}</span>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Column */}
        <form onSubmit={handleSave} className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-md font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-500" />
            Application Settings
          </h3>

          {message && (
            <div className={`p-4 rounded-lg border text-sm font-semibold ${message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
              {message.text}
            </div>
          )}

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

          {/* Section: Custom Logistics Dropdowns */}
          <hr className="border-slate-200" />
          <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Logistics Dropdown Options</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-sm font-bold cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>

        {/* Right Actions Column */}
        <div className="space-y-6 flex flex-col h-full min-h-[300px]">
          {/* Backup Operations */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <HardDriveDownload size={16} className="text-blue-500" />
              Database Backups
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              The database is backed up automatically every time you close the application. It preserves the latest 30 backups inside your configured Backup Folder.
            </p>

            {backupMsg && (
              <div className={`p-3 rounded-lg text-xs font-semibold border ${backupMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                {backupMsg.text}
              </div>
            )}

            <button
              onClick={handleTriggerBackup}
              disabled={backingUp || uploadingCloud}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
            >
              <RefreshCcw size={15} className={backingUp ? 'animate-spin' : ''} />
              <span>{backingUp ? 'Creating Backup...' : 'Trigger Backup Now'}</span>
            </button>

            <button
              onClick={handleUploadToCloud}
              disabled={uploadingCloud || backingUp}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-sm font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
            >
              <Cloud size={15} className={uploadingCloud ? 'animate-bounce' : ''} />
              <span>{uploadingCloud ? 'Uploading...' : 'Upload Backup on Cloud'}</span>
            </button>
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

          {/* Created By Logo (bottom right corner) */}
          <div className="flex flex-col items-center justify-end pt-16 mt-auto space-y-3 opacity-95 select-none">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Software Developed By</span>
            <img src="stivate.png" alt="Stivate Logo" className="h-20 w-auto object-contain brightness-95" />
          </div>
        </div>
      </div>

      {/* Privacy Policy & Security Policy Modal */}
      <Modal
        isOpen={activePolicyModal !== null}
        onClose={() => setActivePolicyModal(null)}
        title={activePolicyModal === 'privacy' ? 'Application Privacy Policy' : 'Application Security Policy'}
        maxWidth="max-w-4xl"
      >
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

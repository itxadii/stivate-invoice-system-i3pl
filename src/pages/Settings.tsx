import React, { useEffect, useState } from 'react';
import { settingsService, backupService, updaterService } from '../services/ipc';
import type { AppSettings } from '../types';
import { Save, Database, HardDriveDownload, Sparkles, FolderOpen, RefreshCcw, Cloud } from 'lucide-react';

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
      formData.append('access_key', 'a27bde1c-6cba-44bb-9e1e-bbd0da0756fe');

      const response = await fetch('https://api.web3forms.com/submit', {
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

        {/* Created By Logo (bottom right corner) */}
        <div className="flex flex-col items-center justify-end pt-16 mt-auto space-y-3 opacity-95 select-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Software Developed By</span>
          <img src="/stivate.png" alt="Stivate Logo" className="h-20 w-auto object-contain brightness-95" />
        </div>
      </div>
    </div>
  </div>
  );
};
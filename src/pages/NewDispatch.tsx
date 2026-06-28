import React, { useState, useEffect, useRef } from 'react';
import { databaseService, printService, settingsService } from '../services/ipc';
import type { Dispatch, DispatchItem, AppSettings } from '../types';
import { DispatchTable } from '../components/DispatchTable';
import { Printer, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { Modal } from '../components/Modal';

interface NewDispatchProps {
  editId?: number | null;
  onClearEditId?: () => void;
  setActiveTab: (tab: string) => void;
  previousTab?: string;
}

export const NewDispatch: React.FC<NewDispatchProps> = ({
  editId = null,
  onClearEditId,
  setActiveTab,
  previousTab = 'dashboard'
}) => {
  const [dispatch, setDispatch] = useState<Partial<Dispatch>>({
    dc_no: '',
    date: new Date().toISOString().split('T')[0],
    vehicle_no: '',
    supplier_name: '',
    address: 'AS PER LIST',
    total_pallets: 1,
    total_parts: 0,
    particular: 'AS PER LIST',
    scanning_by: '',
    verify_by: '',
    transaction_type: '',
    created_by: 'Operator',
    status: 'draft',
  });

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [pullListInput, setPullListInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Manual Entry Modal for unknown pull lists
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualItem, setManualItem] = useState<Partial<DispatchItem>>({
    pull_list_no: '',
    id_number: '',
    kit_type: '',
    workcell: '',
    parts: 0
  });

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Load existing dispatch for edit and settings for defaults
  useEffect(() => {
    const loadSettingsAndDispatchData = async () => {
      setLoading(true);
      try {
        const loadedSettings = await settingsService.load();
        setSettings(loadedSettings);

        if (editId) {
          const data = await databaseService.getDispatch(editId);
          if (data) {
            setDispatch({
              id: data.id,
              dc_no: data.dc_no,
              date: data.date,
              vehicle_no: data.vehicle_no,
              supplier_name: data.supplier_name,
              address: data.address,
              total_pallets: data.total_pallets,
              total_parts: data.total_parts,
              created_by: data.created_by,
              particular: data.particular || 'AS PER LIST',
              scanning_by: data.scanning_by || '',
              verify_by: data.verify_by || '',
              transaction_type: data.transaction_type || '',
              status: data.status || 'draft',
            });
            setItems(data.items || []);
          }
        } else {
          // Pre-fill with default values from app settings
          setDispatch((prev) => ({
            ...prev,
            address: loadedSettings.defaultAddress || 'AS PER LIST',
            supplier_name: loadedSettings.defaultSupplier || '',
            scanning_by: loadedSettings.defaultScanner || '',
            verify_by: loadedSettings.defaultVerifier || '',
            vehicle_no: loadedSettings.defaultVehicleNo || '',
          }));
        }
      } catch (err) {
        console.error('Failed to load settings or edit data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettingsAndDispatchData();
  }, [editId]);

  // Keep scanner focused
  useEffect(() => {
    if (!manualModalOpen && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [manualModalOpen]);

  // Calculate total parts dynamically
  useEffect(() => {
    const sum = items.reduce((acc, curr) => acc + (curr.parts || 0), 0);
    setDispatch((prev) => ({ ...prev, total_parts: sum }));
  }, [items]);

  // Scan input handling
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = pullListInput.trim();
    if (!query) return;

    // Collapse multiple spaces and strip FW:/RE: prefixes
    let cleanText = query.replace(/\s+/g, ' ').trim();
    cleanText = cleanText.replace(/^(FW:|FWD:|RE:)\s*/i, '').trim();

    const parts = cleanText.split(' ');

    // 1. Check if it matches the multi-part email subject format
    if (parts.length >= 4) {
      const idNumber = parts[0];
      const pullListNo = parts[1];
      const kitType = parts[2];
      const workcell = parts[3];
      const numParts = parts[4] ? (parseInt(parts[4], 10) || 1) : 1;

      // Verify basic patterns: ID should be digits, Pull List is alphanumeric (allowing hyphens/underscores)
      if (/^\d+$/.test(idNumber) && /^[A-Z0-9_-]+$/i.test(pullListNo)) {
        // Check if duplicate in current list
        if (items.some(item => item.pull_list_no.toLowerCase() === pullListNo.toLowerCase())) {
          setSaveStatus({ text: `Pull List ${pullListNo} already added.`, type: 'error' });
          setPullListInput('');
          setTimeout(() => setSaveStatus(null), 3000);
          return;
        }

        const newItem: DispatchItem = {
          pull_list_no: pullListNo,
          id_number: idNumber,
          kit_type: kitType,
          workcell: workcell,
          parts: numParts
        };

        setItems((prev) => [newItem, ...prev]);
        setPullListInput('');
        setSaveStatus(null);

        // Auto-cache to master database in background so it can be searched
        try {
          databaseService.importMasterData([newItem]);
        } catch (err) {
          console.error('Failed to auto-cache master:', err);
        }
        return;
      }
    }

    // 2. Check if it's a single Pull List Number
    if (parts.length === 1 && /^[A-Z0-9_-]+$/i.test(cleanText)) {
      const pullListNo = cleanText;
      if (items.some(item => item.pull_list_no.toLowerCase() === pullListNo.toLowerCase())) {
        setSaveStatus({ text: `Pull List ${pullListNo} already added.`, type: 'error' });
        setPullListInput('');
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      }

      try {
        const masterItem = await databaseService.searchPullList(pullListNo);
        if (masterItem) {
          const newItem: DispatchItem = {
            pull_list_no: masterItem.pull_list_no,
            id_number: masterItem.id_number || '',
            kit_type: masterItem.kit_type || '',
            workcell: masterItem.workcell || '',
            parts: masterItem.parts || 1
          };
          setItems((prev) => [newItem, ...prev]);
          setPullListInput('');
          setSaveStatus(null);
          return;
        } else {
          // Prefill manual item and open modal
          setManualItem({
            pull_list_no: pullListNo,
            id_number: '',
            kit_type: '',
            workcell: '',
            parts: 1
          });
          setManualModalOpen(true);
          setPullListInput('');
          setSaveStatus(null);
          return;
        }
      } catch (err) {
        console.error('Failed to query database:', err);
      }
    }

    setSaveStatus({
      text: `Error: Scanned text format is invalid. Expected format: "[ID] [PULL_LIST] [KIT_TYPE] [WORKCELL] [PARTS]" or a valid single Pull List Number.`,
      type: 'error'
    });
    setPullListInput('');
    setTimeout(() => setSaveStatus(null), 5000);
  };

  const handleManualItemSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualItem.pull_list_no) {
      setManualError("Pull List Number is required.");
      return;
    }

    const newItem: DispatchItem = {
      pull_list_no: manualItem.pull_list_no.trim(),
      id_number: (manualItem.id_number || '').trim(),
      kit_type: (manualItem.kit_type || '').trim(),
      workcell: (manualItem.workcell || '').trim(),
      parts: Number(manualItem.parts) || 0
    };

    setItems((prev) => [newItem, ...prev]);
    setManualModalOpen(false);
    setManualError(null);
    setPullListInput('');

    // Ask to add to master database so future scans auto-fill
    try {
      databaseService.importMasterData([newItem]);
    } catch (err) {
      console.error('Failed to auto-cache to master data:', err);
    }
  };

  const handleOpenManualModal = () => {
    setManualItem({
      pull_list_no: '',
      id_number: '',
      kit_type: '',
      workcell: '',
      parts: 1
    });
    setManualError(null);
    setManualModalOpen(true);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDispatchChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDispatch((prev) => ({
      ...prev,
      [name]: name === 'total_pallets' ? Number(value) : value
    }));
  };

  const handleSave = async () => {
    if (!dispatch.vehicle_no || !dispatch.supplier_name) {
      setSaveStatus({ text: 'Please fill in VEHICLE NO and SUP NAME.', type: 'error' });
      return null;
    }
    if (items.length === 0) {
      setSaveStatus({ text: 'Please add at least one Pull List item.', type: 'error' });
      return null;
    }

    setLoading(true);
    setSaveStatus(null);
    try {
      const res = await databaseService.saveDispatch(dispatch, items);
      if (res && res.id) {
        setDispatch((prev) => ({ ...prev, id: res.id, dc_no: res.dc_no }));
        setSaveStatus({ text: `Dispatch ${res.dc_no} saved successfully!`, type: 'success' });
        return res;
      }
      return null;
    } catch (err: any) {
      setSaveStatus({ text: `Save failed: ${err.message || err}`, type: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handlePrintCombinedDispatch = async () => {
    const savedDispatch = dispatch.dc_no ? dispatch : await handleSave();
    const dispatchToPrint = {
      ...dispatch,
      dc_no: savedDispatch?.dc_no || dispatch.dc_no,
    };

    if (!dispatchToPrint.dc_no) return;
    if (items.length === 0) {
      setSaveStatus({ text: 'Add items first before printing the combined challan and barcode set.', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await printService.printCombinedDispatch(dispatchToPrint as Dispatch, items);
      setSaveStatus({ text: 'Combined challan + barcode print sent for 3 copies.', type: 'success' });
    } catch (err) {
      console.error(err);
      setSaveStatus({ text: 'Printing combined challan and barcodes failed.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDispatch({
      dc_no: '',
      date: new Date().toISOString().split('T')[0],
      vehicle_no: settings?.defaultVehicleNo || '',
      supplier_name: settings?.defaultSupplier || '',
      address: settings?.defaultAddress || 'AS PER LIST',
      total_pallets: 1,
      total_parts: 0,
      particular: 'AS PER LIST',
      scanning_by: settings?.defaultScanner || '',
      verify_by: settings?.defaultVerifier || '',
      transaction_type: '',
      created_by: 'Operator',
      status: 'draft',
    });
    setItems([]);
    setPullListInput('');
    setSaveStatus(null);
    if (onClearEditId) onClearEditId();
  };

  const handleCancel = () => {
    if (onClearEditId) onClearEditId();
    setActiveTab(previousTab);
  };

  // Keyboard Shortcuts within screen
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          e.stopPropagation();
          void handleSave();
          return;
        }
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          e.stopPropagation();
          void handlePrintCombinedDispatch();
          return;
        }
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          e.stopPropagation();
          void handlePrintCombinedDispatch();
          return;
        }
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          e.stopPropagation();
          handleReset();
          return;
        }
      }
    };
    document.addEventListener('keydown', handleShortcuts, true);
    return () => document.removeEventListener('keydown', handleShortcuts, true);
  }, [dispatch, items, settings]);

  return (
    <div className="space-y-6">
      {/* Top Header Row with Back Button if editing */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          {editId && (
            <button
              onClick={handleCancel}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h3 className="text-md font-bold text-slate-800 uppercase tracking-wide">
              {editId ? `Editing Dispatch: ${dispatch.dc_no}` : 'New Dispatch Invoice'}
            </h3>
            <p className="text-xs text-slate-400">Enter or paste Pull List Numbers or Email Subject lines</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintCombinedDispatch}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            <Printer size={14} />
            <span>Print Set (3 Copies, Ctrl+P)</span>
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:bg-slate-200 disabled:text-slate-400"
          >
            <Save size={14} />
            <span>{loading ? 'Saving...' : 'Save (Ctrl+S)'}</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${
          saveStatus.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {saveStatus.text}
        </div>
      )}

      {/* Main Form Fields Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Dispatch Metadata */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Dispatch Logistics</h4>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">DC NO (Auto)</label>
              <input
                type="text"
                value={dispatch.dc_no || 'Draft (Auto generated)'}
                disabled
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono text-slate-500 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">DATE</label>
              <input
                type="date"
                name="date"
                value={dispatch.date}
                onChange={handleDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
              <select
                name="status"
                value={dispatch.status || 'draft'}
                onChange={handleDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors text-slate-700 font-medium cursor-pointer"
              >
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Supervisor Name</label>
              <select
                name="supplier_name"
                value={dispatch.supplier_name}
                onChange={handleDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors font-medium text-slate-700 cursor-pointer"
              >
                <option value="">-- Select Supervisor --</option>
                {(settings?.suppliersList || []).map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">VEHICLE NO</label>
              <input
                type="text"
                name="vehicle_no"
                placeholder="e.g. MH-12-QW-1234"
                list="vehicles-datalist"
                value={dispatch.vehicle_no}
                onChange={handleDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors uppercase font-semibold text-slate-700"
              />
              <datalist id="vehicles-datalist">
                {(settings?.vehiclesList || []).map((opt, i) => (
                  <option key={i} value={opt} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Address / Consignee</label>
              <select
                name="address"
                value={dispatch.address}
                onChange={handleDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors text-slate-700 font-medium cursor-pointer"
              >
                <option value="">-- Select Consignee Address --</option>
                {(settings?.addressesList || []).map((opt, i) => (
                  <option key={i} value={opt}>{opt.split('\n')[0]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">PERTICULAR</label>
              <input
                type="text"
                name="particular"
                placeholder="e.g. AS PER LIST"
                value={dispatch.particular}
                onChange={handleDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors text-slate-700 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">SCANNING BY</label>
              <select
                name="scanning_by"
                value={dispatch.scanning_by}
                onChange={handleDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors text-slate-700 cursor-pointer"
              >
                <option value="">-- Select Operator --</option>
                {(settings?.scannersList || []).map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">VERIFY BY</label>
              <select
                name="verify_by"
                value={dispatch.verify_by}
                onChange={handleDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors text-slate-700 font-medium cursor-pointer"
              >
                <option value="">-- Select Verifier --</option>
                {(settings?.verifiersList || []).map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">TRANSACTION</label>
              <input
                type="text"
                name="transaction_type"
                placeholder="Transaction details"
                value={dispatch.transaction_type}
                onChange={handleDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors text-slate-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Total Pallets Count</label>
              <input
                type="number"
                name="total_pallets"
                value={dispatch.total_pallets}
                onChange={handleDispatchChange}
                min={1}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors font-mono font-bold text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Scan barcodes & Table items */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Dispatch Items</h4>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleOpenManualModal}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 transition-colors cursor-pointer"
              >
                + Add Manually
              </button>

              {/* Totals Summary */}
              <div className="flex items-center gap-4 text-xs font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                <div>
                  Lists: <span className="text-emerald-600 font-mono font-extrabold">{items.length}</span>
                </div>
                <div className="w-px h-3 bg-slate-200" />
                <div>
                  Total Parts: <span className="text-emerald-600 font-mono font-extrabold">{dispatch.total_parts}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pull List Paste Box */}
          <form onSubmit={handleScanSubmit} className="flex gap-2 w-full">
            <input
              ref={scanInputRef}
              type="text"
              placeholder="Paste Pull List Number or Email Subject line and press Enter..."
              value={pullListInput}
              onChange={(e) => setPullListInput(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-50 text-slate-800 placeholder-slate-400 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#4BB8FA] focus:bg-white transition-all text-sm select-all font-bold tracking-wider focus:ring-2 focus:ring-[#4BB8FA]/20"
            />
            <button
              type="submit"
              className="px-4 py-3 bg-[#4BB8FA] text-slate-900 rounded-lg text-sm font-bold hover:bg-[#35a0dc] cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              Add Pull List
            </button>
          </form>

          {/* Items Table */}
          <div className="flex-1 overflow-y-auto max-h-90">
            <DispatchTable items={items} onRemoveItem={handleRemoveItem} />
          </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => {
          setManualModalOpen(false);
          setManualError(null);
        }}
        title={manualItem.pull_list_no ? "Unknown Pull List Detected" : "Add Pull List Manually"}
      >
        <form onSubmit={handleManualItemSave} className="space-y-4 select-none">
          {manualError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold">
              {manualError}
            </div>
          )}

          {manualItem.pull_list_no ? (
            <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 text-xs font-medium leading-relaxed">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p>
                Pull List <strong>{manualItem.pull_list_no}</strong> was not found in SAP Master records. Please input details manually. It will also be indexed to database automatically.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-lg border border-blue-200 text-blue-900 text-xs font-medium leading-relaxed">
              <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p>
                Please enter the details of the Pull List manually below. This will also cache the item in the database for future scans.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Pull List Number</label>
            <input
              type="text"
              value={manualItem.pull_list_no || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, pull_list_no: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg text-sm font-mono text-slate-700 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">ID Number</label>
            <input
              type="text"
              value={manualItem.id_number || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, id_number: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Kit Type</label>
            <input
              type="text"
              value={manualItem.kit_type || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, kit_type: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Workcell</label>
            <input
              type="text"
              value={manualItem.workcell || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, workcell: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Parts Quantity</label>
            <input
              type="number"
              value={manualItem.parts || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, parts: Number(e.target.value) }))}
              min={1}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono font-bold"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setManualModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-xs font-bold cursor-pointer"
            >
              Add Item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

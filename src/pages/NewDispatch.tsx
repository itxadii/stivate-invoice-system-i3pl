import React, { useState, useEffect, useRef } from 'react';
import { databaseService, printService, settingsService } from '../services/ipc';
import type { Dispatch, DispatchItem, AppSettings } from '../types';
import { DispatchTable } from '../components/DispatchTable';
import { ArrowLeft, AlertCircle, Play, CheckCircle, Barcode, FileText, Printer, Sliders } from 'lucide-react';
import { Modal } from '../components/Modal';
import { DispatchCompleteAnimation, AnimatedStatusButton } from '../components/animations';
import type { ButtonStatus } from '../components/animations';

interface NewDispatchProps {
  editId?: number | null;
  onClearEditId?: () => void;
  setActiveTab: (tab: string) => void;
  previousTab?: string;
}

const getNowDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatForDateTimeInput = (val?: string) => {
  if (!val) return getNowDateTimeString();
  if (val.includes('T')) return val.substring(0, 16);
  if (val.includes(' ')) return val.replace(' ', 'T').substring(0, 16);
  return `${val}T00:00`;
};

const formatDateTimeDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const norm = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const dObj = new Date(norm);
    if (!isNaN(dObj.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let hours = dObj.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const mins = String(dObj.getMinutes()).padStart(2, '0');
      return `${dObj.getDate()}-${months[dObj.getMonth()]}-${dObj.getFullYear().toString().slice(-2)} ${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
    }
  } catch (e) {}
  return dateStr;
};

export const NewDispatch: React.FC<NewDispatchProps> = ({
  editId = null,
  onClearEditId,
  setActiveTab,
  previousTab = 'dashboard'
}) => {
  const [dispatch, setDispatch] = useState<Partial<Dispatch>>({
    dc_no: '',
    date: getNowDateTimeString(),
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
    status: 'loading',
  });

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [pullListInput, setPullListInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [showCompletionAnim, setShowCompletionAnim] = useState(false);
  const [markReadyStatus, setMarkReadyStatus] = useState<ButtonStatus>('idle');
  const [itemVerifyStatus, setItemVerifyStatus] = useState<Record<number, ButtonStatus>>({});

  // Manual Entry Modal for unknown pull lists
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [showLogistics, setShowLogistics] = useState(false);
  const [isManualPending, setIsManualPending] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualItem, setManualItem] = useState<Partial<DispatchItem>>({
    pull_list_no: '',
    id_number: '',
    kit_type: '',
    workcell: '',
    parts: 0
  });

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Ref to hold the latest dispatch and items state for unmount autosave
  const latestStateRef = useRef({ dispatch, items });
  useEffect(() => {
    latestStateRef.current = { dispatch, items };
  }, [dispatch, items]);

  useEffect(() => {
    return () => {
      const { dispatch: d, items: its } = latestStateRef.current;
      // Do not overwrite completed dispatches during unmount
      if (d.status === 'completed') {
        return;
      }
      if (d.vehicle_no && d.supplier_name) {
        const dispatchToSave = { ...d, total_pallets: d.total_pallets || 1 };
        void databaseService.saveDispatch(dispatchToSave, its);
      }
    };
  }, []);

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
              status: (data.status as any) === 'draft' || !data.status ? 'loading' : data.status,
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
        // Check if duplicate in current list (loaded or pending)
        const cleanNo = pullListNo.toUpperCase();
        if (items.some(item => item.pull_list_no.replace(/_pending$/, '').toUpperCase() === cleanNo)) {
          setSaveStatus({ text: `Pull List ${pullListNo} already added.`, type: 'error' });
          setPullListInput('');
          setTimeout(() => setSaveStatus(null), 3000);
          return;
        }

        const newItem: DispatchItem = {
          pull_list_no: `${cleanNo}_pending`, // starts as pending since it was pasted/typed in bulk!
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
          databaseService.importMasterData([{
            ...newItem,
            pull_list_no: cleanNo
          }]);
        } catch (err) {
          console.error('Failed to auto-cache master:', err);
        }
        return;
      }
    }

    // 2. Check if it's a single Pull List Number
    if (parts.length === 1 && /^[A-Z0-9_-]+$/i.test(cleanText)) {
      setPullListInput('');
      await handleMarkIndividualLoaded(cleanText);
      return;
    }

    setSaveStatus({
      text: `Error: Scanned text format is invalid. Expected format: "[ID] [PULL_LIST] [KIT_TYPE] [WORKCELL] [PARTS]" or a valid single Pull List Number.`,
      type: 'error'
    });
    setPullListInput('');
    setTimeout(() => setSaveStatus(null), 5000);
  };

  const handleMarkIndividualLoaded = async (pullListNo: string) => {
    const cleanText = pullListNo.replace(/\s+/g, ' ').trim().toUpperCase();
    if (!cleanText) return;

    // Check if it already exists as loaded in items list (no _pending suffix)
    const alreadyLoaded = items.some(item => item.pull_list_no === cleanText);
    if (alreadyLoaded) {
      setSaveStatus({ text: `Pull List ${cleanText} already loaded.`, type: 'error' });
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    // Check if it already exists as pending in items list (ends with _pending)
    const pendingIdx = items.findIndex(item => item.pull_list_no === `${cleanText}_pending`);
    if (pendingIdx !== -1) {
      // Promote it to loaded (strip _pending suffix)
      handleConfirmLoad(pendingIdx);
      setSaveStatus({ text: `Pull List ${cleanText} loaded successfully.`, type: 'success' });
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    try {
      const masterItem = await databaseService.searchPullList(cleanText);
      if (masterItem) {
        const newItem: DispatchItem = {
          pull_list_no: masterItem.pull_list_no,
          id_number: masterItem.id_number || '',
          kit_type: masterItem.kit_type || '',
          workcell: masterItem.workcell || '',
          parts: masterItem.parts || 1
        };
        setItems((prev) => [newItem, ...prev]);
        setSaveStatus({ text: `Pull List ${cleanText} marked loaded successfully.`, type: 'success' });
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        // Prefill manual item and open modal
        setIsManualPending(false);
        setManualItem({
          pull_list_no: cleanText,
          id_number: '',
          kit_type: '',
          workcell: '',
          parts: 1
        });
        setManualModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to query database:', err);
    }
  };

  const handleManualItemSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualItem.pull_list_no) {
      setManualError("Pull List Number is required.");
      return;
    }

    const cleanNo = manualItem.pull_list_no.trim().toUpperCase();
    const resolvedPullListNo = isManualPending ? `${cleanNo}_pending` : cleanNo;

    const newItem: DispatchItem = {
      pull_list_no: resolvedPullListNo,
      id_number: (manualItem.id_number || '').trim(),
      kit_type: (manualItem.kit_type || '').trim(),
      workcell: (manualItem.workcell || '').trim(),
      parts: Number(manualItem.parts) || 0
    };

    setItems((prev) => [newItem, ...prev]);
    setManualModalOpen(false);
    setManualError(null);
    setPullListInput('');

    // Ask to add to master database (strip _pending suffix so master has clean pull list)
    try {
      databaseService.importMasterData([{
        ...newItem,
        pull_list_no: cleanNo
      }]);
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
    setIsManualPending(true);
    setManualError(null);
    setManualModalOpen(true);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmLoad = (idx: number) => {
    setItemVerifyStatus((prev) => ({ ...prev, [idx]: 'loading' }));
    setTimeout(() => {
      setItems((prev) => {
        const next = [...prev];
        const targetItem = next[idx];
        if (targetItem && targetItem.pull_list_no.endsWith('_pending')) {
          next[idx] = {
            ...targetItem,
            pull_list_no: targetItem.pull_list_no.replace(/_pending$/, '')
          };
        }
        return next;
      });
      setItemVerifyStatus((prev) => ({ ...prev, [idx]: 'success' }));
      setTimeout(() => {
        setItemVerifyStatus((prev) => ({ ...prev, [idx]: 'idle' }));
      }, 1000);
    }, 350);
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


    setLoading(true);
    setSaveStatus(null);
    try {
      const dispatchToSave = { ...dispatch, total_pallets: dispatch.total_pallets || 1 };
      const res = await databaseService.saveDispatch(dispatchToSave, items);
      if (res && res.id) {
        setDispatch((prev) => ({ ...prev, id: res.id, dc_no: res.dc_no }));
        setSaveStatus({ text: `Dispatch ${res.dc_no} saved successfully!`, type: 'success' });
        
        // Update local settings vehicles list if new truck number added
        if (dispatch.vehicle_no && settings) {
          const cleanNo = dispatch.vehicle_no.trim().toUpperCase();
          const currentList = settings.vehiclesList || [];
          if (!currentList.some((v) => v.trim().toUpperCase() === cleanNo)) {
            setSettings((prevSettings) =>
              prevSettings ? { ...prevSettings, vehiclesList: [...(prevSettings.vehiclesList || []), cleanNo] } : prevSettings
            );
          }
        }

        // Redirect to active pipeline if this is a newly created dispatch
        if (!editId) {
          setTimeout(() => {
            setActiveTab('pipeline');
          }, 1000);
        }
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
      setSaveStatus({ text: 'Combined challan + barcode print set sent for 6 copies.', type: 'success' });
    } catch (err) {
      console.error(err);
      setSaveStatus({ text: 'Printing combined challan and barcodes failed.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBarcodes = async () => {
    if (items.length === 0) {
      setSaveStatus({ text: 'No items to print barcodes.', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      await printService.printBarcodes(items);
      setSaveStatus({ text: 'Barcode print command sent successfully.', type: 'success' });
    } catch (err) {
      setSaveStatus({ text: 'Failed to print barcodes.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintChallan = async () => {
    if (!dispatch.dc_no) {
      setSaveStatus({ text: 'Please save the dispatch first before printing the challan.', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      await printService.printChallan(dispatch as Dispatch, items);
      setSaveStatus({ text: 'Challan PDF print command sent successfully.', type: 'success' });
    } catch (err) {
      setSaveStatus({ text: 'Failed to print Challan PDF.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReady = async () => {
    if (!dispatch.vehicle_no || !dispatch.supplier_name) {
      setSaveStatus({ text: 'Please fill in VEHICLE NO and SUP NAME.', type: 'error' });
      setMarkReadyStatus('error');
      setTimeout(() => setMarkReadyStatus('idle'), 1500);
      return;
    }
    setMarkReadyStatus('loading');
    setLoading(true);
    setSaveStatus(null);
    try {
      const updatedDispatch = { ...dispatch, status: 'ready' as const };
      const res = await databaseService.saveDispatch(updatedDispatch, items);
      if (res && res.id) {
        setDispatch((prev) => ({ ...prev, status: 'ready' }));
        setMarkReadyStatus('success');
        setSaveStatus({ text: 'Dispatch marked as READY. Waiting for complete confirmation.', type: 'success' });
        setTimeout(() => {
          setMarkReadyStatus('idle');
        }, 1200);
      } else {
        setMarkReadyStatus('error');
        setTimeout(() => setMarkReadyStatus('idle'), 1500);
      }
    } catch (err: any) {
      setMarkReadyStatus('error');
      setSaveStatus({ text: `Failed to mark ready: ${err.message || err}`, type: 'error' });
      setTimeout(() => setMarkReadyStatus('idle'), 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDispatch = async () => {
    if (!dispatch.id) return;

    const totalPullLists = items.length;
    const loadedCount = items.filter(item => !item.pull_list_no.endsWith('_pending')).length;
    const hasPending = items.some(item => item.pull_list_no.endsWith('_pending'));

    if (totalPullLists === 0) {
      setSaveStatus({
        text: 'Cannot complete dispatch: No pull lists have been added to this dispatch.',
        type: 'error'
      });
      setConfirmCompleteOpen(false);
      return;
    }

    if (hasPending || loadedCount < totalPullLists) {
      setSaveStatus({
        text: `Cannot complete dispatch: Not all pull lists are verified (${loadedCount} of ${totalPullLists} verified). Please scan or verify all pending pull lists first.`,
        type: 'error'
      });
      setConfirmCompleteOpen(false);
      return;
    }

    setLoading(true);
    setSaveStatus(null);
    setConfirmCompleteOpen(false);
    try {
      const completionTimestamp = getNowDateTimeString();
      const updatedDispatch = { 
        ...dispatch, 
        status: 'completed' as const,
        date: completionTimestamp
      };
      const res = await databaseService.saveDispatch(updatedDispatch, items);
      if (res && res.id) {
        setDispatch(updatedDispatch);
        setSaveStatus({ text: `Dispatch ${dispatch.dc_no} completed successfully and archived at ${formatDateTimeDisplay(completionTimestamp)}!`, type: 'success' });
        setShowCompletionAnim(true);
      }
    } catch (err: any) {
      setSaveStatus({ text: `Failed to complete dispatch: ${err.message || err}`, type: 'error' });
    } finally {
      setLoading(false);
    }
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
              {editId ? `Loading Dispatch: ${dispatch.dc_no}` : 'New Dispatch Invoice'}
            </h3>
            <p className="text-xs text-slate-400">Enter or paste Pull List Numbers or Email Subject lines</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">


          {/* Unified Print Set Button */}
          <button
            onClick={handlePrintCombinedDispatch}
            disabled={loading || items.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
            title="Prints 3 copies of Challan and 3 copies of Barcodes (Total 6 pages) in 1 click"
          >
            <Printer size={14} />
            <span>Print Set (3x Challan + 3x Barcodes)</span>
          </button>

          {/* Print Barcodes Button */}
          <button
            onClick={handlePrintBarcodes}
            disabled={loading || items.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            <Barcode size={14} />
            <span>Print Barcodes</span>
          </button>

          {/* Print Challan Button */}
          <button
            onClick={handlePrintChallan}
            disabled={loading || !dispatch.dc_no}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileText size={14} />
            <span>Print Challan</span>
          </button>

          {/* Mark Ready Action (if status is loading) */}
          {dispatch.id && dispatch.status === 'loading' && (
            <AnimatedStatusButton
              status={markReadyStatus}
              idleText="Mark Ready"
              loadingText="Marking Ready..."
              successText="✓ Ready"
              idleIcon={Play}
              variant="amber"
              onClick={handleMarkReady}
              disabled={loading}
            />
          )}

          {/* Complete Dispatch Action (if status is ready) */}
          {dispatch.id && dispatch.status === 'ready' && (
            <button
              onClick={() => setConfirmCompleteOpen(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
            >
              <CheckCircle size={14} />
              <span>Complete Dispatch</span>
            </button>
          )}
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
      <div className="flex gap-6 items-start">
        {/* Left Toggle Sidebar Trigger */}
        <div className="flex flex-col gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setShowLogistics(!showLogistics)}
            className={`p-2 rounded-lg transition-all cursor-pointer border ${
              showLogistics
                ? 'bg-[#4BB8FA]/10 text-[#4BB8FA] border-[#4BB8FA]/20'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
            title="Toggle Dispatch Logistics Panel"
          >
            <Sliders size={18} />
          </button>
        </div>

        {/* Dynamic Grid Layout */}
        <div className={`flex-1 grid grid-cols-1 gap-6 ${showLogistics ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {/* Left Side: Dispatch Metadata */}
          {showLogistics && (
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
                  <label className="text-xs font-bold text-slate-500 uppercase">DATE & TIME</label>
                  <input
                    type="datetime-local"
                    name="date"
                    value={formatForDateTimeInput(dispatch.date)}
                    onChange={handleDispatchChange}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors font-medium text-slate-700"
                  />
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
                  <label className="text-xs font-bold text-slate-500 uppercase">VEHICLE SIZE</label>
                  <select
                    name="vehicle_size"
                    value={dispatch.vehicle_size || settings?.defaultVehicleSize || '32 ft'}
                    onChange={handleDispatchChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors text-slate-700 font-bold cursor-pointer"
                  >
                    {(settings?.vehicleSizesList || ['32 ft', '20 ft', '10 ft']).map((vs, i) => (
                      <option key={i} value={vs}>{vs}</option>
                    ))}
                  </select>
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
          )}

          {/* Right Side: Scan barcodes & Table items */}
          <div className={`${
            dispatch.id && (dispatch.status === 'loading' || dispatch.status === 'ready')
              ? 'lg:col-span-1'
              : 'lg:col-span-2'
          } bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4`}>
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
              Mark Loaded
            </button>
          </form>

          <div className="flex-1 overflow-y-auto max-h-90">
            <DispatchTable items={items} onRemoveItem={handleRemoveItem} />
          </div>
        </div>

        {/* Third Column: Loading Checklist (Only shown in active pipeline edit mode) */}
        {dispatch.id && (dispatch.status === 'loading' || dispatch.status === 'ready') && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Loading Checklist</h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-3">
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Vehicle</span>
                  <span className="font-semibold text-slate-700 uppercase">{dispatch.vehicle_no}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Supervisor</span>
                  <span className="font-semibold text-slate-700">{dispatch.supplier_name}</span>
                </div>
                <div className="pt-2 col-span-2">
                  <span className="text-slate-400 font-bold uppercase block">Created At</span>
                  <span className="font-semibold text-slate-700">
                    {dispatch.created_at ? new Date(dispatch.created_at).toLocaleString() : 'Just now'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                {(() => {
                  const loadedCount = items.filter(item => !item.pull_list_no.endsWith('_pending')).length;
                  const totalPullLists = items.length;
                  const pct = totalPullLists > 0 ? Math.min(100, Math.round((loadedCount / totalPullLists) * 100)) : 0;
                  return (
                    <>
                      <div className="flex justify-between text-xs font-bold font-mono">
                        <span className="text-slate-500 uppercase tracking-wider text-[10px]">Overall Progress</span>
                        <span>{loadedCount} / {totalPullLists} Pull Lists ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                        <div
                          className="bg-[#4BB8FA] h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Checklist Scroll List */}
              <div className="space-y-3 pt-2 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Scanning Checklist</span>
                
                <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
                  {items.length === 0 ? (
                    <div className="py-6 px-4 text-center text-xs font-semibold text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      No pull lists added yet. Scan or add pull lists to build checklist.
                    </div>
                  ) : (
                    <>
                      {/* Checked items */}
                      {items.filter(item => !item.pull_list_no.endsWith('_pending')).map((item, idx) => (
                        <div
                          key={`loaded-${idx}`}
                          className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-emerald-50/40 backdrop-blur-sm p-2.5 rounded-xl border border-emerald-100/60 shadow-sm transition-all duration-200 h-12"
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black shrink-0 shadow-sm">
                            ✓
                          </span>
                          <span className="font-mono text-emerald-900 font-bold tracking-wider truncate text-sm">{item.pull_list_no.replace(/_pending$/, '')}</span>
                        </div>
                      ))}

                      {/* Pending items from the list */}
                      {items.filter(item => item.pull_list_no.endsWith('_pending')).map((item, idx) => {
                        const cleanPullList = item.pull_list_no.replace(/_pending$/, '');
                        const actualIdx = items.indexOf(item);
                        return (
                          <div
                            key={`pending-list-${idx}`}
                            className="flex items-center gap-3 bg-amber-50/30 backdrop-blur-sm p-2.5 rounded-xl border border-amber-200/40 shadow-sm transition-all duration-200 hover:shadow-md h-12"
                          >
                            <span className="flex items-center justify-center w-6 h-6 rounded-full border border-amber-300 text-amber-500 text-xs font-extrabold shrink-0 bg-amber-50 shadow-inner">
                              ○
                            </span>
                            <span className="font-mono text-amber-900 font-bold tracking-wider truncate flex-1 text-sm">{cleanPullList}</span>
                            <AnimatedStatusButton
                              type="button"
                              status={itemVerifyStatus[actualIdx] || 'idle'}
                              idleText="Verify"
                              loadingText="Verifying..."
                              successText="✓ Verified"
                              variant="success"
                              onClick={() => handleConfirmLoad(actualIdx)}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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

      {/* Confirm Departure Modal */}
      <Modal
        isOpen={confirmCompleteOpen}
        onClose={() => setConfirmCompleteOpen(false)}
        title="Confirm Dispatch"
      >
        <div className="space-y-4 select-none">
          <div className="flex items-start gap-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-indigo-900 text-xs font-medium leading-relaxed">
            <AlertCircle size={18} className="text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Confirm Departure</p>
              <p>Has the truck physically left the warehouse? Confirming will finalize the invoice, transition status to Completed, and archive the dispatch record.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setConfirmCompleteOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteDispatch}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Complete Dispatch
            </button>
          </div>
        </div>
      </Modal>

      {/* Dispatch Completion Animation Overlay */}
      {showCompletionAnim && (
        <DispatchCompleteAnimation
          dispatchNumber={dispatch.dc_no || 'DC-COMPLETED'}
          onComplete={() => {
            setShowCompletionAnim(false);
            if (onClearEditId) onClearEditId();
            setActiveTab('pipeline');
          }}
        />
      )}
    </div>
  );
};

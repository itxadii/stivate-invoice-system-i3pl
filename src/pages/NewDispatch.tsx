import React, { useState, useEffect, useRef } from 'react';
import { databaseService, printService, settingsService } from '../services/ipc';
import type { Dispatch, DispatchItem, AppSettings } from '../types';
import { DispatchTable } from '../components/DispatchTable';
import { ArrowLeft, AlertCircle, Play, CheckCircle, Barcode, FileText, Printer, Sliders, Package, ClipboardList, Check, Copy } from 'lucide-react';
import { copyDispatchPullListsToClipboard } from '../utils/clipboard';
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
    address: '',
    total_pallets: 1,
    total_parts: 0,
    particular: 'AS PER LIST',
    scanning_by: '',
    verify_by: '',
    transaction_type: '',
    created_by: 'Operator',
    status: 'loading',
    is_empty_pallets: false,
  });

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [pullListInput, setPullListInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [showCompletionAnim, setShowCompletionAnim] = useState(false);
  const [markReadyStatus, setMarkReadyStatus] = useState<ButtonStatus>('idle');

  // Manual Entry Modal for unknown pull lists
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [showLogistics, setShowLogistics] = useState(false);
  const [isManualPending, setIsManualPending] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualItem, setManualItem] = useState<{
    pull_list_no: string;
    id_number: string;
    kit_type: string;
    workcell: string;
    parts: number | string;
  }>({
    pull_list_no: '',
    id_number: '',
    kit_type: '',
    workcell: '',
    parts: ''
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
        const dispatchToSave = { ...d, total_pallets: d.total_pallets || 1, is_empty_pallets: d.is_empty_pallets ? 1 : 0 };
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
              is_empty_pallets: Boolean(data.is_empty_pallets),
            });
            setItems(data.items || []);
          }
        } else {
          // Pre-fill with default values from app settings
          const defaultAddr = (loadedSettings.defaultAddress && loadedSettings.defaultAddress.toUpperCase() !== 'AS PER LIST')
            ? loadedSettings.defaultAddress
            : (loadedSettings.addressesList?.find((a: string) => a && a.toUpperCase() !== 'AS PER LIST') || '');
          setDispatch((prev) => ({
            ...prev,
            address: defaultAddr,
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

    // 3. Fallback: If it does not match standard 5-part pattern, treat as manual description/item
    setPullListInput('');
    await handleMarkIndividualLoaded(cleanText);
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
          parts: ''
        });
        setManualModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to query database:', err);
    }
  };

  const handleManualItemSave = (e: React.FormEvent) => {
    e.preventDefault();
    const primaryName = (manualItem.pull_list_no || manualItem.kit_type || manualItem.id_number || '').trim();
    if (!primaryName) {
      setManualError("Please enter at least a Pull List Number or Description.");
      return;
    }

    const cleanNo = (manualItem.pull_list_no ? manualItem.pull_list_no.trim() : primaryName).toUpperCase();
    const resolvedPullListNo = isManualPending ? `${cleanNo}_pending` : cleanNo;

    const newItem: DispatchItem = {
      pull_list_no: resolvedPullListNo,
      id_number: (manualItem.id_number || '').trim(),
      kit_type: (manualItem.kit_type || '').trim(),
      workcell: (manualItem.workcell || '').trim(),
      parts: Number(manualItem.parts) > 0 ? Number(manualItem.parts) : 0
    };

    setItems((prev) => [newItem, ...prev]);

    // If dispatch particular is still the default 'AS PER LIST', update it with the description
    setDispatch((prev) => {
      if (!prev.particular || prev.particular === 'AS PER LIST') {
        return { ...prev, particular: cleanNo };
      }
      return prev;
    });

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
      parts: ''
    });
    setIsManualPending(true);
    setManualError(null);
    setManualModalOpen(true);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmLoad = (idx: number) => {
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
  };

  const handleToggleVerify = (idx: number) => {
    setItems((prev) => {
      const next = [...prev];
      const targetItem = next[idx];
      if (!targetItem) return next;
      const isCurrentlyPending = targetItem.pull_list_no.endsWith('_pending');
      next[idx] = {
        ...targetItem,
        pull_list_no: isCurrentlyPending
          ? targetItem.pull_list_no.replace(/_pending$/, '')
          : `${targetItem.pull_list_no}_pending`
      };
      return next;
    });
  };

  const handleVerifyAll = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        pull_list_no: item.pull_list_no.replace(/_pending$/, '')
      }))
    );
    setSaveStatus({ text: 'All pull lists marked as verified.', type: 'success' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const [copiedMail, setCopiedMail] = useState(false);

  const handleCopyPullLists = async () => {
    if (items.length === 0) {
      setSaveStatus({ text: 'No pull lists to copy.', type: 'error' });
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    const success = await copyDispatchPullListsToClipboard(dispatch, items);
    if (success) {
      setCopiedMail(true);
      setTimeout(() => setCopiedMail(false), 2500);
      setSaveStatus({
        text: `Copied ${items.length} pull lists for DC ${dispatch.dc_no || 'Draft'} to clipboard in email format!`,
        type: 'success'
      });
      setTimeout(() => setSaveStatus(null), 3500);
    } else {
      setSaveStatus({ text: 'Failed to copy to clipboard.', type: 'error' });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleDispatchChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setDispatch((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setDispatch((prev) => ({
        ...prev,
        [name]: name === 'total_pallets' ? Number(value) : value
      }));
    }
  };

  const handleSave = async () => {
    if (!dispatch.vehicle_no || !dispatch.supplier_name) {
      setSaveStatus({ text: 'Please fill in VEHICLE NO and SUP NAME.', type: 'error' });
      return null;
    }

    setLoading(true);
    setSaveStatus(null);
    try {
      const dispatchToSave = { ...dispatch, total_pallets: dispatch.total_pallets || 1, is_empty_pallets: dispatch.is_empty_pallets ? 1 : 0 };
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

    if (dispatch.is_empty_pallets) {
      try {
        setLoading(true);
        await printService.printChallan(dispatchToPrint as Dispatch, items);
        setSaveStatus({ text: 'Empty Pallet Challan print command sent successfully.', type: 'success' });
      } catch (err) {
        console.error(err);
        setSaveStatus({ text: 'Printing Challan failed.', type: 'error' });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (items.length === 0) {
      setSaveStatus({ text: 'Add items first before printing the combined challan and barcode set.', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await printService.printCombinedDispatch(dispatchToPrint as Dispatch, items);
      const barcodePages = Math.max(1, Math.ceil(items.length / 15));
      const totalBarcodes = barcodePages * 3;
      const totalPages = 3 + totalBarcodes;
      setSaveStatus({
        text: `Combined print set sent: 3 Challans + ${totalBarcodes} Barcodes (${totalPages} pages in total).`,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      setSaveStatus({ text: 'Printing combined challan and barcodes failed.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBarcodes = async () => {
    if (dispatch.is_empty_pallets || items.length === 0) {
      setSaveStatus({ text: 'No barcode items to print for Empty Pallets Return.', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      const savedDispatch = dispatch.dc_no ? dispatch : await handleSave();
      const dispatchToPrint = {
        ...dispatch,
        dc_no: savedDispatch?.dc_no || dispatch.dc_no,
      };
      await printService.printBarcodes(items, dispatchToPrint as Dispatch);
      setSaveStatus({ text: 'Barcode print command sent successfully.', type: 'success' });
    } catch (err) {
      setSaveStatus({ text: 'Failed to print barcodes.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintChallan = async () => {
    try {
      setLoading(true);
      const savedDispatch = dispatch.dc_no ? dispatch : await handleSave();
      const dispatchToPrint = {
        ...dispatch,
        dc_no: savedDispatch?.dc_no || dispatch.dc_no,
      };
      if (!dispatchToPrint.dc_no) {
        setSaveStatus({ text: 'Failed to generate DC number for challan.', type: 'error' });
        return;
      }
      await printService.printChallan(dispatchToPrint as Dispatch, items);
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
      const updatedDispatch = { ...dispatch, status: 'ready' as const, is_empty_pallets: dispatch.is_empty_pallets ? 1 : 0 };
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

    if (!dispatch.is_empty_pallets) {
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
    }

    setLoading(true);
    setSaveStatus(null);
    setConfirmCompleteOpen(false);
    try {
      const completionTimestamp = getNowDateTimeString();
      const updatedDispatch = { 
        ...dispatch, 
        status: 'completed' as const,
        date: completionTimestamp,
        is_empty_pallets: dispatch.is_empty_pallets ? 1 : 0
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
            title={
              items.length > 15
                ? `Prints 3 Challans and ${Math.ceil(items.length / 15) * 3} Barcodes (${3 + Math.ceil(items.length / 15) * 3} pages in total) in 1 click`
                : "Prints 3 copies of Challan and 3 copies of Barcodes (Total 6 pages) in 1 click"
            }
          >
            <Printer size={14} />
            <span>
              {items.length > 15
                ? `Print Set (3x Challan + ${Math.ceil(items.length / 15) * 3}x Barcodes)`
                : 'Print Set (3x Challan + 3x Barcodes)'}
            </span>
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

        {/* Dynamic Horizontal Columns Layout */}
        <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-5 items-start">
          {/* Left Side: Dispatch Metadata */}
          {showLogistics && (
            <div className="w-full lg:w-72 xl:w-80 shrink-0 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase">Total Pallets Count</label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="is_empty_pallets"
                        checked={Boolean(dispatch.is_empty_pallets)}
                        onChange={handleDispatchChange}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Empty Pallets</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    name="total_pallets"
                    value={dispatch.total_pallets}
                    onChange={handleDispatchChange}
                    min={1}
                    required
                    className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors font-mono font-bold ${
                      dispatch.is_empty_pallets
                        ? 'bg-amber-50/70 border-amber-300 text-amber-900 focus:bg-white focus:border-amber-500'
                        : 'border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white text-slate-700'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dispatch Items (Merged with Loading Checklist) */}
          <div className="flex-1 min-w-0 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
                  <Package size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Dispatch Items</h4>
                  <p className="text-xs text-slate-400">Scanned pull lists and items associated with this dispatch</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenManualModal}
                  disabled={Boolean(dispatch.is_empty_pallets)}
                  className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  + Add Manually
                </button>

                {/* Totals Summary */}
                <div className="flex items-center gap-4 text-xs font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
                  <div>
                    Pull Lists: <span className="text-emerald-600 font-mono font-black text-sm">{items.length}</span>
                  </div>
                  <div className="w-px h-3.5 bg-slate-300" />
                  <div>
                    Total Parts: <span className="text-emerald-600 font-mono font-black text-sm">{dispatch.total_parts}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Merged Verification Progress Banner */}
            {items.length > 0 && !dispatch.is_empty_pallets && (() => {
              const loadedCount = items.filter(item => !item.pull_list_no.endsWith('_pending')).length;
              const totalPullLists = items.length;
              const progressPct = totalPullLists > 0 ? Math.min(100, Math.round((loadedCount / totalPullLists) * 100)) : 0;
              return (
                <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className={`p-2 rounded-lg ${progressPct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {progressPct === 100 ? <CheckCircle size={18} /> : <ClipboardList size={18} />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span className="text-slate-600 uppercase tracking-wider text-[10px] font-sans flex items-center gap-1.5">
                          Verification Progress
                        </span>
                        <span className="text-slate-800">
                          {loadedCount} of {totalPullLists} Verified ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            progressPct === 100 ? 'bg-emerald-500' : 'bg-[#4BB8FA]'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {items.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCopyPullLists}
                        className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center justify-center border ${
                          copiedMail
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                        }`}
                        title={copiedMail ? "Copied for Mail!" : "Copy for Mail"}
                        aria-label="Copy for Mail"
                      >
                        {copiedMail ? <Check size={16} className="text-emerald-600 stroke-[3]" /> : <Copy size={16} />}
                      </button>
                    )}
                    {loadedCount < totalPullLists && (
                      <button
                        type="button"
                        onClick={handleVerifyAll}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                        title="Mark all pull lists as verified"
                      >
                        <Check size={14} className="stroke-[3]" />
                        <span>Verify All ({totalPullLists - loadedCount})</span>
                      </button>
                    )}
                    {progressPct === 100 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-black shadow-2xs">
                        <Check size={14} className="text-emerald-700 stroke-[3]" />
                        <span>All Items Verified</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Empty Pallets Banner */}
            {dispatch.is_empty_pallets && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 shadow-2xs">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                  <Package size={18} />
                </div>
                <div className="space-y-1">
                  <h5 className="text-xs font-black uppercase tracking-wider text-amber-950">Empty Pallets Return Mode Active</h5>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    This DC is configured for <strong>{dispatch.total_pallets || 1} Empty Pallets</strong>. Pull list scanning is not required. You can print Challans and click <strong>Mark Ready</strong> / <strong>Complete Dispatch</strong> directly.
                  </p>
                </div>
              </div>
            )}

            {/* Pull List Paste Box */}
            <form onSubmit={handleScanSubmit} className="flex gap-2.5 w-full">
              <input
                ref={scanInputRef}
                type="text"
                placeholder={dispatch.is_empty_pallets ? "Empty Pallets Return (No pull lists needed)..." : "Paste Pull List Number or Email Subject line and press Enter..."}
                value={pullListInput}
                onChange={(e) => setPullListInput(e.target.value)}
                disabled={Boolean(dispatch.is_empty_pallets)}
                className="flex-1 px-4 py-3 bg-slate-50/80 text-slate-800 placeholder-slate-400 font-mono border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#4BB8FA] focus:bg-white transition-all text-sm select-all font-bold tracking-wider focus:ring-2 focus:ring-[#4BB8FA]/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              />
              <button
                type="submit"
                disabled={Boolean(dispatch.is_empty_pallets)}
                className="px-6 py-3 bg-[#4BB8FA] text-slate-900 rounded-xl text-sm font-black hover:bg-[#35a0dc] transition-all cursor-pointer whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              >
                Mark Loaded
              </button>
            </form>

            <div className="flex-1 overflow-y-auto min-h-[380px] max-h-[620px] rounded-xl border border-slate-200 shadow-2xs">
              <DispatchTable
                items={items}
                onRemoveItem={handleRemoveItem}
                onToggleVerify={handleToggleVerify}
              />
            </div>
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
            <label className="text-xs font-bold text-slate-500 uppercase">
              Pull List Number / Description <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. O1RI materials or PL-10294"
              value={manualItem.pull_list_no || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, pull_list_no: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg text-sm font-mono text-slate-700 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              ID Number <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Optional"
              value={manualItem.id_number || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, id_number: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Kit Type <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Optional"
              value={manualItem.kit_type || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, kit_type: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Workcell <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Optional"
              value={manualItem.workcell || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, workcell: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Parts Quantity <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              placeholder="0"
              value={manualItem.parts === 0 ? '' : manualItem.parts || ''}
              onChange={(e) => setManualItem((prev) => ({ ...prev, parts: e.target.value }))}
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
              <p>
                {dispatch.is_empty_pallets
                  ? `Has the truck with ${dispatch.total_pallets || 1} return pallets physically departed? Confirming will finalize the invoice, transition status to Completed, and archive the dispatch record.`
                  : `Has the truck physically left the warehouse? Confirming will finalize the invoice, transition status to Completed, and archive the dispatch record.`}
              </p>
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

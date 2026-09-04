import React, { useState, useEffect, useRef, useCallback } from 'react';
import { databaseService, printService, settingsService } from '../services/ipc';
import type { Dispatch, DispatchItem, AppSettings } from '../types';
import { SearchBox } from '../components/SearchBox';
import { Modal } from '../components/Modal';
import { DispatchTable } from '../components/DispatchTable';
import { Printer, Eye, Trash2, Calendar, AlertTriangle, Download, Copy, Check, MapPin } from 'lucide-react';
import { copyDispatchPullListsToClipboard } from '../utils/clipboard';

interface DispatchHistoryProps {}

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

export const DispatchHistory: React.FC<DispatchHistoryProps> = () => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters State
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Detail Modal State
  const [selectedDispatch, setSelectedDispatch] = useState<(Dispatch & { items: DispatchItem[] }) | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Copy Feedback State
  const [copiedModal, setCopiedModal] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<number | null>(null);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchDispatches = useCallback(async (query = '', append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const limit = 200;
      const offset = append ? (page + 1) * limit : 0;

      let data;
      if (query.trim()) {
        data = await databaseService.searchDispatches(query, 'completed', limit, offset);
      } else {
        data = await databaseService.getAllDispatches('completed', limit, offset);
      }

      if (append) {
        setDispatches((prev) => [...prev, ...data]);
        setPage((prev) => prev + 1);
      } else {
        setDispatches(data);
        setPage(0);
      }
      setHasMore(data.length === limit);
    } catch (err) {
      console.error('Failed to load completed dispatches:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDispatches();

    const loadSettings = async () => {
      try {
        const data = await settingsService.load();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings in completed dispatches archive:', err);
      }
    };
    loadSettings();
  }, []);

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    fetchDispatches(val, false);
  };

  const filteredDispatches = dispatches.filter(d => {
    if (dateFilter && !d.date.startsWith(dateFilter)) return false;
    if (vehicleFilter && !d.vehicle_no.toLowerCase().includes(vehicleFilter.toLowerCase())) return false;
    if (supervisorFilter && supervisorFilter !== '' && d.supplier_name !== supervisorFilter) return false;
    return true;
  });

  const handleExportCSV = () => {
    if (filteredDispatches.length === 0) return;

    const headers = [
      'DC Number',
      'Date',
      'Vehicle No',
      'Supervisor',
      'Total Pull Lists',
      'Total Parts',
      'Consignee Address',
      'Particulars',
      'Scanning By',
      'Verify By',
      'Transaction Type'
    ];

    const rows = filteredDispatches.map(d => [
      d.dc_no,
      d.date,
      d.vehicle_no,
      d.supplier_name,
      d.total_pallets,
      d.total_parts,
      `"${(d.address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(d.particular || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      d.scanning_by || '',
      d.verify_by || '',
      d.transaction_type || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `completed_dispatches_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        fetchDispatches(searchQuery, true);
      }
    });

    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore, searchQuery, fetchDispatches]);

  const handleViewDetails = async (id: number) => {
    try {
      const data = await databaseService.getDispatch(id);
      if (data) {
        setSelectedDispatch(data);
        setDetailModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConfirm = (id: number) => {
    const targetDisp = dispatches.find((d) => d.id === id);
    if (targetDisp?.status === 'completed') {
      setMessage({ text: 'Dispatched & Completed Delivery Challans cannot be deleted.', type: 'error' });
      setTimeout(() => setMessage(null), 3500);
      return;
    }
    setDeleteId(id);
    setDeleteModalOpen(true);
  };

  const handleCopyModalPullLists = async () => {
    if (!selectedDispatch || !selectedDispatch.items || selectedDispatch.items.length === 0) {
      setMessage({ text: 'No pull lists available to copy.', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    const success = await copyDispatchPullListsToClipboard(selectedDispatch, selectedDispatch.items);
    if (success) {
      setCopiedModal(true);
      setTimeout(() => setCopiedModal(false), 2500);
      setMessage({
        text: `Copied ${selectedDispatch.items.length} pull lists for DC ${selectedDispatch.dc_no} to clipboard in email format!`,
        type: 'success'
      });
      setTimeout(() => setMessage(null), 3500);
    } else {
      setMessage({ text: 'Failed to copy to clipboard.', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleQuickCopyRow = async (dispatch: Dispatch) => {
    try {
      if (!dispatch.id) return;
      const fullDisp = await databaseService.getDispatch(dispatch.id);
      const items = fullDisp?.items || [];
      if (items.length === 0) {
        setMessage({ text: `No pull lists found for ${dispatch.dc_no}.`, type: 'error' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
      const success = await copyDispatchPullListsToClipboard(fullDisp || dispatch, items);
      if (success) {
        setCopiedRowId(dispatch.id);
        setTimeout(() => setCopiedRowId(null), 2500);
        setMessage({
          text: `Copied ${items.length} pull lists for DC ${dispatch.dc_no} to clipboard in email format!`,
          type: 'success'
        });
        setTimeout(() => setMessage(null), 3500);
      }
    } catch (err) {
      console.error('Quick copy row failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const success = await databaseService.deleteDispatch(deleteId);
      if (success) {
        setMessage({ text: 'Dispatch deleted successfully.', type: 'success' });
        fetchDispatches(searchQuery);
        setDeleteModalOpen(false);
        setDeleteId(null);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: 'Cannot delete: Dispatched delivery challans are permanently locked for compliance.', type: 'error' });
        setDeleteModalOpen(false);
        setDeleteId(null);
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message || err}`, type: 'error' });
    }
  };

  const handleReprintChallan = async (disp: Dispatch, items: DispatchItem[]) => {
    try {
      await printService.printChallan(disp, items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReprintBarcodes = async (items: DispatchItem[]) => {
    try {
      await printService.printBarcodes(items, selectedDispatch || undefined);
    } catch (err) {
      console.error(err);
    }
  };



  return (
    <div className="space-y-6">
      {/* Header, Search, and Filters */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-md font-bold text-slate-800 uppercase tracking-wide">Completed Dispatches</h3>
            <p className="text-xs text-slate-400">Search, view, and export finalized delivery invoices</p>
          </div>
          <div className="flex items-center gap-3">
            <SearchBox
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search by DC, Pull List..."
            />
            <button
              onClick={handleExportCSV}
              disabled={filteredDispatches.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 shrink-0"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filters Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Date Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Filter by Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:bg-white text-slate-700 font-medium"
            />
          </div>

          {/* Vehicle Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Filter by Vehicle No</label>
            <input
              type="text"
              placeholder="e.g. MH-12..."
              list="vehicles-archive-datalist"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:bg-white uppercase font-bold text-slate-700"
            />
            <datalist id="vehicles-archive-datalist">
              {(settings?.vehiclesList || []).map((opt, i) => (
                <option key={i} value={opt} />
              ))}
            </datalist>
          </div>

          {/* Supervisor Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Filter by Supervisor</label>
            <select
              value={supervisorFilter}
              onChange={(e) => setSupervisorFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:bg-white cursor-pointer text-slate-700 font-medium"
            >
              <option value="">-- All Supervisors --</option>
              {(settings?.suppliersList || []).map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Dispatches List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading && filteredDispatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              Loading dispatches...
            </div>
          ) : filteredDispatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              No matching completed dispatches found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">DC Number</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Destination Address</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Supervisor</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-36">Total Pull Lists</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">Total Parts</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-800">
                      {d.dc_no}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 max-w-[220px]">
                      <div
                        className="font-bold text-slate-800 line-clamp-1 truncate flex items-center gap-1.5"
                        title={d.address || 'No destination address specified'}
                      >
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{d.address ? d.address.split('\n')[0] : '-'}</span>
                      </div>
                      {d.address && d.address.includes('\n') && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5" title={d.address}>
                          {d.address.split('\n').slice(1).join(' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>{formatDateTimeDisplay(d.date)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-bold uppercase">
                      {d.vehicle_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {d.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-800 text-right font-medium">
                      {d.total_pallets}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-800 text-right font-bold">
                      {d.total_parts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        {/* View Action */}
                        <button
                          onClick={() => d.id && handleViewDetails(d.id)}
                          title="View items"
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 transition-colors duration-150 cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                        {/* Quick Copy for Mail Action */}
                        <button
                          onClick={() => d.id && handleQuickCopyRow(d)}
                          title="Copy pull lists for email (with DC Number)"
                          className={`p-1 rounded transition-colors duration-150 cursor-pointer ${
                            copiedRowId === d.id
                              ? 'text-emerald-600 bg-emerald-50'
                              : 'text-blue-600 hover:bg-blue-50 hover:text-blue-800'
                          }`}
                        >
                          {copiedRowId === d.id ? <Check size={15} className="stroke-[3]" /> : <Copy size={15} />}
                        </button>
                        {/* Print Challan Action */}
                        <button
                          onClick={async () => {
                            if (!d.id) return;
                            try {
                              const fullDisp = await databaseService.getDispatch(d.id);
                              if (fullDisp) {
                                await handleReprintChallan(fullDisp, fullDisp.items || []);
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          title="Print Challan PDF"
                          className="p-1 rounded text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors duration-150 cursor-pointer"
                        >
                          <Printer size={15} />
                        </button>
                        {/* Delete Action - Only allowed for non-completed drafts */}
                        {d.status !== 'completed' && (
                          <button
                            onClick={() => d.id && handleDeleteConfirm(d.id)}
                            title="Delete dispatch"
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-800 transition-colors duration-150 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {hasMore && dispatches.length > 0 && (
        <div ref={lastElementRef} className="flex justify-center py-6 text-xs text-slate-400 font-bold uppercase tracking-wider">
          {loadingMore ? 'Loading more dispatches...' : 'Scroll down to load more'}
        </div>
      )}

      {/* Details View Modal */}
      {selectedDispatch && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`Dispatch details: ${selectedDispatch.dc_no}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 select-none">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Date</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.date}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                  selectedDispatch.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : selectedDispatch.status === 'ready'
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {selectedDispatch.status === 'completed' ? 'Completed' : selectedDispatch.status === 'ready' ? 'Ready' : 'Loading'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Vehicle Number</span>
                <span className="font-semibold text-slate-700 uppercase">{selectedDispatch.vehicle_no}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Supervisor Name</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.supplier_name}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Pallets Count</span>
                <span className="font-semibold text-slate-700 font-mono text-xs">{selectedDispatch.total_pallets}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Destination Address</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.address}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Created By</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.created_by}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Total Parts</span>
                <span className="font-semibold text-slate-700 font-mono text-xs">{selectedDispatch.total_parts}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Particular</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.particular || 'AS PER LIST'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Scanning By</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.scanning_by || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Verify By</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.verify_by || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Transaction</span>
                <span className="font-semibold text-slate-700">{selectedDispatch.transaction_type || '-'}</span>
              </div>
            </div>

            {/* List Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Pull Lists Loaded ({selectedDispatch.items?.length || 0})
                </span>
                <button
                  type="button"
                  onClick={handleCopyModalPullLists}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer shadow-2xs flex items-center justify-center ${
                    copiedModal
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                  }`}
                  title={copiedModal ? "Copied for Mail!" : "Copy for Mail"}
                  aria-label="Copy for Mail"
                >
                  {copiedModal ? <Check size={15} className="text-emerald-600 stroke-[3]" /> : <Copy size={15} />}
                </button>
              </div>
              <DispatchTable items={selectedDispatch.items} readOnly={true} />
            </div>

            {/* Modal Controls */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => handleReprintBarcodes(selectedDispatch.items)}
                className="flex items-center gap-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Printer size={14} />
                <span>Reprint Barcodes</span>
              </button>
              <button
                onClick={() => handleReprintChallan(selectedDispatch, selectedDispatch.items)}
                className="flex items-center gap-1 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Printer size={14} />
                <span>Reprint Challan PDF</span>
              </button>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Shipment Deletion"
      >
        <div className="space-y-4 select-none">
          <div className="flex items-start gap-3 bg-rose-50 p-4 rounded-xl border border-rose-100 text-rose-900 text-xs font-medium leading-relaxed">
            <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Warning: Deletion is permanent</p>
              <p>Are you sure you want to delete this dispatch? This will completely erase the Delivery Challan record and cascade delete all associated dispatch items from the database.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

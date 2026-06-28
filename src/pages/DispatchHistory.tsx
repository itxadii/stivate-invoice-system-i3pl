import React, { useState, useEffect, useRef, useCallback } from 'react';
import { databaseService, printService } from '../services/ipc';
import type { Dispatch, DispatchItem } from '../types';
import { SearchBox } from '../components/SearchBox';
import { Modal } from '../components/Modal';
import { DispatchTable } from '../components/DispatchTable';
import { Printer, Eye, Edit3, Trash2, Calendar, AlertTriangle, Plus } from 'lucide-react';

interface DispatchHistoryProps {
  onEditDispatch: (id: number) => void;
}

export const DispatchHistory: React.FC<DispatchHistoryProps> = ({ onEditDispatch }) => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Detail Modal State
  const [selectedDispatch, setSelectedDispatch] = useState<(Dispatch & { items: DispatchItem[] }) | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Quick Add Subject Modal State
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [subjectTargetId, setSubjectTargetId] = useState<number | null>(null);
  const [subjectText, setSubjectText] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const handleAddSubjectClick = (id: number) => {
    setSubjectTargetId(id);
    setSubjectText('');
    setSubjectError(null);
    setSubjectModalOpen(true);
  };

  const handleAddSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = subjectText.trim();
    if (!query || !subjectTargetId) return;

    let cleanText = query.replace(/\s+/g, ' ').trim();
    cleanText = cleanText.replace(/^(FW:|FWD:|RE:)\s*/i, '').trim();

    const parts = cleanText.split(' ');

    if (parts.length >= 4) {
      const idNumber = parts[0];
      const pullListNo = parts[1];
      const kitType = parts[2];
      const workcell = parts[3];
      const numParts = parts[4] ? (parseInt(parts[4], 10) || 1) : 1;

      if (/^\d+$/.test(idNumber) && /^[A-Z0-9_-]+$/i.test(pullListNo)) {
        try {
          const data = await databaseService.getDispatch(subjectTargetId);
          if (!data) {
            setSubjectError('Dispatch not found.');
            return;
          }

          if (data.items.some((item: any) => item.pull_list_no.toLowerCase() === pullListNo.toLowerCase())) {
            setSubjectError(`Pull List ${pullListNo} already exists in this dispatch.`);
            return;
          }

          const newItem: DispatchItem = {
            pull_list_no: pullListNo,
            id_number: idNumber,
            kit_type: kitType,
            workcell: workcell,
            parts: numParts
          };

          const updatedItems = [...data.items, newItem];
          const updatedDispatch = {
            ...data,
            total_parts: data.total_parts + numParts
          };

          await databaseService.saveDispatch(updatedDispatch, updatedItems);
          
          try {
            databaseService.importMasterData([newItem]);
          } catch (err) {}

          setMessage({ text: `Successfully added ${pullListNo} to dispatch ${data.dc_no}.`, type: 'success' });
          setSubjectModalOpen(false);
          fetchDispatches(searchQuery);
          setTimeout(() => setMessage(null), 4000);
        } catch (err: any) {
          setSubjectError(`Failed to save: ${err.message || err}`);
        }
        return;
      }
    } else if (parts.length === 1 && /^[A-Z0-9_-]+$/i.test(cleanText)) {
      const pullListNo = cleanText;
      try {
        const data = await databaseService.getDispatch(subjectTargetId);
        if (!data) {
          setSubjectError('Dispatch not found.');
          return;
        }

        if (data.items.some((item: any) => item.pull_list_no.toLowerCase() === pullListNo.toLowerCase())) {
          setSubjectError(`Pull List ${pullListNo} already exists in this dispatch.`);
          return;
        }

        const masterItem = await databaseService.searchPullList(pullListNo);
        if (masterItem) {
          const newItem: DispatchItem = {
            pull_list_no: masterItem.pull_list_no,
            id_number: masterItem.id_number || '',
            kit_type: masterItem.kit_type || '',
            workcell: masterItem.workcell || '',
            parts: masterItem.parts || 1
          };

          const updatedItems = [...data.items, newItem];
          const updatedDispatch = {
            ...data,
            total_parts: data.total_parts + (masterItem.parts || 1)
          };

          await databaseService.saveDispatch(updatedDispatch, updatedItems);

          setMessage({ text: `Successfully added ${pullListNo} to dispatch ${data.dc_no}.`, type: 'success' });
          setSubjectModalOpen(false);
          fetchDispatches(searchQuery);
          setTimeout(() => setMessage(null), 4000);
        } else {
          setSubjectError(`Pull List ${pullListNo} not found in database. Add new items on the New Dispatch screen first to cache them.`);
        }
      } catch (err: any) {
        setSubjectError(`Failed to save: ${err.message || err}`);
      }
      return;
    }

    setSubjectError('Invalid format. Expected: "[ID] [PULL_LIST] [KIT_TYPE] [WORKCELL] [PARTS]" or a valid single Pull List Number.');
  };

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
        data = await databaseService.searchDispatches(query, limit, offset);
      } else {
        data = await databaseService.getAllDispatches(limit, offset);
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
      console.error('Failed to load dispatch history:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDispatches();
  }, []);

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    fetchDispatches(val, false);
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
    setDeleteId(id);
    setDeleteModalOpen(true);
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
        setMessage({ text: 'Failed to delete dispatch.', type: 'error' });
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
      await printService.printBarcodes(items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkCompleted = async (dispatchEntry: Dispatch) => {
    if (!dispatchEntry.id || dispatchEntry.status === 'completed') return;

    try {
      const fullDispatch = await databaseService.getDispatch(dispatchEntry.id);
      if (fullDispatch) {
        await databaseService.saveDispatch({ ...fullDispatch, status: 'completed' }, fullDispatch.items || []);
        setMessage({ text: `Dispatch ${dispatchEntry.dc_no} marked as completed.`, type: 'success' });
        fetchDispatches(searchQuery);
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      setMessage({ text: `Failed to update status: ${err.message || err}`, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-md font-bold text-slate-800 uppercase tracking-wide">Shipment Archive</h3>
          <p className="text-xs text-slate-400">Search and manage delivery invoices</p>
        </div>
        <SearchBox
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Filter by DC, Pull List, Vehicle, Date, Supervisor..."
        />
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
          {loading && dispatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              Loading dispatches...
            </div>
          ) : dispatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              No matching dispatches found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">DC Number</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Supervisor</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Pallets</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">Total Parts</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-800">
                      {d.dc_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{d.date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          d.status === 'draft'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {d.status === 'draft' ? 'Draft' : 'Completed'}
                        </span>
                        {d.status === 'draft' && (
                          <button
                            onClick={() => d.id && handleMarkCompleted(d)}
                            className="px-2 py-1 text-[11px] font-bold rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
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
                        <button
                          onClick={() => d.id && handleViewDetails(d.id)}
                          title="View items"
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 transition-colors duration-150 cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => d.id && handleAddSubjectClick(d.id)}
                          title="Quick Add Subject"
                          className="p-1 rounded text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition-colors duration-150 cursor-pointer"
                        >
                          <Plus size={15} />
                        </button>
                        <button
                          onClick={() => d.id && onEditDispatch(d.id)}
                          title="Edit dispatch"
                          className="p-1 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 cursor-pointer"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => d.id && handleDeleteConfirm(d.id)}
                          title="Delete dispatch"
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-800 transition-colors duration-150 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
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
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                  selectedDispatch.status === 'draft'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {selectedDispatch.status === 'draft' ? 'Draft' : 'Completed'}
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
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Pull Lists Loaded</span>
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

      {/* Quick Add Subject Modal */}
      <Modal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title="Quick Add Pull List via Email Subject"
      >
        <form onSubmit={handleAddSubjectSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Paste Email Subject Line</label>
            <input
              type="text"
              placeholder="e.g. FW: 369118 M5444529010030B0 BoxBuild B26-MELLANOX 1"
              value={subjectText}
              onChange={(e) => setSubjectText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-[#4BB8FA] focus:bg-white transition-colors"
              required
            />
            {subjectError && (
              <p className="text-xs text-rose-600 font-bold">{subjectError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSubjectModalOpen(false)}
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

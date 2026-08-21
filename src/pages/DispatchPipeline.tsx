import React, { useEffect, useState, useCallback } from 'react';
import { databaseService, settingsService } from '../services/ipc';
import type { Dispatch, PipelineStats } from '../types';
import { Play, CheckCircle, Clock, ClipboardList, Eye, ArrowRight, Hourglass, Search, X, Plus, User } from 'lucide-react';
import { Modal } from '../components/Modal';

interface DispatchPipelineProps {
  onEditDispatch: (id: number) => void;
  triggerNewDispatch?: boolean;
  onNewDispatchTriggered?: () => void;
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

export const DispatchPipeline: React.FC<DispatchPipelineProps> = ({
  onEditDispatch,
  triggerNewDispatch = false,
  onNewDispatchTriggered
}) => {
  const [stats, setStats] = useState<PipelineStats>({
    loadingCount: 0,
    readyCount: 0,
    completedTodayCount: 0,
    pendingPullLists: 0,
    totalPullListsToday: 0
  });
  const [activeDispatches, setActiveDispatches] = useState<(Dispatch & { loadedCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'loading' | 'ready'>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');

  // New Dispatch Popup Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newDispatch, setNewDispatch] = useState({
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
    status: 'loading' as const,
  });

  const fetchPipelineData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch stats
      const pipelineStats = await databaseService.getPipelineStats();
      setStats(pipelineStats);

      // 2. Fetch active dispatches (loading + ready)
      const data = await databaseService.getAllDispatches(['loading', 'ready']);
      
      // Calculate loaded items count for progress column
      const dispatchesWithCount = await Promise.all(
        data.map(async (d) => {
          if (!d.id) return { ...d, loadedCount: 0 };
          const fullDispatch = await databaseService.getDispatch(d.id);
          return {
            ...d,
            loadedCount: (fullDispatch?.items || []).filter((item: any) => !item.pull_list_no.endsWith('_pending')).length
          };
        })
      );
      
      setActiveDispatches(dispatchesWithCount);
    } catch (err) {
      console.error('Failed to load pipeline data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelineData();
  }, [fetchPipelineData]);

  // Load Settings
  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        const loaded = await settingsService.load();
        setSettings(loaded);
      } catch (e) {
        console.error('Failed to load settings in pipeline:', e);
      }
    };
    loadSettingsData();
  }, []);

  // Handle Ctrl+N trigger from App.tsx
  useEffect(() => {
    if (triggerNewDispatch) {
      handleOpenNewModal();
      if (onNewDispatchTriggered) onNewDispatchTriggered();
    }
  }, [triggerNewDispatch, settings]);

  const handleOpenNewModal = () => {
    const dateStr = getNowDateTimeString();
    setNewDispatch({
      dc_no: '',
      date: dateStr,
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
      status: 'loading' as const,
    });
    setFormError(null);
    setIsNewModalOpen(true);
  };

  const handleNewDispatchChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewDispatch((prev) => ({
      ...prev,
      [name]: name === 'total_pallets' ? Number(value) : value
    }));
  };

  const handleNewDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDispatch.vehicle_no.trim() || !newDispatch.supplier_name.trim()) {
      setFormError('Vehicle Number and Customer/Supervisor Name are required.');
      return;
    }

    try {
      const dispatchData = { ...newDispatch, dc_no: '' };
      const res = await databaseService.saveDispatch(dispatchData, []);
      if (res && res.id) {
        setIsNewModalOpen(false);
        await fetchPipelineData();
        onEditDispatch(res.id);
      } else {
        setFormError('Failed to create dispatch. Ensure database connection is stable.');
      }
    } catch (err: any) {
      console.error(err);
      setFormError(`Creation failed: ${err.message || err}`);
    }
  };

  const cards = [
    {
      title: 'Loading Trucks',
      value: stats.loadingCount,
      desc: 'Active loading dispatches',
      icon: Hourglass,
      textColor: 'text-amber-600 bg-amber-50 border-amber-100'
    },
    {
      title: 'Ready Trucks',
      value: stats.readyCount,
      desc: 'Waiting for departure confirmation',
      icon: Play,
      textColor: 'text-indigo-600 bg-indigo-50 border-indigo-100'
    },
    {
      title: 'Completed Today',
      value: stats.completedTodayCount,
      desc: 'Dispatched trucks today',
      icon: CheckCircle,
      textColor: 'text-emerald-600 bg-emerald-50 border-emerald-100'
    },
    {
      title: 'Pending Pull Lists',
      value: stats.pendingPullLists,
      desc: 'Remaining to be loaded',
      icon: ClipboardList,
      textColor: 'text-rose-600 bg-rose-50 border-rose-100'
    },
    {
      title: 'Total Pull Lists Today',
      value: stats.totalPullListsToday,
      desc: 'Expected load volume today',
      icon: Clock,
      textColor: 'text-blue-600 bg-blue-50 border-blue-100'
    }
  ];

  const supervisorList = Array.from(
    new Set([
      ...(settings?.suppliersList || []),
      ...activeDispatches.map((d) => d.supplier_name).filter(Boolean),
    ])
  );

  const filteredDispatches = activeDispatches.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) {
      return false;
    }

    if (selectedSupervisor !== 'all' && (d.supplier_name || '').toLowerCase() !== selectedSupervisor.toLowerCase()) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchDc = (d.dc_no || '').toLowerCase().includes(q);
      const matchVehicle = (d.vehicle_no || '').toLowerCase().includes(q);
      const matchSupervisor = (d.supplier_name || '').toLowerCase().includes(q);
      const matchAddress = (d.address || '').toLowerCase().includes(q);
      const matchParticular = (d.particular || '').toLowerCase().includes(q);

      return matchDc || matchVehicle || matchSupervisor || matchAddress || matchParticular;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{c.title}</span>
                <h3 className="text-2xl font-extrabold text-slate-800">{c.value}</h3>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-slate-500 max-w-[70%] leading-tight">{c.desc}</p>
                <div className={`p-2 rounded-lg border ${c.textColor}`}>
                  <Icon size={16} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Pipeline Table with Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Header & Controls Bar */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-md font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <span>Active Dispatch Pipeline</span>
                <span className="text-xs px-2.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-100">
                  {filteredDispatches.length} {filteredDispatches.length === 1 ? 'Dispatch' : 'Dispatches'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Manage, edit, scan, and print loading or ready shipments</p>
            </div>

            <button
              onClick={handleOpenNewModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              <Plus size={15} />
              <span>Create New Dispatch</span>
            </button>
          </div>

          {/* Search, Supervisor & Status Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* Search Input Box */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Vehicle No, DC No, Supervisor Name, Address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#4BB8FA] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Supervisor Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <User size={14} className="text-slate-400" />
                <select
                  value={selectedSupervisor}
                  onChange={(e) => setSelectedSupervisor(e.target.value)}
                  className="bg-transparent border-none text-xs focus:outline-none text-slate-700 font-bold cursor-pointer"
                >
                  <option value="all">All Supervisors</option>
                  {supervisorList.map((sup, idx) => (
                    <option key={idx} value={sup}>{sup}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
                {(['all', 'loading', 'ready'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all capitalize cursor-pointer ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {st === 'all' ? 'All Status' : st}
                  </button>
                ))}
              </div>

              {(searchQuery || statusFilter !== 'all' || selectedSupervisor !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setSelectedSupervisor('all');
                  }}
                  className="text-xs text-rose-600 font-bold hover:underline px-2 py-1 cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading && activeDispatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              Loading active pipeline...
            </div>
          ) : activeDispatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              No active shipments in pipeline. Create a new dispatch to begin loading.
            </div>
          ) : filteredDispatches.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-slate-500 font-medium">
                No active dispatches match your search query "{searchQuery}".
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Clear all search filters
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">DC Number</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Supervisor</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pull List Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDispatches.map((d) => {
                  const loaded = d.loadedCount;
                  const expected = Math.max(d.total_pallets || 1, loaded);
                  const progressPct = Math.min(100, Math.round((loaded / expected) * 100));

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-800">
                        {d.dc_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-bold uppercase">
                        {d.vehicle_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {d.supplier_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {formatDateTimeDisplay(d.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-semibold w-64">
                        <div className="space-y-1.5 max-w-[200px]">
                          <div className="flex justify-between text-xs font-mono">
                            <span>{loaded} / {expected}</span>
                            <span className="font-bold text-slate-500">{progressPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className="bg-[#4BB8FA] h-full rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          d.status === 'ready'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {d.status === 'ready' ? 'Ready' : 'Loading'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button
                          onClick={() => d.id && onEditDispatch(d.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>Open</span>
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create New Dispatch Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Create New Dispatch Truck"
      >
        <form onSubmit={handleNewDispatchSubmit} className="space-y-4 select-none">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">DC Number</label>
              <input
                type="text"
                name="dc_no"
                value="(Auto-Generated)"
                disabled
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 font-mono font-bold text-slate-400 select-none cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Vehicle Number</label>
              <input
                type="text"
                name="vehicle_no"
                placeholder="e.g. MH-12-QW-1234"
                list="pipeline-vehicles-datalist"
                value={newDispatch.vehicle_no}
                onChange={handleNewDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white uppercase font-bold text-slate-700"
              />
              <datalist id="pipeline-vehicles-datalist">
                {(settings?.vehiclesList || []).map((opt: string, i: number) => (
                  <option key={i} value={opt} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Supervisor / Customer</label>
              <select
                name="supplier_name"
                value={newDispatch.supplier_name}
                onChange={handleNewDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white text-slate-700 cursor-pointer font-medium"
              >
                <option value="">-- Select Customer --</option>
                {(settings?.suppliersList || []).map((opt: string, i: number) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Total Pallets Count</label>
              <input
                type="number"
                name="total_pallets"
                value={newDispatch.total_pallets}
                onChange={handleNewDispatchChange}
                min={1}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white font-mono font-bold text-slate-700"
              />
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Consignee Address</label>
              <select
                name="address"
                value={newDispatch.address}
                onChange={handleNewDispatchChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white text-slate-700 cursor-pointer font-medium"
              >
                <option value="">-- Select Consignee Address --</option>
                {(settings?.addressesList || []).map((opt: string, i: number) => (
                  <option key={i} value={opt}>{opt.split('\n')[0]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Scanning By</label>
              <select
                name="scanning_by"
                value={newDispatch.scanning_by}
                onChange={handleNewDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white text-slate-700 cursor-pointer font-medium"
              >
                <option value="">-- Select Scanner --</option>
                {(settings?.scannersList || []).map((opt: string, i: number) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Verify By</label>
              <select
                name="verify_by"
                value={newDispatch.verify_by}
                onChange={handleNewDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white text-slate-700 cursor-pointer font-medium"
              >
                <option value="">-- Select Verifier --</option>
                {(settings?.verifiersList || []).map((opt: string, i: number) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Transaction Type</label>
              <input
                type="text"
                name="transaction_type"
                value={newDispatch.transaction_type}
                onChange={handleNewDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white text-slate-700 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Particular</label>
              <input
                type="text"
                name="particular"
                value={newDispatch.particular}
                onChange={handleNewDispatchChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:bg-white text-slate-700 font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-xs font-bold cursor-pointer"
            >
              Create Dispatch
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

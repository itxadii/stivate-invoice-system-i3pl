import React, { useEffect, useState } from 'react';
import { databaseService } from '../services/ipc';
import type { DashboardStats } from '../types';
import { getVehicleMaxPallets } from '../types';
import { ArrowRight, Truck, FileText, LayoutGrid, Search, Filter, Eye, X } from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onEditDispatch: (id: number) => void;
}

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

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, onEditDispatch }) => {
  const [stats, setStats] = useState<DashboardStats>({
    todayDispatches: 0,
    totalDispatches: 0,
    totalPullLists: 0,
    recentDispatches: [],
    trendData: [],
    supervisorShare: []
  });
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<{ date: string; count: number }[]>([]);
  const [trendRange, setTrendRange] = useState<'7days' | 'thisMonth' | '6months' | 'years'>('7days');
  const [trendLoading, setTrendLoading] = useState(false);
  const [selectedTruckNumber, setSelectedTruckNumber] = useState<string>('all');
  const [truckSearchQuery, setTruckSearchQuery] = useState<string>('');

  const fetchStats = async () => {
    try {
      const data = await databaseService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async (range: string) => {
    setTrendLoading(true);
    try {
      const data = await databaseService.getTrendData(range);
      setTrendData(data);
    } catch (err) {
      console.error('Failed to fetch trend data:', err);
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!loading && stats.trendData) {
      setTrendData(stats.trendData);
    }
  }, [loading, stats.trendData]);

  useEffect(() => {
    if (!loading) {
      fetchTrendData(trendRange);
    }
  }, [trendRange]);

  let fleetLoadedPallets = 0;
  let fleetMaxPallets = 0;
  stats.recentDispatches.forEach((d: any) => {
    const vSize = d.vehicle_size || '32 ft';
    const maxP = getVehicleMaxPallets(vSize);
    const curP = d.total_pallets || 1;
    fleetLoadedPallets += curP;
    fleetMaxPallets += maxP;
  });
  const fleetUtilizationPct = fleetMaxPallets > 0 ? Math.round((fleetLoadedPallets / fleetMaxPallets) * 100) : 0;

  const cards = [
    {
      title: "Today's Dispatches",
      value: stats.todayDispatches,
      desc: "Created since 12:00 AM",
      icon: Truck,
      color: "from-blue-500 to-indigo-600",
      textColor: "text-blue-600 bg-blue-50"
    },
    {
      title: "Total Dispatches",
      value: stats.totalDispatches,
      desc: "All recorded dispatches",
      icon: FileText,
      color: "from-emerald-500 to-teal-600",
      textColor: "text-emerald-600 bg-emerald-50"
    },
    {
      title: "Fleet Truck Utilization",
      value: `${fleetUtilizationPct}%`,
      desc: `${fleetLoadedPallets}/${fleetMaxPallets} Pallets Loaded`,
      icon: Truck,
      color: "from-amber-500 to-orange-600",
      textColor: "text-amber-600 bg-amber-50"
    },
    {
      title: "Master Pull Lists",
      value: stats.totalPullLists,
      desc: "Imported SAP records",
      icon: LayoutGrid,
      color: "from-teal-500 to-emerald-600",
      textColor: "text-teal-600 bg-teal-50"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="space-y-1.5 sm:space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.title}</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800">{c.value}</h3>
                <p className="text-xs text-slate-500 font-medium">{c.desc}</p>
              </div>
              <div className={`p-3 sm:p-4 rounded-xl ${c.textColor} font-bold shrink-0`}>
                <Icon size={22} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Stack */}
      <div className="space-y-6">
        {/* Trend Line Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-50 pb-3">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Dispatches Trend Analytics</h4>
            <select
              value={trendRange}
              onChange={(e) => setTrendRange(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="7days">Last 7 Active Days</option>
              <option value="thisMonth">This Month</option>
              <option value="6months">Last 6 Months</option>
              <option value="years">Yearly Trend</option>
            </select>
          </div>
          {trendLoading ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium">
              Loading trend analytics...
            </div>
          ) : trendData && trendData.length > 0 ? (
            <div className="pt-2">
              {(() => {
                const counts = trendData.map(d => d.count);
                const absoluteMin = Math.min(...counts);
                const absoluteMax = Math.max(...counts);

                // Calculate Y bounds with padding
                let minVal = absoluteMin;
                let maxVal = absoluteMax;
                const diff = maxVal - minVal;

                if (diff === 0) {
                  minVal = Math.max(0, absoluteMin - 10);
                  maxVal = absoluteMax + 10;
                } else {
                  const pad = diff * 0.15;
                  minVal = Math.max(0, Math.floor(absoluteMin - pad));
                  maxVal = Math.ceil(absoluteMax + pad);
                }

                const width = 800;
                const height = 260;
                const paddingX = 60;
                const paddingY = 30;
                
                const points = trendData.map((d, index) => {
                  const x = paddingX + (index * (width - paddingX * 2)) / Math.max(trendData.length - 1, 1);
                  const y = height - paddingY - ((d.count - minVal) / (maxVal - minVal || 1)) * (height - paddingY * 2);
                  return { x, y, ...d };
                });

                const getSmoothWavyPath = (pts: { x: number; y: number }[]) => {
                  if (pts.length === 0) return '';
                  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
                  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

                  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
                  const tension = 0.2;

                  for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[i === 0 ? i : i - 1];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

                    const cp1x = p1.x + (p2.x - p0.x) * tension;
                    const cp1y = p1.y + (p2.y - p0.y) * tension;
                    const cp2x = p2.x - (p3.x - p1.x) * tension;
                    const cp2y = p2.y - (p3.y - p1.y) * tension;

                    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
                  }

                  return path;
                };

                const pathD = getSmoothWavyPath(points);
                  
                const areaD = points.length > 0
                  ? `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
                  : '';

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.18"/>
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0"/>
                      </linearGradient>
                    </defs>

                    {/* Y-Axis Value Labels next to Grid Lines */}
                    <text x={paddingX - 12} y={paddingY + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400 font-mono">{maxVal}</text>
                    <text x={paddingX - 12} y={(height - paddingY * 2) / 2 + paddingY + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400 font-mono">{Math.round((maxVal + minVal) / 2)}</text>
                    <text x={paddingX - 12} y={height - paddingY + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400 font-mono">{minVal}</text>
                    
                    {/* Grid Lines */}
                    <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1={paddingX} y1={(height - paddingY * 2) / 2 + paddingY} x2={width - paddingX} y2={(height - paddingY * 2) / 2 + paddingY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="1.5" />
                    
                    {areaD && <path d={areaD} fill="url(#lineGrad)" />}
                    {pathD && <path d={pathD} fill="none" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
                    
                    {points.map((p, idx) => {
                      const label = p.date.length > 7 && p.date.includes('-') ? p.date.substring(5) : p.date;
                      
                      // Spacing: hide date labels if there are many days to avoid overlapping
                      const showDate = trendData.length <= 10 || idx % Math.ceil(trendData.length / 8) === 0 || idx === trendData.length - 1;
                      const showVal = trendData.length <= 10;

                      return (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r={trendData.length > 15 ? "3.5" : "5"} fill="#ffffff" stroke="#059669" strokeWidth={trendData.length > 15 ? "2" : "2.5"} />
                          
                          {/* Value above the dot */}
                          {showVal && (
                            <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[11px] font-extrabold fill-slate-700 font-mono">{p.count}</text>
                          )}
                          
                          {/* X-axis date labels */}
                          {showDate && (
                            <g>
                              <line x1={p.x} y1={height - paddingY} x2={p.x} y2={height - paddingY + 4} stroke="#cbd5e1" strokeWidth="1" />
                              <text x={p.x} y={height - 10} textAnchor="middle" className="text-[10px] font-bold fill-slate-400">
                                {label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-bold uppercase">
              No trend data available
            </div>
          )}
        </div>

        {/* Supervisor Share Donut Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-3">Supervisor Shares (Top 5 Distribution)</h4>
          {stats.supervisorShare && stats.supervisorShare.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-4">
              {(() => {
                const total = stats.supervisorShare.reduce((acc, curr) => acc + curr.count, 0) || 1;
                let accumulatedAngle = 0;
                const colors = ['#059669', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
                
                const slices = stats.supervisorShare.map((s, idx) => {
                  const percentage = s.count / total;
                  const angle = percentage * 360;
                  const radius = 55;
                  const circumference = 2 * Math.PI * radius;
                  const strokeLength = percentage * circumference;
                  const strokeOffset = circumference - (accumulatedAngle / 360) * circumference;
                  accumulatedAngle += angle;
                  return {
                    ...s,
                    percentage: Math.round(percentage * 100),
                    strokeLength,
                    strokeOffset,
                    color: colors[idx % colors.length]
                  };
                });

                return (
                  <>
                    <div className="flex justify-center">
                      <svg viewBox="0 0 200 200" className="w-56 h-56">
                        <circle cx="100" cy="100" r="55" fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                        {slices.map((slice, idx) => (
                          <circle
                            key={idx}
                            cx="100"
                            cy="100"
                            r="55"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="18"
                            strokeDasharray={`${slice.strokeLength} ${2 * Math.PI * 55}`}
                            strokeDashoffset={slice.strokeOffset}
                            transform="rotate(-90 100 100)"
                            className="transition-all duration-300 hover:stroke-[20px] cursor-pointer"
                          />
                        ))}
                        <g>
                          <text x="100" y="96" textAnchor="middle" className="text-[10px] font-extrabold fill-slate-400 uppercase tracking-wider">TOTAL</text>
                          <text x="100" y="118" textAnchor="middle" className="text-[17px] font-black fill-slate-800 font-mono">{total}</text>
                        </g>
                      </svg>
                    </div>

                    <div className="flex flex-col gap-3.5 w-full max-w-md mx-auto">
                      {slices.map((slice, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }}></span>
                            <span className="font-bold text-slate-700 truncate uppercase">{slice.name || 'Unknown'}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-500 shrink-0 ml-4 text-xs">{slice.count} dispatches ({slice.percentage})%</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-bold uppercase">
              No supervisor share data available
            </div>
          )}
        </div>
      </div>

      {/* Truck Utilization & Fleet Capacity Breakdown */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        {/* Header Bar */}
        <div className="border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <span className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200/80">
                <Truck size={18} />
              </span>
              <span>Truck Capacity & Fleet Utilization Tracker</span>
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Monitor vehicle load capacities, search specific truck numbers, and review pallet assignments.
            </p>
          </div>
        </div>

        {/* Search, Filter & Quick Category Bar */}
        {(() => {
          const uniqueTrucks = Array.from(
            new Set(stats.recentDispatches.map((d: any) => (d.vehicle_no || '').trim().toUpperCase()).filter(Boolean))
          ).sort();

          const activeTruckQuery = selectedTruckNumber !== 'all' ? selectedTruckNumber : truckSearchQuery.trim().toUpperCase();

          const filteredTruckDispatches = stats.recentDispatches.filter((d: any) => {
            if (!activeTruckQuery) return true;
            return (d.vehicle_no || '').toUpperCase().includes(activeTruckQuery);
          });

          return (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Truck Number (e.g. MH-12-QW-1234)..."
                    value={truckSearchQuery}
                    onChange={(e) => {
                      setTruckSearchQuery(e.target.value);
                      if (e.target.value) setSelectedTruckNumber('all');
                    }}
                    className="w-full pl-10 pr-9 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#4BB8FA] focus:bg-white font-mono font-bold uppercase text-slate-800 placeholder-slate-400 transition-all"
                  />
                  {truckSearchQuery && (
                    <button
                      onClick={() => setTruckSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Dropdown */}
                <div className="flex items-center gap-2 shrink-0">
                  <Filter size={15} className="text-slate-400 shrink-0" />
                  <select
                    value={selectedTruckNumber}
                    onChange={(e) => {
                      setSelectedTruckNumber(e.target.value);
                      if (e.target.value !== 'all') setTruckSearchQuery('');
                    }}
                    className="px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#4BB8FA] text-slate-800 cursor-pointer uppercase font-sans transition-all"
                  >
                    <option value="all">All Vehicles ({uniqueTrucks.length} Active)</option>
                    {uniqueTrucks.map((truckNo, idx) => (
                      <option key={idx} value={truckNo}>{truckNo}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specific Truck Details Panel (If Search or Filter Active) */}
              {activeTruckQuery ? (
                (() => {
                  const targetTruckNo = filteredTruckDispatches[0]?.vehicle_no || activeTruckQuery;
                  const vSize = filteredTruckDispatches[0]?.vehicle_size || '32 ft';
                  const singleTruckCap = getVehicleMaxPallets(vSize);
                  const dcCount = filteredTruckDispatches.length;
                  const totalTruckPallets = filteredTruckDispatches.reduce((acc, d: any) => acc + (d.total_pallets || 1), 0);
                  const totalMaxCapacityForTruck = singleTruckCap * Math.max(1, dcCount);
                  const truckUtilPct = totalMaxCapacityForTruck > 0 ? Math.round((totalTruckPallets / totalMaxCapacityForTruck) * 100) : 0;
                  const isOver = totalTruckPallets > totalMaxCapacityForTruck;

                  return (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200/80 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-mono font-black uppercase tracking-wider flex items-center gap-2">
                            <Truck size={14} className="text-[#4BB8FA]" />
                            <span>Truck: {targetTruckNo}</span>
                          </span>
                          <span className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold">
                            Vehicle Size: {vSize} ({singleTruckCap} Pallets Capacity)
                          </span>
                        </div>

                        <span className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${
                          isOver
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : truckUtilPct >= 80
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {truckUtilPct}% Capacity Utilized ({totalTruckPallets} / {totalMaxCapacityForTruck} Pallets)
                        </span>
                      </div>

                      {/* Stat Tiles */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Dispatches</span>
                          <span className="text-lg font-extrabold font-mono text-slate-800">{dcCount} DCs</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Loaded Pallets</span>
                          <span className="text-lg font-extrabold font-mono text-slate-800">{totalTruckPallets} Pallets</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Max Truck Capacity</span>
                          <span className="text-lg font-extrabold font-mono text-slate-800">{singleTruckCap} Pallets</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capacity Load %</span>
                          <span className="text-lg font-extrabold font-mono text-emerald-700">{truckUtilPct}%</span>
                        </div>
                      </div>

                      {/* Dispatches Table under this Truck */}
                      {filteredTruckDispatches.length > 0 ? (
                        <div className="overflow-x-auto pt-1">
                          <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <thead className="bg-slate-100/80">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase font-mono">DC Number</th>
                                <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Date & Time</th>
                                <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Supervisor</th>
                                <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">Loaded Pallets</th>
                                <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">DC Load Ratio</th>
                                <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredTruckDispatches.map((d: any) => {
                                const pCount = d.total_pallets || 1;
                                const dcUtilPct = Math.round((pCount / singleTruckCap) * 100);
                                return (
                                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-mono font-bold text-slate-800 text-xs">{d.dc_no}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600 font-medium">{formatDateTimeDisplay(d.date)}</td>
                                    <td className="px-4 py-3 text-xs text-slate-700 font-bold uppercase">{d.supplier_name}</td>
                                    <td className="px-4 py-3 text-xs font-mono font-bold text-center text-slate-800">{pCount} Pallets</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2.5 py-1 text-xs font-extrabold rounded-md border ${
                                        dcUtilPct > 100 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}>
                                        {dcUtilPct}% of Truck
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        onClick={() => d.id && onEditDispatch(d.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                                      >
                                        <Eye size={13} />
                                        <span>Open</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  );
                })()
              ) : (
                /* Vehicle Size Breakdown Cards (Default view when no truck filter selected) */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    const sizeGroups: Record<string, { count: number; loaded: number; max: number }> = {};
                    stats.recentDispatches.forEach((d: any) => {
                      const sz = d.vehicle_size || '32 ft';
                      const maxP = getVehicleMaxPallets(sz);
                      const curP = d.total_pallets || 1;
                      if (!sizeGroups[sz]) {
                        sizeGroups[sz] = { count: 0, loaded: 0, max: 0 };
                      }
                      sizeGroups[sz].count += 1;
                      sizeGroups[sz].loaded += curP;
                      sizeGroups[sz].max += maxP;
                    });

                    const keys = Object.keys(sizeGroups);
                    if (keys.length === 0) {
                      return (
                        <div className="col-span-3 py-8 text-center text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
                          No active vehicle dispatch data available. Create a new dispatch to begin tracking.
                        </div>
                      );
                    }

                    return keys.map((sz, i) => {
                      const item = sizeGroups[sz];
                      const pct = item.max > 0 ? Math.round((item.loaded / item.max) * 100) : 0;
                      const isOver = item.loaded > item.max;
                      const singleCap = getVehicleMaxPallets(sz);

                      return (
                        <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 shadow-2xs hover:border-slate-300 transition-all">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Truck size={16} className="text-slate-600" />
                              <span className="font-extrabold text-slate-800 text-sm">{sz} Vehicles</span>
                            </div>
                            <span className="text-xs px-2.5 py-0.5 bg-white border border-slate-200 font-bold text-slate-600 rounded-full">
                              {item.count} {item.count === 1 ? 'Truck' : 'Trucks'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                              <span>Loaded Pallets</span>
                              <span className="font-mono font-bold text-slate-800">{item.loaded} / {item.max}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOver ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 border-t border-slate-200/60 font-medium">
                            <span>Capacity: {singleCap} Pallets/truck</span>
                            <span className={`font-bold px-2 py-0.5 rounded border ${
                              isOver
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : pct >= 80
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {pct}% Utilized
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Recent Dispatches */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Recent Dispatches</h4>
          <button
            onClick={() => setActiveTab('completed')}
            className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors duration-150 cursor-pointer"
          >
            <span>See All Dispatches</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              Loading recent dispatches...
            </div>
          ) : stats.recentDispatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              No dispatches created yet. Click "New Dispatch" to start!
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">DC Number</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Supervisor</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Total Parts</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {stats.recentDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-800">
                      {d.dc_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {formatDateTimeDisplay(d.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        d.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : d.status === 'ready'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {d.status === 'completed' ? 'Completed' : d.status === 'ready' ? 'Ready' : 'Loading'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      <div className="font-bold text-slate-800 uppercase">{d.vehicle_no}</div>
                      {(() => {
                        const vSize = (d as any).vehicle_size || '32 ft';
                        const maxP = getVehicleMaxPallets(vSize);
                        const curP = d.total_pallets || 1;
                        const utilPct = Math.round((curP / maxP) * 100);
                        return (
                          <div className="text-[10px] font-semibold text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{vSize}</span>
                            <span>{curP}/{maxP} ({utilPct}%)</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {d.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-800 text-right font-bold">
                      {d.total_parts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => d.id && onEditDispatch(d.id)}
                        className="text-emerald-600 hover:text-emerald-900 transition-colors duration-100 cursor-pointer font-bold"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { databaseService } from '../services/ipc';
import type { DashboardStats } from '../types';
import { ArrowRight, Truck, FileText, LayoutGrid } from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onEditDispatch: (id: number) => void;
}

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{c.title}</span>
                <h3 className="text-3xl font-extrabold text-slate-800">{c.value}</h3>
                <p className="text-xs text-slate-500">{c.desc}</p>
              </div>
              <div className={`p-4 rounded-xl ${c.textColor} font-bold`}>
                <Icon size={24} />
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

                const pathD = points.length > 0 
                  ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
                  : '';
                  
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

      {/* Recent Dispatches */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Recent Dispatches</h4>
          <button
            onClick={() => setActiveTab('history')}
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {d.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        d.status === 'draft'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {d.status === 'draft' ? 'Draft' : 'Completed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {d.vehicle_no}
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

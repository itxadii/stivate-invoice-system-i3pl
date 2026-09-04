import React from 'react';
import { Trash2, Check } from 'lucide-react';
import type { DispatchItem } from '../types';

interface DispatchTableProps {
  items: DispatchItem[];
  onRemoveItem?: (index: number) => void;
  onToggleVerify?: (index: number) => void;
  readOnly?: boolean;
}

export const DispatchTable: React.FC<DispatchTableProps> = ({
  items,
  onRemoveItem,
  onToggleVerify,
  readOnly = false
}) => {
  const showActions = !readOnly && (Boolean(onRemoveItem) || Boolean(onToggleVerify));

  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full divide-y divide-slate-200 bg-white text-left">
        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider w-16">
              Sr. No
            </th>
            <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
              ID Number
            </th>
            <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
              Pull List Number
            </th>
            <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
              Kit Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
              Workcell
            </th>
            <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider w-32">
              No of Parts
            </th>
            {showActions && (
              <th className="px-4 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-wider w-44">
                <div className="inline-flex items-center justify-center gap-2">
                  <span className="w-24 text-center">Action</span>
                  {onRemoveItem && <span className="w-7"></span>}
                </div>
              </th>
            )}
            {readOnly && (
              <th className="px-4 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-wider w-28">
                Status
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={showActions || readOnly ? 7 : 6}
                className="px-4 py-12 text-center text-sm text-slate-400 font-medium"
              >
                No pull lists added. Scan or enter a Pull List Number above.
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const isVerified = !item.pull_list_no.endsWith('_pending');
              const displayPullList = item.pull_list_no.replace(/_pending$/, '');

              return (
                <tr
                  key={idx}
                  className={`transition-colors duration-100 ${isVerified ? 'hover:bg-emerald-50/30' : 'hover:bg-amber-50/30'
                    } ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                >
                  <td className="px-4 py-3 text-sm font-mono text-slate-400 font-bold">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-semibold font-mono">
                    {item.id_number || <span className="text-slate-400 font-normal">-</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-900 font-black tracking-wide">
                    <div className="flex items-center gap-2">
                      <span>{displayPullList}</span>
                      {isVerified ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black" title="Verified">
                          ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black" title="Pending Verification">
                          ○
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                    {item.kit_type ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                        {item.kit_type}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                    {item.workcell || <span className="text-slate-400 font-normal">-</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-900 text-right font-black">
                    {item.parts && Number(item.parts) > 0 ? item.parts : <span className="text-slate-400 font-normal">-</span>}
                  </td>
                  {showActions && (
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        {/* Tick action button which means verified */}
                        {onToggleVerify && (
                          <button
                            type="button"
                            onClick={() => onToggleVerify(idx)}
                            className={`inline-flex items-center justify-center gap-1.5 w-24 py-1.5 rounded-lg text-xs font-black transition-all border cursor-pointer ${isVerified
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-2xs'
                              : 'bg-amber-500 hover:bg-emerald-600 text-white border-amber-600 hover:border-emerald-700 shadow-xs'
                              }`}
                            title={isVerified ? "Verified (Click to unverify)" : "Click to mark as Verified"}
                          >
                            <Check size={14} className={isVerified ? "text-emerald-600 stroke-[3]" : "text-white stroke-[3]"} />
                            <span>{isVerified ? 'Verified' : 'Verify'}</span>
                          </button>
                        )}

                        {/* Delete button */}
                        {onRemoveItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors duration-100 cursor-pointer shrink-0"
                            title="Delete Pull List"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {readOnly && (
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${isVerified
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                          }`}
                      >
                        <Check size={12} className="stroke-[3]" />
                        {isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

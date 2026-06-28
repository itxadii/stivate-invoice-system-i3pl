import React from 'react';
import { Trash2 } from 'lucide-react';
import type { DispatchItem } from '../types';

interface DispatchTableProps {
  items: DispatchItem[];
  onRemoveItem?: (index: number) => void;
  readOnly?: boolean;
}

export const DispatchTable: React.FC<DispatchTableProps> = ({
  items,
  onRemoveItem,
  readOnly = false
}) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 bg-white">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-12">
              S.No
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pull List Number
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              ID Number
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              Kit Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              Workcell
            </th>
            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">
              No of Parts
            </th>
            {!readOnly && onRemoveItem && (
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-16">
                Action
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={!readOnly && onRemoveItem ? 7 : 6}
                className="px-4 py-8 text-center text-sm text-slate-400 font-medium"
              >
                No pull lists added. Scan or enter a Pull List Number above.
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-100">
                <td className="px-4 py-3 text-sm font-mono text-slate-400 font-medium">
                  {idx + 1}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-800 font-bold">
                  {item.pull_list_no}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                  {item.id_number}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                    {item.kit_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                  {item.workcell}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-800 text-right font-bold">
                  {item.parts}
                </td>
                {!readOnly && onRemoveItem && (
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(idx)}
                      className="p-1 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors duration-100 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

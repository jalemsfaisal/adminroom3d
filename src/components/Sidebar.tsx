import React from 'react';
import { FurnitureItem, MaterialFinish } from '../types/office';
import { 
  RotateCw, 
  Trash2, 
  Plus, 
  X,
  Sliders,
  Save
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: FurnitureItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (updated: FurnitureItem, actionName?: string) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (type: 'staff_desk' | 'executive_desk' | 'bookshelf' | 'plant') => void;
  onSaveLayout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onSaveLayout,
}) => {
  if (!isOpen) return null;

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const materials: { id: MaterialFinish; label: string; bg: string }[] = [
    { id: 'warm_oak', label: 'Oak', bg: 'bg-[#d4a373]' },
    { id: 'walnut', label: 'Walnut', bg: 'bg-[#451a03]' },
    { id: 'scandinavian_ash', label: 'Ash', bg: 'bg-[#e2d4c0]' },
    { id: 'matte_black', label: 'Black', bg: 'bg-[#18181b]' },
  ];

  return (
    <aside className="w-72 h-full border-r border-slate-800 bg-slate-900/95 flex flex-col shrink-0 select-none z-30 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-100 uppercase tracking-wider">
            Furniture Items ({items.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
          title="Hide panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Add Catalog Buttons */}
      <div className="p-2 border-b border-slate-800 bg-slate-950/60 grid grid-cols-3 gap-1.5 text-[11px]">
        <button
          onClick={() => onAddItem('staff_desk')}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex flex-col items-center gap-0.5 transition-colors"
          title="Add Workstation (3.5×2.0 ft)"
        >
          <span className="text-blue-400 font-bold">+ Desk</span>
          <span className="text-[9px] text-slate-400">3.5×2 ft</span>
        </button>
        <button
          onClick={() => onAddItem('executive_desk')}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex flex-col items-center gap-0.5 transition-colors"
          title="Add Big Executive Table (4.5×3.0 ft)"
        >
          <span className="text-amber-400 font-bold">+ Big Table</span>
          <span className="text-[9px] text-slate-400">4.5×3 ft</span>
        </button>
        <button
          onClick={() => onAddItem('bookshelf')}
          className="p-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 rounded border border-amber-500/30 flex flex-col items-center gap-0.5 transition-colors"
          title="Add Storage Shelf (3.0 length × 1.5 width × 3.0 height ft)"
        >
          <span className="text-amber-300 font-bold">+ Shelf</span>
          <span className="text-[9px] text-amber-400/80">3×1.5×3 ft</span>
        </button>
      </div>

      {/* Selected Item Editor (Compact) */}
      {selectedItem && (
        <div className="p-3 border-b border-slate-800 bg-slate-950/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 truncate max-w-[170px]">
              {selectedItem.label}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const nextRot = (selectedItem.rotation + 90) % 360;
                  onUpdateItem(
                    { ...selectedItem, rotation: nextRot },
                    `Rotated ${selectedItem.label?.split('(')[0]?.trim() || selectedItem.name}`
                  );
                }}
                className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteItem(selectedItem.id)}
                className="p-1 hover:bg-red-950/50 text-slate-400 hover:text-rose-400 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 bg-slate-900/90 px-2 py-1.5 rounded border border-slate-800">
            <span>{selectedItem.width}×{selectedItem.length} ft</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-300">[{selectedItem.x.toFixed(1)}, {selectedItem.y.toFixed(1)}]</span>
            <span className="text-slate-500">·</span>
            <span>{selectedItem.rotation}°</span>
          </div>

          {/* Quick finish selector */}
          <div className="grid grid-cols-4 gap-1">
            {materials.map((mat) => (
              <button
                key={mat.id}
                onClick={() =>
                  onUpdateItem(
                    { ...selectedItem, material: mat.id },
                    `Changed ${selectedItem.name} finish to ${mat.label}`
                  )
                }
                className={`py-1 rounded text-[10px] border flex items-center justify-center gap-1 transition-colors ${
                  selectedItem.material === mat.id
                    ? 'border-amber-400 bg-amber-500/10 text-white font-medium'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title={mat.label}
              >
                <span className={`w-2 h-2 rounded-full ${mat.bg}`} />
                <span>{mat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => {
          const isSelected = item.id === selectedItemId;
          const isExec = item.type === 'executive_desk';

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className={`px-2.5 py-2 rounded-md border cursor-pointer transition-all flex items-center justify-between text-xs ${
                isSelected
                  ? 'border-amber-400/80 bg-amber-500/10 text-white'
                  : 'border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/50 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isExec ? 'bg-amber-400' : 'bg-blue-400'
                  }`}
                />
                <span className="font-medium truncate">{item.name}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                {item.width}×{item.length} ft
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Save Action */}
      {onSaveLayout && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onSaveLayout}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50"
            title="Save all changes to browser storage"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>Save All Edits</span>
          </button>
        </div>
      )}
    </aside>
  );
};

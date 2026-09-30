import React, { useState } from 'react';
import { ViewMode, LayoutPreset, FurnitureItem, RoomConfig } from '../types/office';
import { LAYOUT_PRESETS } from '../constants/presets';
import { 
  Columns, 
  Layers, 
  Box, 
  FileText, 
  RotateCcw, 
  Download, 
  ChevronDown,
  PanelLeft,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Printer,
  Check,
  Save,
  Undo2,
  Redo2
} from 'lucide-react';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activePreset: LayoutPreset;
  onSelectPreset: (preset: LayoutPreset) => void;
  onResetLayout: () => void;
  onSaveLayout?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  lastActionMessage?: string | null;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  itemCount: number;
  items: FurnitureItem[];
  roomConfig: RoomConfig;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  activePreset,
  onSelectPreset,
  onResetLayout,
  onSaveLayout,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  lastActionMessage,
  isSidebarOpen,
  onToggleSidebar,
  itemCount,
  items,
  roomConfig,
}) => {
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // 1. Export as JSON Model
  const handleExportJSON = () => {
    const exportData = {
      project: '21x15 Modern Studio Layout',
      exportedAt: new Date().toISOString(),
      roomConfig,
      preset: activePreset.name,
      totalItems: items.length,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        label: i.label,
        dimensions: {
          widthFt: i.width,
          lengthFt: i.length,
          heightFt: i.type === 'bookshelf' ? 3.0 : 2.5,
        },
        position: {
          x: i.x,
          y: i.y,
          rotation: i.rotation,
        },
        material: i.material,
        assignedRole: i.assignedRole,
        notes: i.notes,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `office-studio-21x15-layout-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast('Downloaded CAD JSON Blueprint!');
  };

  // 2. Export as CSV / Excel Bill of Materials (BOM)
  const handleExportCSV = () => {
    const headers = [
      'Item ID',
      'Item Name',
      'Type',
      'Width (Tiles/Ft)',
      'Length (Tiles/Ft)',
      'Height (Tiles/Ft)',
      'X Position',
      'Y Position',
      'Rotation (deg)',
      'Material Finish',
      'Assigned Role',
      'Has Chair',
      'Power / Cable Tray',
      'Notes',
    ];

    const rows = items.map((i) => [
      `"${i.id}"`,
      `"${i.name}"`,
      `"${i.type}"`,
      i.width,
      i.length,
      i.type === 'bookshelf' ? 3.0 : 2.5,
      i.x,
      i.y,
      i.rotation,
      `"${i.material}"`,
      `"${i.assignedRole || ''}"`,
      i.hasChair ? 'Yes' : 'No',
      i.cableTray ? 'Yes' : 'No',
      `"${(i.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `office-furniture-schedule-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast('Downloaded CSV Furniture Schedule!');
  };

  // 3. Export as Standalone SVG Vector Blueprint
  const handleExportSVG = () => {
    const scale = 30; // 30px per foot
    const widthPx = roomConfig.widthFt * scale;
    const lengthPx = roomConfig.lengthFt * scale;

    const itemElements = items.map((item) => {
      const boundW = item.rotation % 180 === 0 ? item.width : item.length;
      const boundL = item.rotation % 180 === 0 ? item.length : item.width;
      const pxX = item.x * scale;
      const pxY = item.y * scale;
      const pxW = item.width * scale;
      const pxL = item.length * scale;
      const isExec = item.type === 'executive_desk';
      const isShelf = item.type === 'bookshelf';
      const color = isExec ? '#d97706' : isShelf ? '#78350f' : '#1d4ed8';

      return `
        <g transform="translate(${pxX + (boundW * scale) / 2}, ${pxY + (boundL * scale) / 2}) rotate(${item.rotation}) translate(${-pxW / 2}, ${-pxL / 2})">
          <rect x="0" y="0" width="${pxW}" height="${pxL}" rx="4" fill="${color}" fill-opacity="0.85" stroke="#ffffff" stroke-width="1.5" />
          <text x="${pxW / 2}" y="${pxL / 2}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="10" font-family="sans-serif" font-weight="bold">
            ${item.label.split('(')[0]}
          </text>
        </g>
      `;
    }).join('\n');

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx + 80} ${lengthPx + 80}" width="${widthPx + 80}" height="${lengthPx + 80}">
        <rect width="100%" height="100%" fill="#090d16" />
        <g transform="translate(40, 40)">
          <!-- Tile Grid -->
          <rect width="${widthPx}" height="${lengthPx}" fill="#0f172a" stroke="#38bdf8" stroke-width="3" />
          ${itemElements}
        </g>
        <text x="40" y="25" fill="#38bdf8" font-size="14" font-family="sans-serif" font-weight="bold">
          21' x 15' Modern Office Studio Architectural Blueprint
        </text>
      </svg>
    `;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `office-blueprint-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast('Downloaded SVG Blueprint!');
  };

  // 4. Print / PDF spec sheet
  const handlePrint = () => {
    setShowExportMenu(false);
    onViewModeChange('designer_audit');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <header className="h-12 px-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between z-40 shrink-0 select-none">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-emerald-950 border border-emerald-500/80 text-emerald-200 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Zone 1: Brand & Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 ${
            isSidebarOpen
              ? 'bg-amber-400 text-slate-950 border-amber-400 font-semibold'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
          title="Toggle furniture list & properties"
        >
          <PanelLeft className="w-3.5 h-3.5" />
          <span>Items ({itemCount})</span>
        </button>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        <div className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-amber-400" />
          <span>21×15 STUDIO</span>
        </div>
      </div>

      {/* Zone 2: Clean View Modes */}
      <nav className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
        <button
          onClick={() => onViewModeChange('2d_blueprint')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            viewMode === '2d_blueprint'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>2D Plan</span>
        </button>

        <button
          onClick={() => onViewModeChange('3d_spatial')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            viewMode === '3d_spatial'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box className="w-3.5 h-3.5 text-emerald-400" />
          <span>3D View</span>
        </button>

        <button
          onClick={() => onViewModeChange('split')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            viewMode === 'split'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Columns className="w-3.5 h-3.5 text-amber-400" />
          <span>Split</span>
        </button>

        <button
          onClick={() => onViewModeChange('designer_audit')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            viewMode === 'designer_audit'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-purple-400" />
          <span>Audit & BOM</span>
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2 relative">
        {/* Preset Selector */}
        <div className="relative">
          <button
            onClick={() => setShowPresetDropdown(!showPresetDropdown)}
            className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <span className="text-amber-400">Layout:</span>
            <span className="truncate max-w-[120px]">{activePreset.name.split('&')[0]}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showPresetDropdown && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Select Layout
              </div>
              <div className="space-y-1">
                {LAYOUT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onSelectPreset(preset);
                      setShowPresetDropdown(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors ${
                      activePreset.id === preset.id
                        ? 'bg-amber-500/20 text-white border border-amber-500/40'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-slate-200">{preset.name}</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      {preset.corridorWidthFt} ft clear spine
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Undo / Redo Controls */}
        <div className="flex items-center bg-slate-800/80 rounded border border-slate-700/70 p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1 rounded transition-colors flex items-center gap-1 ${
              canUndo
                ? 'text-slate-200 hover:text-amber-400 hover:bg-slate-700 active:scale-95'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title={canUndo ? 'Undo last change (Ctrl+Z / ⌘Z)' : 'Nothing to undo'}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1 rounded transition-colors flex items-center gap-1 ${
              canRedo
                ? 'text-slate-200 hover:text-amber-400 hover:bg-slate-700 active:scale-95'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title={canRedo ? 'Redo last change (Ctrl+Y / ⌘⇧Z)' : 'Nothing to redo'}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {onSaveLayout && (
          <button
            onClick={() => {
              onSaveLayout();
              showToast('✓ Layout edits saved successfully!');
            }}
            className="px-2.5 py-1 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 rounded transition-all whitespace-nowrap flex items-center gap-1.5 shadow-sm"
            title="Save layout changes to browser storage"
          >
            <Save className="w-3.5 h-3.5 text-emerald-950" />
            <span>Save</span>
          </button>
        )}

        <button
          onClick={onResetLayout}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Reset layout to preset defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Working Multi-Format Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm"
            title="Export layout in multiple formats"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-slate-900" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Export Options
              </div>

              <button
                onClick={handleExportJSON}
                className="w-full text-left p-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center gap-2.5 transition-colors"
              >
                <FileCode className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold">CAD / JSON Model</div>
                  <div className="text-[10px] text-slate-400">Full 3D/2D coordinates & metadata</div>
                </div>
              </button>

              <button
                onClick={handleExportCSV}
                className="w-full text-left p-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-emerald-300 flex items-center gap-2.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold">CSV / Excel Schedule</div>
                  <div className="text-[10px] text-slate-400">Bill of materials & item count</div>
                </div>
              </button>

              <button
                onClick={handleExportSVG}
                className="w-full text-left p-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-blue-300 flex items-center gap-2.5 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="font-semibold">Vector SVG Blueprint</div>
                  <div className="text-[10px] text-slate-400">Scalable 2D architectural drawing</div>
                </div>
              </button>

              <div className="h-px bg-slate-800 my-1" />

              <button
                onClick={handlePrint}
                className="w-full text-left p-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-purple-300 flex items-center gap-2.5 transition-colors"
              >
                <Printer className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-semibold">Printable Spec Sheet (PDF)</div>
                  <div className="text-[10px] text-slate-400">Formal audit report & print layout</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

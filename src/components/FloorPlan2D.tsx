import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FurnitureItem, RoomConfig, CirculationPath, RoomZone, DoorOpening } from '../types/office';
import { 
  RotateCw, 
  Trash2, 
  Grid, 
  Plus, 
  ZoomIn,
  ZoomOut,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  ArrowLeftRight,
  Save,
  Undo2,
  Redo2
} from 'lucide-react';

interface FloorPlan2DProps {
  roomConfig: RoomConfig;
  items: FurnitureItem[];
  circulationPaths: CirculationPath[];
  zones: RoomZone[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (item: FurnitureItem, actionName?: string) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (type: 'staff_desk' | 'executive_desk' | 'bookshelf' | 'plant') => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  snapGrid: 0.5 | 1.0 | 0;
  onChangeSnapGrid: (snap: 0.5 | 1.0 | 0) => void;
  onToggleDoorSides?: () => void;
  onToggleMainDoorCorner?: () => void;
  onSaveLayout?: () => void;
  onStartDrag?: (items: FurnitureItem[]) => void;
  onEndDrag?: (items: FurnitureItem[], actionName?: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

// Check if an item overlaps any door clearance zone
function checkItemDoorBlockage(item: FurnitureItem, doors: DoorOpening[]) {
  if (item.type === 'plant' || item.type === 'bookshelf') {
    return { isBlocked: false, doorName: '', wall: '' };
  }
  const w = item.rotation % 180 === 0 ? item.width : item.length;
  const l = item.rotation % 180 === 0 ? item.length : item.width;
  const x1 = item.x;
  const x2 = item.x + w;
  const y1 = item.y;
  const y2 = item.y + l;

  for (const door of doors) {
    if (door.wall === 'left') {
      const dY1 = door.startFt;
      const dY2 = door.startFt + door.widthFt;
      // If table is within 2.8 ft of left wall and in door's Y span
      if (x1 < 2.8 && !(y2 <= dY1 || y1 >= dY2)) {
        return { isBlocked: true, doorName: door.name, wall: 'Left Door' };
      }
    } else if (door.wall === 'right') {
      const dY1 = door.startFt;
      const dY2 = door.startFt + door.widthFt;
      // If table is within 2.8 ft of right wall and in door's Y span
      if (x2 > 15 - 2.8 && !(y2 <= dY1 || y1 >= dY2)) {
        return { isBlocked: true, doorName: door.name, wall: 'Right Door' };
      }
    } else if (door.wall === 'front') {
      const dX1 = door.startFt;
      const dX2 = door.startFt + door.widthFt;
      // If table is within 2.8 ft of front wall and in door's X span
      if (y1 < 2.8 && !(x2 <= dX1 || x1 >= dX2)) {
        return { isBlocked: true, doorName: door.name, wall: 'Front Entry' };
      }
    }
  }
  return { isBlocked: false, doorName: '', wall: '' };
}

export const FloorPlan2D: React.FC<FloorPlan2DProps> = ({
  roomConfig,
  items,
  circulationPaths,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  showHeatmap,
  onToggleHeatmap,
  snapGrid,
  onChangeSnapGrid,
  onToggleDoorSides,
  onToggleMainDoorCorner,
  onSaveLayout,
  onStartDrag,
  onEndDrag,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(34); // pixels per tile (foot)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 30, y: 35 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [itemDragOffset, setItemDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showClearance, setShowClearance] = useState<boolean>(true);

  // Auto-fit blueprint in viewport
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const paddingX = 80;
      const paddingY = 80;
      const availW = Math.max(100, clientWidth - paddingX);
      const availH = Math.max(100, clientHeight - paddingY);

      const targetScale = Math.min(
        availW / roomConfig.widthFt,
        availH / roomConfig.lengthFt
      );
      const finalScale = Math.max(22, Math.min(46, targetScale));
      setScale(finalScale);

      const centerX = (clientWidth - roomConfig.widthFt * finalScale) / 2;
      const centerY = (clientHeight - roomConfig.lengthFt * finalScale) / 2;
      setOffset({ x: Math.max(20, centerX), y: Math.max(25, centerY) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [roomConfig.widthFt, roomConfig.lengthFt]);

  // Selected item reference
  const selectedItem = items.find((i) => i.id === selectedItemId);

  // Check all items for door blockages
  const blockedItems = useMemo(() => {
    return items
      .map((item) => ({
        item,
        status: checkItemDoorBlockage(item, roomConfig.doors),
      }))
      .filter((res) => res.status.isBlocked);
  }, [items, roomConfig.doors]);

  // Convert screen coordinates to room feet/tiles
  const screenToRoom = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = (clientX - rect.left - offset.x) / scale;
      const rawY = (clientY - rect.top - offset.y) / scale;
      return { x: rawX, y: rawY };
    },
    [offset, scale]
  );

  // Handle pointer down on furniture item
  const handleItemPointerDown = (e: React.PointerEvent, item: FurnitureItem) => {
    e.stopPropagation();
    onSelectItem(item.id);
    setDraggedItemId(item.id);
    onStartDrag?.(items);

    const roomPos = screenToRoom(e.clientX, e.clientY);
    setItemDragOffset({
      x: roomPos.x - item.x,
      y: roomPos.y - item.y,
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  // Handle pointer move for item dragging or canvas panning
  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedItemId) {
      const item = items.find((i) => i.id === draggedItemId);
      if (!item) return;

      const roomPos = screenToRoom(e.clientX, e.clientY);
      let newX = roomPos.x - itemDragOffset.x;
      let newY = roomPos.y - itemDragOffset.y;

      // Snapping
      if (snapGrid > 0) {
        newX = Math.round(newX / snapGrid) * snapGrid;
        newY = Math.round(newY / snapGrid) * snapGrid;
      }

      // Constrain within room walls
      const maxX = roomConfig.widthFt - (item.rotation % 180 === 0 ? item.width : item.length);
      const maxY = roomConfig.lengthFt - (item.rotation % 180 === 0 ? item.length : item.width);

      newX = Math.max(0.1, Math.min(newX, maxX - 0.1));
      newY = Math.max(0.1, Math.min(newY, maxY - 0.1));

      onUpdateItem({
        ...item,
        x: Number(newX.toFixed(2)),
        y: Number(newY.toFixed(2)),
      });
    } else if (isDraggingCanvas) {
      setOffset((prev) => ({
        x: prev.x + (e.clientX - dragStart.x),
        y: prev.y + (e.clientY - dragStart.y),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = () => {
    if (draggedItemId) {
      const movedItem = items.find((i) => i.id === draggedItemId);
      onEndDrag?.(items, `Moved ${movedItem?.label?.split('(')[0]?.trim() || movedItem?.name || 'Furniture'}`);
    }
    setDraggedItemId(null);
    setIsDraggingCanvas(false);
  };

  const handleRotateSelected = () => {
    if (!selectedItem) return;
    const nextRot = (selectedItem.rotation + 90) % 360;
    onUpdateItem(
      {
        ...selectedItem,
        rotation: nextRot,
      },
      `Rotated ${selectedItem.label?.split('(')[0]?.trim() || selectedItem.name}`
    );
  };

  // Door objects lookup
  const leftDoor = roomConfig.doors.find((d) => d.wall === 'left');
  const rightDoor = roomConfig.doors.find((d) => d.wall === 'right');
  const frontDoor = roomConfig.doors.find((d) => d.wall === 'front');

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Sleek Minimal Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 z-20 backdrop-blur-md text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">2D Floor Plan</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-slate-400">21×15 Tiles (1 ft/tile)</span>

          <div className="h-3.5 w-px bg-slate-800 mx-1" />

          {/* Quick add buttons */}
          <button
            onClick={() => onAddItem('staff_desk')}
            className="px-2 py-0.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded border border-slate-700 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3 text-blue-400" />
            <span>+ Desk</span>
          </button>
          <button
            onClick={() => onAddItem('executive_desk')}
            className="px-2 py-0.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded border border-slate-700 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>+ Big Table</span>
          </button>
          <button
            onClick={() => onAddItem('bookshelf')}
            className="px-2 py-0.5 text-xs text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 rounded border border-amber-500/40 flex items-center gap-1 transition-colors ml-1 font-medium shadow-sm"
            title="Add Shelf: 3.0 tiles length × 1.5 tiles wide × 3.0 tiles height"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>+ Shelf (3×1.5×3 ft)</span>
          </button>

          {onToggleDoorSides && (
            <button
              onClick={onToggleDoorSides}
              className="px-2 py-0.5 text-[11px] text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded border border-amber-500/30 flex items-center gap-1 transition-colors ml-1"
              title="Swap doors between Left & Right walls"
            >
              <ArrowLeftRight className="w-3 h-3 text-amber-400" />
              <span>Swap Doors</span>
            </button>
          )}

          {onSaveLayout && (
            <button
              onClick={onSaveLayout}
              className="px-2.5 py-0.5 text-[11px] text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900/90 rounded border border-emerald-500/50 flex items-center gap-1 transition-all ml-1 font-semibold shadow-sm active:scale-95"
              title="Save all custom edits & positions"
            >
              <Save className="w-3 h-3 text-emerald-400" />
              <span>Save</span>
            </button>
          )}

          {/* Undo / Redo controls in 2D toolbar */}
          {onUndo && onRedo && (
            <div className="flex items-center bg-slate-800/80 rounded border border-slate-700/60 p-0.5 ml-1">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-1 rounded transition-colors ${
                  canUndo
                    ? 'text-slate-200 hover:text-amber-400 hover:bg-slate-700'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
                title={canUndo ? 'Undo last change (Ctrl+Z)' : 'Nothing to undo'}
              >
                <Undo2 className="w-3 h-3" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-1 rounded transition-colors ${
                  canRedo
                    ? 'text-slate-200 hover:text-amber-400 hover:bg-slate-700'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
                title={canRedo ? 'Redo last change (Ctrl+Y)' : 'Nothing to redo'}
              >
                <Redo2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* View toggles & status */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {blockedItems.length > 0 ? (
            <div className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[11px] font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>1 Table In Front of Door!</span>
            </div>
          ) : (
            <div className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>All Doors 100% Clear</span>
            </div>
          )}

          {/* Snap toggle */}
          <div className="flex items-center bg-slate-800/80 rounded border border-slate-700/60 p-0.5 text-[11px]">
            <button
              onClick={() => onChangeSnapGrid(1.0)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                snapGrid === 1.0 ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1ft
            </button>
            <button
              onClick={() => onChangeSnapGrid(0.5)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                snapGrid === 0.5 ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              0.5ft
            </button>
          </div>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1 rounded border text-xs transition-colors ${
              showGrid ? 'bg-slate-800 text-amber-400 border-amber-400/40' : 'bg-slate-800/50 text-slate-400 border-slate-700'
            }`}
            title="Toggle tile grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Circulation toggle */}
          <button
            onClick={onToggleHeatmap}
            className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1 transition-colors ${
              showHeatmap ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700'
            }`}
            title="Toggle circulation flow arrows"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Spine</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-slate-800/80 rounded border border-slate-700/60 p-0.5">
            <button
              onClick={() => setScale((s) => Math.min(s + 4, 65))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(s - 4, 18))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Warning Alert if any table blocks a door */}
      {blockedItems.length > 0 && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-4 py-1.5 flex items-center justify-between text-xs text-rose-200 z-10 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Problem:</strong> {blockedItems[0].item.name} is in front of {blockedItems[0].status.doorName}! Drag the table into the room past the door threshold.
            </span>
          </div>
          <button
            onClick={() => {
              // Automatically move blocked item safely away from door
              const item = blockedItems[0].item;
              onUpdateItem({
                ...item,
                y: 10.0,
                x: item.x < 7.5 ? 1.2 : 10.3,
              });
            }}
            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium text-[11px]"
          >
            Auto-Fix Position
          </button>
        </div>
      )}

      {/* Interactive Blueprint Canvas */}
      <div
        ref={containerRef}
        onPointerDown={(e) => {
          if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
            onSelectItem(null);
            setIsDraggingCanvas(true);
            setDragStart({ x: e.clientX, y: e.clientY });
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
      >
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
        >
          <defs>
            <pattern
              id="cleanTilePattern"
              width={scale}
              height={scale}
              patternUnits="userSpaceOnUse"
            >
              {/* High-visibility architectural ceramic tile square */}
              <rect width={scale} height={scale} fill="#0d1527" stroke="#334155" strokeWidth="1.5" />
              <rect width={scale - 2} height={scale - 2} fill="#111c33" x="1" y="1" rx="0.5" opacity="0.9" />
              <circle cx={scale} cy={scale} r="1.5" fill="#475569" />
            </pattern>

            <marker
              id="cleanFlowArrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>

            <marker
              id="slideArrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 1 2 L 8 5 L 1 8 z" fill="#34d399" />
            </marker>

            <marker
              id="slideArrowAmber"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 1 2 L 8 5 L 1 8 z" fill="#f59e0b" />
            </marker>

            <marker
              id="slideArrowBlue"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 1 2 L 8 5 L 1 8 z" fill="#38bdf8" />
            </marker>
          </defs>

          <g transform={`translate(${offset.x}, ${offset.y})`}>
            {/* Floor Slab (15 x 21 ft) */}
            <rect
              x={0}
              y={0}
              width={roomConfig.widthFt * scale}
              height={roomConfig.lengthFt * scale}
              fill="url(#cleanTilePattern)"
              stroke="#64748b"
              strokeWidth="3"
            />

            {/* Major 5-Tile Grid Accent Lines */}
            {Array.from({ length: Math.floor(roomConfig.widthFt / 5) }).map((_, i) => (
              <line
                key={`major-x-${i}`}
                x1={(i + 1) * 5 * scale}
                y1={0}
                x2={(i + 1) * 5 * scale}
                y2={roomConfig.lengthFt * scale}
                stroke="#475569"
                strokeWidth="2"
                strokeDasharray="4 2"
                className="pointer-events-none opacity-60"
              />
            ))}
            {Array.from({ length: Math.floor(roomConfig.lengthFt / 5) }).map((_, i) => (
              <line
                key={`major-y-${i}`}
                x1={0}
                y1={(i + 1) * 5 * scale}
                x2={roomConfig.widthFt * scale}
                y2={(i + 1) * 5 * scale}
                stroke="#475569"
                strokeWidth="2"
                strokeDasharray="4 2"
                className="pointer-events-none opacity-60"
              />
            ))}

            {/* Ultra-Clear Tile Index Grid Numbers */}
            {showGrid && (
              <g className="pointer-events-none">
                {Array.from({ length: roomConfig.widthFt }).map((_, i) => {
                  const isEntryDoorCol = i >= 12 && i < 15;
                  return (
                    <g key={`col-${i}`}>
                      <rect
                        x={i * scale + 1}
                        y={-18}
                        width={scale - 2}
                        height={12}
                        rx="2"
                        fill={isEntryDoorCol ? '#065f46' : '#1e293b'}
                        stroke={isEntryDoorCol ? '#10b981' : '#334155'}
                        strokeWidth="1"
                      />
                      <text
                        x={(i + 0.5) * scale}
                        y={-9}
                        textAnchor="middle"
                        fill={isEntryDoorCol ? '#34d399' : '#e2e8f0'}
                        fontSize="8.5"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {i + 1}
                      </text>
                    </g>
                  );
                })}

                {Array.from({ length: roomConfig.lengthFt }).map((_, i) => {
                  const isAdminDoorRow = i >= 4 && i < 7;
                  const isITDoorRow = i >= 3 && i < 10;
                  const isDoorRow = isAdminDoorRow || isITDoorRow;
                  return (
                    <g key={`row-${i}`}>
                      <rect
                        x={-20}
                        y={i * scale + 1}
                        width={14}
                        height={scale - 2}
                        rx="2"
                        fill={isAdminDoorRow ? '#78350f' : isITDoorRow ? '#075985' : '#1e293b'}
                        stroke={isAdminDoorRow ? '#f59e0b' : isITDoorRow ? '#38bdf8' : '#334155'}
                        strokeWidth="1"
                      />
                      <text
                        x={-13}
                        y={(i + 0.5) * scale + 3}
                        textAnchor="middle"
                        fill={isAdminDoorRow ? '#fbbf24' : isITDoorRow ? '#7dd3fc' : '#e2e8f0'}
                        fontSize="8.5"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {i + 1}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Door Clearance Buffer Zones (100% Unobstructed Concourse) */}
            {showHeatmap && (
              <g className="pointer-events-none">
                {/* Front Door Buffer Zone */}
                {frontDoor && (
                  <g>
                    <rect
                      x={frontDoor.startFt * scale}
                      y={0}
                      width={frontDoor.widthFt * scale}
                      height={3.0 * scale}
                      fill="#10b981"
                      fillOpacity="0.08"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={(frontDoor.startFt + frontDoor.widthFt / 2) * scale}
                      y={1.5 * scale}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#34d399"
                      fontSize="8"
                      fontWeight="700"
                    >
                      {frontDoor.startFt > 8 ? 'CORNER ENTRY CLEAR' : 'FRONT ENTRY CLEAR'}
                    </text>
                  </g>
                )}

                {/* Left Door Buffer Zone */}
                {leftDoor && (
                  <g>
                    <rect
                      x={0}
                      y={leftDoor.startFt * scale}
                      width={3.2 * scale}
                      height={leftDoor.widthFt * scale}
                      fill="#f59e0b"
                      fillOpacity="0.08"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={1.6 * scale}
                      y={(leftDoor.startFt + leftDoor.widthFt / 2) * scale}
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="9"
                      fontWeight="700"
                      transform={`rotate(-90, ${1.6 * scale}, ${(leftDoor.startFt + leftDoor.widthFt / 2) * scale})`}
                    >
                      ADMIN DEPT CLEAR ZONE
                    </text>
                  </g>
                )}

                {/* Right Door Buffer Zone */}
                {rightDoor && (
                  <g>
                    <rect
                      x={(roomConfig.widthFt - (rightDoor.type === 'double_glass' ? 4.5 : 3.2)) * scale}
                      y={rightDoor.startFt * scale}
                      width={(rightDoor.type === 'double_glass' ? 4.5 : 3.2) * scale}
                      height={rightDoor.widthFt * scale}
                      fill="#0ea5e9"
                      fillOpacity="0.08"
                      stroke="#0ea5e9"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={(roomConfig.widthFt - (rightDoor.type === 'double_glass' ? 2.25 : 1.6)) * scale}
                      y={(rightDoor.startFt + rightDoor.widthFt / 2) * scale}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="9"
                      fontWeight="700"
                      transform={`rotate(90, ${(roomConfig.widthFt - (rightDoor.type === 'double_glass' ? 2.25 : 1.6)) * scale}, ${(rightDoor.startFt + rightDoor.widthFt / 2) * scale})`}
                    >
                      IT DEPT CLEAR ZONE
                    </text>
                  </g>
                )}

                {/* 5.6-Tile Central Highway straight to Big Table */}
                <rect
                  x={4.7 * scale}
                  y={0.5 * scale}
                  width={5.6 * scale}
                  height={16.5 * scale}
                  fill="#10b981"
                  fillOpacity="0.12"
                  rx="6"
                />

                {/* Dimension label across the central aisle */}
                <line
                  x1={4.7 * scale}
                  y1={8.0 * scale}
                  x2={10.3 * scale}
                  y2={8.0 * scale}
                  stroke="#34d399"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle cx={4.7 * scale} cy={8.0 * scale} r={2.5} fill="#34d399" />
                <circle cx={10.3 * scale} cy={8.0 * scale} r={2.5} fill="#34d399" />
                <rect
                  x={5.3 * scale}
                  y={7.4 * scale}
                  width={4.4 * scale}
                  height={14}
                  fill="#064e3b"
                  rx="3"
                />
                <text
                  x={7.5 * scale}
                  y={7.4 * scale + 10}
                  textAnchor="middle"
                  fill="#6ee7b7"
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  5.6 TILES CLEAR HIGHWAY (MIN 3-4 TILES)
                </text>

                {circulationPaths.map((path) => {
                  const d = path.points.reduce((acc, [px, py], idx) => {
                    return idx === 0 ? `M ${px * scale} ${py * scale}` : `${acc} L ${px * scale} ${py * scale}`;
                  }, '');

                  return (
                    <path
                      key={path.id}
                      d={d}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      markerEnd="url(#cleanFlowArrow)"
                      opacity="0.85"
                    />
                  );
                })}
              </g>
            )}

            {/* Rear Window Wall (Y = 21 ft) */}
            <g transform={`translate(0, ${roomConfig.lengthFt * scale})`}>
              <line x1={0} y1={0} x2={roomConfig.widthFt * scale} y2={0} stroke="#38bdf8" strokeWidth="6" />
              {Array.from({ length: 25 }).map((_, i) => (
                <line
                  key={`b-${i}`}
                  x1={(i * (roomConfig.widthFt * scale)) / 25}
                  y1={-3}
                  x2={((i + 0.6) * (roomConfig.widthFt * scale)) / 25}
                  y2={3}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
              ))}
              <text
                x={(roomConfig.widthFt * scale) / 2}
                y={18}
                textAnchor="middle"
                fill="#38bdf8"
                fontSize="10"
                fontWeight="600"
              >
                15'-0" WINDOW (BLINDS · DAYLIGHT)
              </text>
            </g>

            {/* Front Wall & Door 1 (Transparent Glass Wall & Glass Sliding Door) */}
            <g>
              {frontDoor ? (
                <>
                  {/* Left wall segment: Transparent Glass Wall */}
                  <line x1={0} y1={0} x2={frontDoor.startFt * scale} y2={0} stroke="#38bdf8" strokeWidth="5" strokeDasharray="8 2" />
                  {/* Right wall segment: Transparent Glass Wall */}
                  <line
                    x1={(frontDoor.startFt + frontDoor.widthFt) * scale}
                    y1={0}
                    x2={roomConfig.widthFt * scale}
                    y2={0}
                    stroke="#38bdf8"
                    strokeWidth="5"
                    strokeDasharray="8 2"
                  />
                  {/* Sliding Door Track */}
                  <line
                    x1={(frontDoor.startFt - 0.2) * scale}
                    y1={-1}
                    x2={(frontDoor.startFt + frontDoor.widthFt + 0.4) * scale}
                    y2={-1}
                    stroke="#0284c7"
                    strokeWidth="3"
                  />
                  {/* Sliding Threshold */}
                  <rect
                    x={frontDoor.startFt * scale}
                    y={-3}
                    width={frontDoor.widthFt * scale}
                    height={6}
                    fill="#38bdf8"
                    fillOpacity="0.3"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  {/* Sliding Door Leaf (Transparent Glass Leaf) */}
                  <rect
                    x={(frontDoor.startFt + 0.2) * scale}
                    y={2}
                    width={(frontDoor.widthFt - 0.4) * scale}
                    height={5}
                    rx="1.5"
                    fill="#0284c7"
                    fillOpacity="0.5"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  {/* Slide Direction Arrow */}
                  <line
                    x1={(frontDoor.startFt + 0.6) * scale}
                    y1={13}
                    x2={(frontDoor.startFt + frontDoor.widthFt - 0.6) * scale}
                    y2={13}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    markerEnd="url(#slideArrow)"
                  />
                  <text
                    x={(frontDoor.startFt + frontDoor.widthFt / 2) * scale}
                    y={23}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="8"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    SLIDE OPEN ➔
                  </text>

                  {/* Title Label */}
                  <text
                    x={(frontDoor.startFt + frontDoor.widthFt / 2) * scale}
                    y={-14}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="9"
                    fontWeight="700"
                  >
                    ENTRY DOOR (GLASS SLIDING DOOR)
                  </text>
                </>
              ) : (
                <line x1={0} y1={0} x2={roomConfig.widthFt * scale} y2={0} stroke="#38bdf8" strokeWidth="5" strokeDasharray="8 2" />
              )}
            </g>

            {/* LEFT Wall & Left Door(s) (Admin Dept Transparent Glass Sliding Door) */}
            <g>
              {leftDoor ? (
                <>
                  {/* Wall before door */}
                  <line x1={0} y1={0} x2={0} y2={leftDoor.startFt * scale} stroke="#64748b" strokeWidth="6" />
                  {/* Wall after door */}
                  <line
                    x1={0}
                    y1={(leftDoor.startFt + leftDoor.widthFt) * scale}
                    x2={0}
                    y2={roomConfig.lengthFt * scale}
                    stroke="#64748b"
                    strokeWidth="6"
                  />

                  {/* Sliding Door Track */}
                  <line
                    x1={-1}
                    y1={(leftDoor.startFt - 0.2) * scale}
                    y2={-1}
                    x2={(leftDoor.startFt + leftDoor.widthFt + 0.6) * scale}
                    stroke="#0284c7"
                    strokeWidth="3"
                  />
                  {/* Left Door Threshold */}
                  <rect
                    x={-3}
                    y={leftDoor.startFt * scale}
                    width={6}
                    height={leftDoor.widthFt * scale}
                    fill="#38bdf8"
                    fillOpacity="0.3"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />

                  {/* Sliding Door Leaf: Glass */}
                  <rect
                    x={2}
                    y={(leftDoor.startFt + 0.2) * scale}
                    width={5}
                    height={(leftDoor.widthFt - 0.4) * scale}
                    rx="1.5"
                    fill="#0284c7"
                    fillOpacity="0.5"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  {/* Slide Direction Arrow */}
                  <line
                    x1={13}
                    y1={(leftDoor.startFt + 0.5) * scale}
                    x2={13}
                    y2={(leftDoor.startFt + leftDoor.widthFt - 0.5) * scale}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    markerEnd="url(#slideArrow)"
                  />
                  <text
                    x={23}
                    y={(leftDoor.startFt + leftDoor.widthFt / 2) * scale}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="8"
                    fontWeight="700"
                    fontFamily="monospace"
                    transform={`rotate(90, 23, ${(leftDoor.startFt + leftDoor.widthFt / 2) * scale})`}
                  >
                    SLIDE OPEN ➔
                  </text>

                  <text
                    x={-14}
                    y={(leftDoor.startFt + leftDoor.widthFt / 2) * scale}
                    fill="#38bdf8"
                    fontSize="9"
                    fontWeight="700"
                    transform={`rotate(-90, -14, ${(leftDoor.startFt + leftDoor.widthFt / 2) * scale})`}
                    textAnchor="middle"
                  >
                    ADMIN DEPT (GLASS SLIDING DOOR)
                  </text>
                </>
              ) : (
                <line x1={0} y1={0} x2={0} y2={roomConfig.lengthFt * scale} stroke="#64748b" strokeWidth="6" />
              )}
            </g>

            {/* RIGHT Wall & Right Door(s) (IT Dept Double Sliding Doors) */}
            <g transform={`translate(${roomConfig.widthFt * scale}, 0)`}>
              {rightDoor ? (
                <>
                  {/* Wall before door */}
                  <line x1={0} y1={0} x2={0} y2={rightDoor.startFt * scale} stroke="#64748b" strokeWidth="5" />
                  {/* Wall after door */}
                  <line
                    x1={0}
                    y1={(rightDoor.startFt + rightDoor.widthFt) * scale}
                    x2={0}
                    y2={roomConfig.lengthFt * scale}
                    stroke="#64748b"
                    strokeWidth="5"
                  />

                  {/* Double Sliding Tracks */}
                  <line
                    x1={-3}
                    y1={(rightDoor.startFt - 0.3) * scale}
                    x2={-3}
                    y2={(rightDoor.startFt + rightDoor.widthFt + 0.3) * scale}
                    stroke="#0284c7"
                    strokeWidth="3"
                  />
                  {/* Right Door Threshold */}
                  <rect
                    x={-3}
                    y={rightDoor.startFt * scale}
                    width={6}
                    height={rightDoor.widthFt * scale}
                    fill="#0ea5e9"
                    fillOpacity="0.25"
                    stroke="#0ea5e9"
                    strokeWidth="1.5"
                  />

                  {/* Dual Sliding Leaves (Biparting) */}
                  <rect
                    x={-7}
                    y={(rightDoor.startFt + 0.1) * scale}
                    width={5}
                    height={(rightDoor.widthFt * 0.46) * scale}
                    rx="1.5"
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={-4}
                    y={(rightDoor.startFt + rightDoor.widthFt * 0.53) * scale}
                    width={5}
                    height={(rightDoor.widthFt * 0.46) * scale}
                    rx="1.5"
                    fill="#0369a1"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />

                  {/* Biparting Slide Arrows */}
                  <line
                    x1={-15}
                    y1={(rightDoor.startFt + rightDoor.widthFt * 0.46) * scale}
                    x2={-15}
                    y2={(rightDoor.startFt + 0.4) * scale}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    markerEnd="url(#slideArrowBlue)"
                  />
                  <line
                    x1={-15}
                    y1={(rightDoor.startFt + rightDoor.widthFt * 0.54) * scale}
                    x2={-15}
                    y2={(rightDoor.startFt + rightDoor.widthFt - 0.4) * scale}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    markerEnd="url(#slideArrowBlue)"
                  />
                  <text
                    x={-24}
                    y={(rightDoor.startFt + rightDoor.widthFt / 2) * scale}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="8"
                    fontWeight="700"
                    fontFamily="monospace"
                    transform={`rotate(-90, -24, ${(rightDoor.startFt + rightDoor.widthFt / 2) * scale})`}
                  >
                    ⟵ SLIDE OPEN ⟶
                  </text>

                  <text
                    x={14}
                    y={(rightDoor.startFt + rightDoor.widthFt / 2) * scale}
                    fill="#38bdf8"
                    fontSize="9"
                    fontWeight="700"
                    transform={`rotate(90, 14, ${(rightDoor.startFt + rightDoor.widthFt / 2) * scale})`}
                    textAnchor="middle"
                  >
                    IT DEPT DOOR (DOUBLE SLIDING DOORS · 6 TILES)
                  </text>
                </>
              ) : (
                <line x1={0} y1={0} x2={0} y2={roomConfig.lengthFt * scale} stroke="#64748b" strokeWidth="5" />
              )}
            </g>

            {/* Furniture Items */}
            {items.map((item) => {
              const isSelected = item.id === selectedItemId;
              const isExec = item.type === 'executive_desk';
              const isStaff = item.type === 'staff_desk';
              const isStorage = item.type === 'bookshelf';
              const isPlant = item.type === 'plant';
              const isFlowerBase = isPlant && (item.id.includes('flower') || item.name.toLowerCase().includes('flower') || item.label.includes('Flower') || item.label.includes('🌸'));
              const isCactusBase = isPlant && (item.id.includes('cactus') || item.name.toLowerCase().includes('cactus') || item.label.includes('Cactus') || item.label.includes('🌵') || item.id === 'plant_2');

              // Check if this item is currently blocking any door
              const blockInfo = checkItemDoorBlockage(item, roomConfig.doors);
              const isBlocked = blockInfo.isBlocked;

              const boundW = item.rotation % 180 === 0 ? item.width : item.length;
              const boundL = item.rotation % 180 === 0 ? item.length : item.width;
              const pxW = item.width * scale;
              const pxL = item.length * scale;
              const pxX = item.x * scale;
              const pxY = item.y * scale;

              return (
                <g
                  key={item.id}
                  transform={`translate(${pxX + (boundW * scale) / 2}, ${pxY + (boundL * scale) / 2}) rotate(${item.rotation || 0}) translate(${-pxW / 2}, ${-pxL / 2})`}
                  onPointerDown={(e) => handleItemPointerDown(e, item)}
                  className="cursor-move group"
                >
                  {/* Chair Pull-Out Clearance Zone (Desk 2.0 + Chair 2.5 = 4.5 Tiles Total Module) */}
                  {showClearance && (isExec || isStaff) && (
                    <rect
                      x={-2}
                      y={pxL}
                      width={pxW + 4}
                      height={2.5 * scale}
                      fill="#3b82f6"
                      fillOpacity="0.08"
                      stroke="#3b82f6"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      rx="3"
                      className="pointer-events-none"
                    />
                  )}

                  {/* Main Furniture Body */}
                  <rect
                    x={0}
                    y={0}
                    width={pxW}
                    height={pxL}
                    rx={isExec ? 4 : isFlowerBase || isCactusBase ? 8 : 2}
                    fill={
                      isBlocked
                        ? '#dc2626'
                        : isExec
                        ? '#d97706'
                        : isStaff
                        ? '#1d4ed8'
                        : isStorage
                        ? '#78350f'
                        : isFlowerBase
                        ? '#db2777'
                        : isCactusBase
                        ? '#047857'
                        : '#15803d'
                    }
                    fillOpacity={isBlocked ? 0.9 : 0.85}
                    stroke={
                      isBlocked
                        ? '#ef4444'
                        : isSelected
                        ? '#fbbf24'
                        : isExec
                        ? '#f59e0b'
                        : isStaff
                        ? '#60a5fa'
                        : isFlowerBase
                        ? '#f472b6'
                        : isCactusBase
                        ? '#34d399'
                        : '#94a3b8'
                    }
                    strokeWidth={isBlocked ? 3 : isSelected ? 2.5 : 1.5}
                    strokeDasharray={isBlocked ? '4 2' : 'none'}
                    className="transition-all"
                  />

                  {/* Wood Grain Bevel */}
                  <rect
                    x={2}
                    y={2}
                    width={Math.max(0, pxW - 4)}
                    height={Math.max(0, pxL - 4)}
                    rx={isFlowerBase || isCactusBase ? 6 : 2}
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity={isBlocked ? '0.4' : '0.2'}
                    strokeWidth="1"
                  />

                  {/* Monogram / Dimension Label */}
                  <text
                    x={pxW / 2}
                    y={pxL / 2 - (isExec ? 6 : 2)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#ffffff"
                    fontSize={isExec ? '10' : '9'}
                    fontWeight="700"
                    fontFamily="monospace"
                    className="pointer-events-none drop-shadow-md"
                  >
                    {isBlocked
                      ? '⚠️ DOOR BLOCKED'
                      : isExec
                      ? 'BIG TABLE'
                      : isStorage
                      ? item.length >= 4.5 || (Boolean(item.height) && (item.height || 0) >= 5.0)
                        ? 'BIG SHELF (5×1.5 ft)'
                        : 'SHELF (3×1.5 ft)'
                      : isFlowerBase
                      ? '🌸 FLOWER BASE'
                      : isCactusBase
                      ? '🌵 CACTUS BASE'
                      : item.label.split('(')[0].trim()}
                  </text>

                  {/* Sub-label: Dimensions in Tiles / Feet */}
                  <text
                    x={pxW / 2}
                    y={pxL / 2 + (isExec ? 8 : 9)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isBlocked ? '#fecaca' : isExec ? '#fef3c7' : isStorage ? '#fed7aa' : isFlowerBase ? '#fbcfe8' : isCactusBase ? '#a7f3d0' : '#bfdbfe'}
                    fontSize="8"
                    fontWeight="600"
                    fontFamily="monospace"
                    className="pointer-events-none"
                  >
                    {isExec
                      ? '4.5 × 3.0 tiles'
                      : isStorage
                      ? item.length >= 4.5 || (Boolean(item.height) && (item.height || 0) >= 5.0)
                        ? '6.0 ft height · 5 tiers'
                        : '3.0 ft height · 3 tiers'
                      : isFlowerBase
                      ? 'Left Corner'
                      : isCactusBase
                      ? 'Corner Decor'
                      : isPlant
                      ? 'Decor'
                      : '3.5 × 2.0 tiles'}
                  </text>

                  {/* Ergonomic Task Chair */}
                  {(isExec || isStaff) && (
                    <g transform={`translate(${pxW / 2}, ${pxL + 0.9 * scale})`} className="pointer-events-none">
                      {/* Chair 5-Star Base */}
                      <circle cx={0} cy={0} r={0.6 * scale} fill="#0f172a" stroke="#475569" strokeWidth="1" />
                      {/* Seat Cushion */}
                      <rect
                        x={-0.65 * scale}
                        y={-0.6 * scale}
                        width={1.3 * scale}
                        height={1.1 * scale}
                        rx="4"
                        fill={isExec ? '#451a03' : '#1e293b'}
                        stroke={isExec ? '#d97706' : '#3b82f6'}
                        strokeWidth="1"
                      />
                      {/* Lumbar Backrest */}
                      <path
                        d={`M ${-0.7 * scale},${-0.6 * scale} Q 0,${-0.85 * scale} ${0.7 * scale},${-0.6 * scale}`}
                        fill="none"
                        stroke={isExec ? '#f59e0b' : '#60a5fa'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </g>
                  )}

                  {/* Visitor Chairs on Executive Desk (Only if visitorChairs > 0) */}
                  {Boolean(item.visitorChairs && item.visitorChairs > 0) && (
                    <g className="pointer-events-none">
                      {[-0.9 * scale, 0.9 * scale].map((xOffset, vIdx) => (
                        <g key={`v-${vIdx}`} transform={`translate(${pxW / 2 + xOffset}, ${-0.8 * scale})`}>
                          <rect
                            x={-0.5 * scale}
                            y={-0.5 * scale}
                            width={1.0 * scale}
                            height={0.9 * scale}
                            rx="3"
                            fill="#334155"
                            stroke="#64748b"
                            strokeWidth="1"
                          />
                          <path
                            d={`M ${-0.5 * scale},${0.4 * scale} Q 0,${0.6 * scale} ${0.5 * scale},${0.4 * scale}`}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </g>
                      ))}
                    </g>
                  )}

                  {/* Selection Indicator Ring */}
                  {isSelected && (
                    <rect
                      x={-4}
                      y={-4}
                      width={pxW + 8}
                      height={pxL + 8}
                      rx={6}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Quick Action Pill for Selected Furniture */}
        {selectedItem && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-slate-700/80 rounded-full px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-200">
              {selectedItem.label}
            </span>
            <span className="text-slate-500">|</span>
            <span className="font-mono text-slate-400">
              X:{selectedItem.x.toFixed(1)} Y:{selectedItem.y.toFixed(1)} ft
            </span>

            <div className="h-3 w-px bg-slate-700" />

            <button
              onClick={handleRotateSelected}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-400" />
            </button>

            <button
              onClick={() => onDeleteItem(selectedItem.id)}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
              title="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

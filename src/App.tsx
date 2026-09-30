import React, { useState, useEffect, useMemo } from 'react';
import { 
  FurnitureItem, 
  LayoutPreset, 
  RoomConfig, 
  ViewMode, 
  CameraPreset, 
  LightingMode 
} from './types/office';
import { DEFAULT_ROOM_CONFIG, SWAPPED_ROOM_CONFIG, LAYOUT_PRESETS } from './constants/presets';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FloorPlan2D } from './components/FloorPlan2D';
import { ThreeRoom3D } from './components/ThreeRoom3D';
import { WorkflowReport } from './components/WorkflowReport';
import { Check, Save, Undo2, Redo2 } from 'lucide-react';
import { useLayoutHistory } from './hooks/useLayoutHistory';

const STORAGE_KEY = 'office_studio_layout_v1';

export default function App() {
  const initialRoomConfig = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.roomConfig && parsed.roomConfig.doors) return parsed.roomConfig;
      }
    } catch {}
    return DEFAULT_ROOM_CONFIG;
  }, []);

  const [activePreset, setActivePreset] = useState<LayoutPreset>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activePresetId) {
          const found = LAYOUT_PRESETS.find((p) => p.id === parsed.activePresetId);
          if (found) return found;
        }
      }
    } catch {}
    return LAYOUT_PRESETS[0];
  });

  const initialItems = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) return parsed.items;
      }
    } catch {}
    return LAYOUT_PRESETS[0].items;
  }, []);

  // Use state history hook for full Undo/Redo mechanism
  const {
    items,
    roomConfig,
    setRoomConfig,
    pushState,
    updateLiveItems,
    startDragOperation,
    endDragOperation,
    undo,
    redo,
    resetHistory,
    canUndo,
    canRedo,
    lastActionMessage,
  } = useLayoutHistory(initialItems, initialRoomConfig, STORAGE_KEY);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // View state - sidebar closed by default for maximum unobstructed view!
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [lightingMode, setLightingMode] = useState<LightingMode>('natural_daylight');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [snapGrid, setSnapGrid] = useState<0.5 | 1.0 | 0>(1.0);

  // Save current layout to localStorage
  const handleSaveLayout = () => {
    try {
      const payload = {
        items,
        roomConfig,
        activePresetId: activePreset.id,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setSaveToast('✓ Layout changes saved successfully!');
      setTimeout(() => setSaveToast(null), 3000);
    } catch (e) {
      console.error('Failed to save layout:', e);
      setSaveToast('Failed to save layout');
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  // Handle preset selection
  const handleSelectPreset = (preset: LayoutPreset) => {
    setActivePreset(preset);
    resetHistory(preset.items, roomConfig, `Loaded ${preset.name}`);
    setSelectedItemId(null);
  };

  // Handle resetting layout to current preset defaults
  const handleResetLayout = () => {
    resetHistory(activePreset.items, roomConfig, `Reset to ${activePreset.name}`);
    setSelectedItemId(null);
    try {
      const payload = {
        items: activePreset.items,
        roomConfig,
        activePresetId: activePreset.id,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
    setSaveToast('↺ Layout reset to defaults');
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Toggle Left vs Right door positions
  const handleToggleDoorSides = () => {
    const isRightDouble = roomConfig.doors.some(
      (d) => d.wall === 'right' && (d.type === 'double_glass' || d.type === 'double_sliding' || d.widthFt >= 5.0)
    );
    if (isRightDouble) {
      const swappedPreset = LAYOUT_PRESETS.find((p) => p.id === 'mirrored_left_double') || LAYOUT_PRESETS[2];
      setActivePreset(swappedPreset);
      pushState(swappedPreset.items, SWAPPED_ROOM_CONFIG, 'Swapped Door Sides');
    } else {
      setActivePreset(LAYOUT_PRESETS[0]);
      pushState(LAYOUT_PRESETS[0].items, DEFAULT_ROOM_CONFIG, 'Reset Door Sides');
    }
    setSelectedItemId(null);
  };

  // Toggle Main Door between Corner and Center
  const handleToggleMainDoorCorner = () => {
    const frontDoor = roomConfig.doors.find((d) => d.wall === 'front');
    if (!frontDoor) return;
    const isCorner = frontDoor.startFt > 8.0;
    const newStartFt = isCorner ? 6.0 : 10.2;
    const newName = isCorner
      ? 'Front 3-Tile Main Sliding Door (Slide Open)'
      : 'Corner 3-Tile Main Sliding Door (Slide Open · by Cactus Base)';

    const newConfig: RoomConfig = {
      ...roomConfig,
      doors: roomConfig.doors.map((d) =>
        d.wall === 'front' ? { ...d, startFt: newStartFt, widthFt: 3.0, name: newName, isSliding: true } : d
      ),
    };

    pushState(items, newConfig, isCorner ? 'Moved Door to Center' : 'Moved Door to Corner');
  };

  // Update item (with live continuous move vs committed action support)
  const handleUpdateItem = (updated: FurnitureItem, actionName?: string) => {
    if (actionName) {
      const updatedList = items.map((item) => (item.id === updated.id ? updated : item));
      pushState(updatedList, undefined, actionName);
    } else {
      updateLiveItems(items.map((item) => (item.id === updated.id ? updated : item)));
    }
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    const deletedItem = items.find((i) => i.id === id);
    const updatedList = items.filter((item) => item.id !== id);
    pushState(
      updatedList,
      undefined,
      `Deleted ${deletedItem?.label?.split('(')[0]?.trim() || deletedItem?.name || 'Furniture'}`
    );
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // Add new item
  const handleAddItem = (type: 'staff_desk' | 'executive_desk' | 'bookshelf' | 'plant') => {
    const isExec = type === 'executive_desk';
    const isStaff = type === 'staff_desk';
    const isBook = type === 'bookshelf';

    const count = items.filter((i) => i.type === type).length + 1;
    const newItem: FurnitureItem = {
      id: `${type}_${Date.now()}`,
      name: isExec
        ? `Executive Table ${count}`
        : isStaff
        ? `Workstation 0${count}`
        : isBook
        ? `Storage Shelf 0${count}`
        : `Plant ${count}`,
      type,
      x: isExec ? 7.0 : isBook ? 1.0 : 6.0,
      y: isExec ? 15.0 : isBook ? 16.0 : 4.0 + (count * 2) % 12,
      width: isExec ? 4.5 : isStaff ? 3.5 : isBook ? 1.5 : 1.2,
      length: isExec ? 3.0 : isStaff ? 2.0 : isBook ? 3.0 : 1.2,
      rotation: 0,
      label: isExec
        ? `Big Table (4.5×3.0 ft)`
        : isStaff
        ? `Desk ${count} (3.5×2.0 ft)`
        : isBook
        ? `Shelf ${count} (3×1.5×3 ft)`
        : `Plant ${count}`,
      assignedRole: isExec ? 'Executive' : isStaff ? 'Team Member' : isBook ? 'Storage' : 'Facility',
      color: isExec ? '#d97706' : isStaff ? '#2563eb' : isBook ? '#78350f' : '#15803d',
      material: isExec ? 'walnut' : isBook ? 'walnut' : 'warm_oak',
      hasChair: isExec || isStaff,
      visitorChairs: 0,
      cableTray: isExec || isStaff,
      notes: isBook ? '3-tier storage shelf: 3.0 ft length × 1.5 ft width × 3.0 ft height' : undefined,
    };

    pushState(
      [...items, newItem],
      undefined,
      `Added ${newItem.label?.split('(')[0]?.trim() || newItem.name}`
    );
    setSelectedItemId(newItem.id);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      {/* Toast Notification */}
      {(saveToast || lastActionMessage) && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-amber-500/60 text-slate-200 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          {saveToast ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Undo2 className="w-4 h-4 text-amber-400" />
          )}
          <span>{saveToast || lastActionMessage}</span>
        </div>
      )}

      {/* Sleek Top Bar */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        onResetLayout={handleResetLayout}
        onSaveLayout={handleSaveLayout}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        lastActionMessage={lastActionMessage}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        itemCount={items.length}
        items={items}
        roomConfig={roomConfig}
      />

      {/* Main Workspace */}
      <div className="flex-1 w-full h-[calc(100vh-3rem)] flex overflow-hidden relative">
        {/* Collapsible Inventory Sidebar (Hidden by default, slides out when toggled) */}
        {viewMode !== 'designer_audit' && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            items={items}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleAddItem}
            onSaveLayout={handleSaveLayout}
          />
        )}

        {/* Center Canvas Viewports (Occupies maximum screen) */}
        <main className="flex-1 h-full relative overflow-hidden flex">
          {/* Split Mode: 2D Blueprint + 3D Spatial */}
          {viewMode === 'split' && (
            <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
              <div className="h-full relative overflow-hidden">
                <FloorPlan2D
                  roomConfig={roomConfig}
                  items={items}
                  circulationPaths={activePreset.circulationPaths}
                  zones={activePreset.zones}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                  onUpdateItem={handleUpdateItem}
                  onDeleteItem={handleDeleteItem}
                  onAddItem={handleAddItem}
                  showHeatmap={showHeatmap}
                  onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
                  snapGrid={snapGrid}
                  onChangeSnapGrid={setSnapGrid}
                  onToggleDoorSides={handleToggleDoorSides}
                  onToggleMainDoorCorner={handleToggleMainDoorCorner}
                  onSaveLayout={handleSaveLayout}
                  onStartDrag={startDragOperation}
                  onEndDrag={endDragOperation}
                  onUndo={undo}
                  onRedo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                />
              </div>

              <div className="h-full relative overflow-hidden">
                <ThreeRoom3D
                  roomConfig={roomConfig}
                  items={items}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                  onUpdateItem={handleUpdateItem}
                  cameraPreset={cameraPreset}
                  onCameraPresetChange={setCameraPreset}
                  lightingMode={lightingMode}
                  onLightingModeChange={setLightingMode}
                />
              </div>
            </div>
          )}

          {/* Full-screen 2D Blueprint */}
          {viewMode === '2d_blueprint' && (
            <div className="w-full h-full relative overflow-hidden">
              <FloorPlan2D
                roomConfig={roomConfig}
                items={items}
                circulationPaths={activePreset.circulationPaths}
                zones={activePreset.zones}
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={handleAddItem}
                showHeatmap={showHeatmap}
                onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
                snapGrid={snapGrid}
                onChangeSnapGrid={setSnapGrid}
                onToggleDoorSides={handleToggleDoorSides}
                onToggleMainDoorCorner={handleToggleMainDoorCorner}
                onSaveLayout={handleSaveLayout}
                onStartDrag={startDragOperation}
                onEndDrag={endDragOperation}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            </div>
          )}

          {/* Full-screen 3D Spatial */}
          {viewMode === '3d_spatial' && (
            <div className="w-full h-full relative overflow-hidden">
              <ThreeRoom3D
                roomConfig={roomConfig}
                items={items}
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
                onUpdateItem={handleUpdateItem}
                cameraPreset={cameraPreset}
                onCameraPresetChange={setCameraPreset}
                lightingMode={lightingMode}
                onLightingModeChange={setLightingMode}
              />
            </div>
          )}

          {/* Designer Workflow & Audit Report */}
          {viewMode === 'designer_audit' && (
            <WorkflowReport
              roomConfig={roomConfig}
              activePreset={activePreset}
              items={items}
            />
          )}
        </main>
      </div>
    </div>
  );
}

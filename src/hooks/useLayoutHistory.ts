import { useState, useCallback, useRef, useEffect } from 'react';
import { FurnitureItem, RoomConfig } from '../types/office';

export interface LayoutSnapshot {
  items: FurnitureItem[];
  roomConfig: RoomConfig;
  actionName?: string;
  timestamp: number;
}

const MAX_HISTORY_LENGTH = 50;

export function useLayoutHistory(
  initialItems: FurnitureItem[],
  initialRoomConfig: RoomConfig,
  storageKey: string = 'office_studio_layout_v1'
) {
  // We keep a history stack of snapshots
  const [history, setHistory] = useState<LayoutSnapshot[]>([
    {
      items: initialItems,
      roomConfig: initialRoomConfig,
      actionName: 'Initial Layout',
      timestamp: Date.now(),
    },
  ]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  // Live state currently rendered
  const [items, setItems] = useState<FurnitureItem[]>(initialItems);
  const [roomConfig, setRoomConfig] = useState<RoomConfig>(initialRoomConfig);

  // Ref to track drag start state for drag commit
  const dragStartItemsRef = useRef<FurnitureItem[] | null>(null);

  // Sync state when currentIndex changes (via undo/redo)
  const isUndoRedoRef = useRef<boolean>(false);

  // Push new state into history stack
  const pushState = useCallback(
    (newItems: FurnitureItem[], newRoomConfig?: RoomConfig, actionName?: string) => {
      const configToUse = newRoomConfig || roomConfig;

      // Update live state
      setItems(newItems);
      if (newRoomConfig) {
        setRoomConfig(newRoomConfig);
      }

      setHistory((prev) => {
        // Cut off any redo future after current index
        const newHistory = prev.slice(0, currentIndex + 1);
        const snapshot: LayoutSnapshot = {
          items: newItems.map((item) => ({ ...item })),
          roomConfig: { ...configToUse, doors: configToUse.doors.map((d) => ({ ...d })) },
          actionName: actionName || 'Modified Layout',
          timestamp: Date.now(),
        };

        const updated = [...newHistory, snapshot];
        if (updated.length > MAX_HISTORY_LENGTH) {
          return updated.slice(updated.length - MAX_HISTORY_LENGTH);
        }
        return updated;
      });

      setCurrentIndex((prev) => {
        const nextIdx = Math.min(prev + 1, MAX_HISTORY_LENGTH - 1);
        return nextIdx;
      });

      if (actionName) {
        setLastActionMessage(actionName);
        setTimeout(() => setLastActionMessage((curr) => (curr === actionName ? null : curr)), 2000);
      }
    },
    [currentIndex, roomConfig]
  );

  // Set items live during continuous dragging without cluttering history
  const updateLiveItems = useCallback((newItems: FurnitureItem[]) => {
    setItems(newItems);
  }, []);

  // When drag starts, record baseline snapshot
  const startDragOperation = useCallback((currentItems: FurnitureItem[]) => {
    dragStartItemsRef.current = currentItems.map((i) => ({ ...i }));
  }, []);

  // When drag ends, commit if items actually moved
  const endDragOperation = useCallback(
    (finalItems: FurnitureItem[], actionName?: string) => {
      if (!dragStartItemsRef.current) return;
      const baseline = dragStartItemsRef.current;
      dragStartItemsRef.current = null;

      // Check if anything actually changed in coordinates
      const hasChanged = finalItems.some((item) => {
        const orig = baseline.find((b) => b.id === item.id);
        if (!orig) return true;
        return (
          orig.x !== item.x ||
          orig.y !== item.y ||
          orig.rotation !== item.rotation ||
          orig.width !== item.width ||
          orig.length !== item.length
        );
      });

      if (hasChanged) {
        pushState(finalItems, undefined, actionName || 'Moved Furniture');
      }
    },
    [pushState]
  );

  // Undo action
  const undo = useCallback(() => {
    if (currentIndex <= 0) return false;
    const targetIndex = currentIndex - 1;
    const targetSnapshot = history[targetIndex];
    if (!targetSnapshot) return false;

    isUndoRedoRef.current = true;
    setCurrentIndex(targetIndex);
    setItems(targetSnapshot.items.map((i) => ({ ...i })));
    setRoomConfig({
      ...targetSnapshot.roomConfig,
      doors: targetSnapshot.roomConfig.doors.map((d) => ({ ...d })),
    });

    const msg = `↶ Undo: ${history[currentIndex]?.actionName || 'Action'}`;
    setLastActionMessage(msg);
    setTimeout(() => setLastActionMessage((curr) => (curr === msg ? null : curr)), 2000);
    return true;
  }, [currentIndex, history]);

  // Redo action
  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) return false;
    const targetIndex = currentIndex + 1;
    const targetSnapshot = history[targetIndex];
    if (!targetSnapshot) return false;

    isUndoRedoRef.current = true;
    setCurrentIndex(targetIndex);
    setItems(targetSnapshot.items.map((i) => ({ ...i })));
    setRoomConfig({
      ...targetSnapshot.roomConfig,
      doors: targetSnapshot.roomConfig.doors.map((d) => ({ ...d })),
    });

    const msg = `↷ Redo: ${targetSnapshot.actionName || 'Action'}`;
    setLastActionMessage(msg);
    setTimeout(() => setLastActionMessage((curr) => (curr === msg ? null : curr)), 2000);
    return true;
  }, [currentIndex, history]);

  // Reset entire history (e.g. when picking a new preset or resetting layout)
  const resetHistory = useCallback((newItems: FurnitureItem[], newRoomConfig: RoomConfig, actionName: string = 'Reset Layout') => {
    const freshSnapshot: LayoutSnapshot = {
      items: newItems.map((i) => ({ ...i })),
      roomConfig: { ...newRoomConfig, doors: newRoomConfig.doors.map((d) => ({ ...d })) },
      actionName,
      timestamp: Date.now(),
    };
    setItems(newItems);
    setRoomConfig(newRoomConfig);
    setHistory([freshSnapshot]);
    setCurrentIndex(0);
    setLastActionMessage(actionName);
    setTimeout(() => setLastActionMessage((curr) => (curr === actionName ? null : curr)), 2000);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Y / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
            e.preventDefault();
            redo();
          } else {
            // Undo: Cmd+Z / Ctrl+Z
            e.preventDefault();
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          // Redo: Ctrl+Y
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    items,
    setItems,
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
    historyLength: history.length,
    currentIndex,
    lastActionMessage,
  };
}

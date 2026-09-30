import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FurnitureItem, RoomConfig, CameraPreset, LightingMode } from '../types/office';
import { 
  Sun, 
  Lamp, 
  Moon, 
  RotateCw, 
  Eye
} from 'lucide-react';

interface ThreeRoom3DProps {
  roomConfig: RoomConfig;
  items: FurnitureItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (updated: FurnitureItem) => void;
  cameraPreset: CameraPreset;
  onCameraPresetChange: (preset: CameraPreset) => void;
  lightingMode: LightingMode;
  onLightingModeChange: (mode: LightingMode) => void;
}

export const ThreeRoom3D: React.FC<ThreeRoom3DProps> = ({
  roomConfig,
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  cameraPreset,
  onCameraPresetChange,
  lightingMode,
  onLightingModeChange,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Mesh map
  const furnitureMeshesRef = useRef<Map<string, THREE.Group>>(new Map());

  // Lighting references
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const ceilingLightsRef = useRef<THREE.PointLight[]>([]);

  // Camera animation target
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(12, 16, 22));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(7.5, 2, 10.5));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(7.5, 2, 10.5));

  // Orbit controls state
  const isInteracting = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const spherical = useRef({ radius: 24, theta: Math.PI / 4, phi: Math.PI / 3.2 });

  // Walk-through mode state
  const [isWalkMode, setIsWalkMode] = useState(false);
  const walkPos = useRef<THREE.Vector3>(new THREE.Vector3(2.5, 5.0, 3.0));
  const walkYaw = useRef<number>(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Generate procedural tile texture for floor with ultra-visible crisp tile grid
  const createTileTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Polished architectural porcelain tile base matching user photo
    ctx.fillStyle = '#dfd8cc';
    ctx.fillRect(0, 0, 512, 512);

    // Inner tile bevel
    ctx.fillStyle = '#ebe5dc';
    ctx.fillRect(16, 16, 480, 480);

    // High-contrast outer grout border
    ctx.strokeStyle = '#7c7365';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 498, 498);

    // Deep dark grout line core for sharp definition
    ctx.strokeStyle = '#4a4235';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 508);

    // Subtle porcelain speckle
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(Math.random() * 470 + 20, Math.random() * 470 + 20, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(roomConfig.widthFt, roomConfig.lengthFt);
    texture.anisotropy = 16;
    return texture;
  };

  // Build the architectural shell
  const buildArchitecturalShell = (scene: THREE.Scene) => {
    const W = roomConfig.widthFt;
    const L = roomConfig.lengthFt;
    const H = roomConfig.heightFt;

    // 1. Floor Slab (Beige ceramic 1x1 ft tiles matching photo)
    const floorGeo = new THREE.PlaneGeometry(W, L);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createTileTexture(),
      roughness: 0.35,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(W / 2, 0, L / 2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 2. Open Ceiling (Kept open for clear unobstructed isometric and top-down camera views)

    // 3. Left Wall (X = 0)
    const solidWallMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.85,
    });
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
      transmission: 0.96,
      ior: 1.5,
    });
    const glassDoorLeafMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0.15,
      transparent: true,
      opacity: 0.30,
      transmission: 0.94,
      ior: 1.5,
    });

    const leftDoor = roomConfig.doors.find((d) => d.wall === 'left');
    const rightDoor = roomConfig.doors.find((d) => d.wall === 'right');
    const frontDoor = roomConfig.doors.find((d) => d.wall === 'front');

    // Helper to generate architectural door signage plaques
    const createDoorSignMesh = (title: string, subtitle: string, style: 'wood' | 'black' | 'glass') => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 140;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (style === 'wood') {
          ctx.fillStyle = '#2b1608';
        } else if (style === 'black') {
          ctx.fillStyle = '#090d16';
        } else {
          ctx.fillStyle = '#0b192c';
        }
        ctx.fillRect(0, 0, 512, 140);

        ctx.lineWidth = 8;
        ctx.strokeStyle = style === 'wood' ? '#d97706' : style === 'black' ? '#10b981' : '#38bdf8';
        ctx.strokeRect(4, 4, 504, 132);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.strokeRect(12, 12, 488, 116);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, 256, 50);

        ctx.fillStyle = style === 'wood' ? '#fbbf24' : style === 'black' ? '#34d399' : '#7dd3fc';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(subtitle, 256, 96);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.65, 0.04),
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.3,
          metalness: 0.2,
        })
      );
      return sign;
    };

    // Build Left Wall (X = 0)
    if (leftDoor) {
      const isDouble = leftDoor.type === 'double_glass' || leftDoor.type === 'double_sliding';
      const dStart = leftDoor.startFt;
      const dWidth = leftDoor.widthFt;
      const dEnd = dStart + dWidth;

      // Segment 1 (0 to dStart)
      const seg1 = new THREE.Mesh(new THREE.PlaneGeometry(dStart, H), isDouble ? glassMat : solidWallMat);
      seg1.rotation.y = Math.PI / 2;
      seg1.position.set(0, H / 2, dStart / 2);
      scene.add(seg1);

      // Segment 2 (dEnd to L)
      const seg2 = new THREE.Mesh(new THREE.PlaneGeometry(L - dEnd, H), isDouble ? glassMat : solidWallMat);
      seg2.rotation.y = Math.PI / 2;
      seg2.position.set(0, H / 2, dEnd + (L - dEnd) / 2);
      scene.add(seg2);

      // Header above door
      const headerMat = isDouble
        ? new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 })
        : solidWallMat;
      const header = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, H - 7.5, dWidth),
        headerMat
      );
      header.position.set(0.06, 7.5 + (H - 7.5) / 2, dStart + dWidth / 2);
      scene.add(header);

      // Admin Dept Signboard above Left door
      const adminSign = createDoorSignMesh('ADMIN DEPT', 'TRANSPARENT GLASS SLIDING DOOR', 'glass');
      adminSign.rotation.y = Math.PI / 2;
      adminSign.position.set(0.1, 7.85, dStart + dWidth / 2);
      scene.add(adminSign);

      // Door threshold
      const dThreshold = new THREE.Mesh(
        new THREE.PlaneGeometry(dWidth, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      dThreshold.rotation.x = -Math.PI / 2;
      dThreshold.rotation.z = Math.PI / 2;
      dThreshold.position.set(0.2, 0.01, dStart + dWidth / 2);
      scene.add(dThreshold);

      // Transparent Sliding Glass Door (like IT Dept door)
      const track = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, dWidth * 1.6),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 })
      );
      track.position.set(0.06, 7.35, dStart + dWidth * 0.6);
      scene.add(track);

      // Pure transparent sliding glass door leaf
      const doorLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 7.2, dWidth * 0.95),
        glassDoorLeafMat
      );
      doorLeaf.position.set(0.07, 3.6, dStart + dWidth * 0.45);
      scene.add(doorLeaf);

      // Chrome vertical handle
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 2.4, 16),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
      );
      handle.position.set(0.13, 3.5, dStart + dWidth * 0.82);
      scene.add(handle);
    }

    // Whiteboard past Left Door (Z = 13.0 to 18.0 ft)
    const wbGeo = new THREE.BoxGeometry(0.08, 3.2, 5.0);
    const wbMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.2,
      metalness: 0.1,
    });
    const wbMesh = new THREE.Mesh(wbGeo, wbMat);
    wbMesh.position.set(0.05, 5.2, 14.5);
    scene.add(wbMesh);

    // 5. Far Window Wall (Z = L) with Vertical Blinds
    const winWallGeo = new THREE.PlaneGeometry(W, H);
    const winWallMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.7,
    });
    const winWallMesh = new THREE.Mesh(winWallGeo, winWallMat);
    winWallMesh.rotation.y = Math.PI;
    winWallMesh.position.set(W / 2, H / 2, L);
    scene.add(winWallMesh);

    // Window Glass
    const windowFrameGeo = new THREE.BoxGeometry(W * 0.85, H * 0.75, 0.1);
    const windowGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xcfe8ff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      transmission: 0.9,
    });
    const windowMesh = new THREE.Mesh(windowFrameGeo, windowGlassMat);
    windowMesh.position.set(W / 2, H * 0.5, L - 0.02);
    scene.add(windowMesh);

    // 3D Vertical Blinds
    const blindCount = 28;
    const blindWidth = (W * 0.82) / blindCount;
    for (let i = 0; i < blindCount; i++) {
      const slatGeo = new THREE.BoxGeometry(blindWidth * 0.9, H * 0.72, 0.02);
      const slatMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        roughness: 0.6,
      });
      const slat = new THREE.Mesh(slatGeo, slatMat);
      slat.position.set(W * 0.09 + i * blindWidth, H * 0.5, L - 0.1);
      slat.rotation.y = 0.25;
      scene.add(slat);
    }

    // Split AC Unit on Window Wall
    const acGeo = new THREE.BoxGeometry(3.2, 0.9, 0.7);
    const acMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const acMesh = new THREE.Mesh(acGeo, acMat);
    acMesh.position.set(W * 0.5, H - 0.7, L - 0.35);
    scene.add(acMesh);

    // 6. Right Wall (X = W)
    if (rightDoor) {
      const isDouble = rightDoor.type === 'double_glass' || rightDoor.type === 'double_sliding' || rightDoor.widthFt >= 5.0;
      const dStart = rightDoor.startFt;
      const dWidth = rightDoor.widthFt;
      const dEnd = dStart + dWidth;

      // Segment 1 (0 to dStart)
      const seg1 = new THREE.Mesh(new THREE.PlaneGeometry(dStart, H), isDouble ? glassMat : solidWallMat);
      seg1.rotation.y = -Math.PI / 2;
      seg1.position.set(W, H / 2, dStart / 2);
      scene.add(seg1);

      // Segment 2 (dEnd to L)
      const seg2 = new THREE.Mesh(new THREE.PlaneGeometry(L - dEnd, H), isDouble ? glassMat : solidWallMat);
      seg2.rotation.y = -Math.PI / 2;
      seg2.position.set(W, H / 2, dEnd + (L - dEnd) / 2);
      scene.add(seg2);

      // Header above door
      const headerMat = isDouble
        ? new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 })
        : solidWallMat;
      const header = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, H - 7.5, dWidth),
        headerMat
      );
      header.position.set(W - 0.06, 7.5 + (H - 7.5) / 2, dStart + dWidth / 2);
      scene.add(header);

      // IT Dept Signboard above Right double sliding doors
      const itSign = createDoorSignMesh('IT DEPT', 'DOUBLE SLIDING GLASS · 6 TILES', 'glass');
      itSign.rotation.y = -Math.PI / 2;
      itSign.position.set(W - 0.1, 7.85, dStart + dWidth / 2);
      scene.add(itSign);

      // Door threshold
      const dThreshold = new THREE.Mesh(
        new THREE.PlaneGeometry(dWidth, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      dThreshold.rotation.x = -Math.PI / 2;
      dThreshold.rotation.z = Math.PI / 2;
      dThreshold.position.set(W - 0.2, 0.01, dStart + dWidth / 2);
      scene.add(dThreshold);

      if (isDouble) {
        // Double sliding glass doors
        const track = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.15, dWidth + 0.2),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 })
        );
        track.position.set(W - 0.06, 7.4, dStart + dWidth / 2);
        scene.add(track);

        const leaf1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 7.2, dWidth * 0.45), glassDoorLeafMat);
        leaf1.position.set(W - 0.08, 3.6, dStart + dWidth * 0.25);
        scene.add(leaf1);

        const leaf2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 7.2, dWidth * 0.45), glassDoorLeafMat);
        leaf2.position.set(W - 0.04, 3.6, dStart + dWidth * 0.75);
        scene.add(leaf2);

        // Handles
        [-1, 1].forEach((dir) => {
          const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 2.4),
            new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
          );
          handle.position.set(W - 0.12, 3.5, dStart + dWidth / 2 + dir * 0.6);
          scene.add(handle);
        });
      } else {
        // Single sliding door (Transparent Glass)
        const track = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, dWidth * 1.8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 })
        );
        track.position.set(W - 0.08, 7.35, dStart + dWidth * 0.7);
        scene.add(track);

        const doorLeaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 7.0, dWidth * 0.95),
          glassDoorLeafMat
        );
        doorLeaf.position.set(W - 0.08, 3.5, dStart + dWidth * 0.45);
        scene.add(doorLeaf);

        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 2.4, 16),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
        );
        handle.position.set(W - 0.14, 3.5, dStart + dWidth * 0.82);
        scene.add(handle);
      }
    }

    // 7. Front Wall & Door 1 (Z = 0) - Fully Transparent Glass Partition Wall & Glass Door
    if (frontDoor) {
      const isDouble = frontDoor.type === 'double_glass' || frontDoor.type === 'double_sliding';
      const dStart = frontDoor.startFt;
      const dWidth = frontDoor.widthFt;
      const dEnd = dStart + dWidth;

      // Segment 1 (0 to dStart) - Transparent Glass Partition Wall
      if (dStart > 0.05) {
        const frontSeg1 = new THREE.Mesh(new THREE.PlaneGeometry(dStart, H), glassMat);
        frontSeg1.position.set(dStart / 2, H / 2, 0);
        scene.add(frontSeg1);

        // Architectural aluminum mullion frames
        const bottomMullion = new THREE.Mesh(
          new THREE.BoxGeometry(dStart, 0.15, 0.08),
          doorFrameMat
        );
        bottomMullion.position.set(dStart / 2, 0.075, 0);
        scene.add(bottomMullion);

        const topMullion = new THREE.Mesh(
          new THREE.BoxGeometry(dStart, 0.15, 0.08),
          doorFrameMat
        );
        topMullion.position.set(dStart / 2, H - 0.075, 0);
        scene.add(topMullion);
      }

      // Segment 2 (dEnd to W) - Transparent Glass Partition Wall
      if (W - dEnd > 0.05) {
        const frontSeg2 = new THREE.Mesh(new THREE.PlaneGeometry(W - dEnd, H), glassMat);
        frontSeg2.position.set(dEnd + (W - dEnd) / 2, H / 2, 0);
        scene.add(frontSeg2);

        const bottomMullion = new THREE.Mesh(
          new THREE.BoxGeometry(W - dEnd, 0.15, 0.08),
          doorFrameMat
        );
        bottomMullion.position.set(dEnd + (W - dEnd) / 2, 0.075, 0);
        scene.add(bottomMullion);

        const topMullion = new THREE.Mesh(
          new THREE.BoxGeometry(W - dEnd, 0.15, 0.08),
          doorFrameMat
        );
        topMullion.position.set(dEnd + (W - dEnd) / 2, H - 0.075, 0);
        scene.add(topMullion);
      }

      // Header above door
      const frontHeader = new THREE.Mesh(new THREE.PlaneGeometry(dWidth, H - 7.0), glassMat);
      frontHeader.position.set(dStart + dWidth / 2, 7.0 + (H - 7.0) / 2, 0);
      scene.add(frontHeader);

      // Entry Door Signboard above Front entrance sliding door
      const entrySign = createDoorSignMesh('ENTRY DOOR', 'TRANSPARENT GLASS SLIDING DOOR', 'glass');
      entrySign.position.set(dStart + dWidth / 2, 7.85, 0.12);
      scene.add(entrySign);

      // Threshold
      const d1Threshold = new THREE.Mesh(
        new THREE.PlaneGeometry(dWidth, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      d1Threshold.rotation.x = -Math.PI / 2;
      d1Threshold.position.set(dStart + dWidth / 2, 0.01, 0.2);
      scene.add(d1Threshold);

      // Transparent Sliding Glass Door System (matching IT Dept door)
      const track = new THREE.Mesh(
        new THREE.BoxGeometry(dWidth * 1.6, 0.14, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 })
      );
      track.position.set(dStart + dWidth * 0.4, 7.35, 0.06);
      scene.add(track);

      // Sliding door leaf: 100% Transparent Glass Door
      const doorLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(dWidth * 0.95, 7.2, 0.05),
        glassDoorLeafMat
      );
      doorLeaf.position.set(dStart + dWidth * 0.45, 3.6, 0.07);
      scene.add(doorLeaf);

      // Sleek vertical chrome pull bar
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 2.4, 16),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
      );
      handle.position.set(dStart + dWidth * 0.82, 3.5, 0.13);
      scene.add(handle);
    } else {
      const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glassMat);
      frontWall.position.set(W / 2, H / 2, 0);
      scene.add(frontWall);
    }

    // Ceiling Lights (Invisible lighting sources without obstructing meshes for crystal-clear room visibility)
    const trofferPositions = [
      [W * 0.35, H - 0.2, L * 0.25],
      [W * 0.7, H - 0.2, L * 0.45],
      [W * 0.5, H - 0.2, L * 0.75],
    ];

    trofferPositions.forEach((pos) => {
      const pLight = new THREE.PointLight(0xfffaed, 0.7, 18);
      pLight.position.set(pos[0], pos[1], pos[2]);
      scene.add(pLight);
      ceilingLightsRef.current.push(pLight);
    });
  };

  // Build high-fidelity 3D procedural furniture objects
  const buildFurnitureGroup = (item: FurnitureItem, isSelected: boolean): THREE.Group => {
    const group = new THREE.Group();
    group.name = item.id;

    const deskH = 2.5;
    const isExec = item.type === 'executive_desk';
    const isStaff = item.type === 'staff_desk';
    const isBookshelf = item.type === 'bookshelf';
    const isPlant = item.type === 'plant';

    const woodColor = isExec
      ? 0x3e2723
      : item.material === 'warm_oak'
      ? 0xd4a373
      : 0xe2d4c0;

    const deskTopMat = new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.4,
      metalness: 0.05,
    });

    const metalLegMat = new THREE.MeshStandardMaterial({
      color: isExec ? 0x27272a : 0x3f3f46,
      metalness: 0.8,
      roughness: 0.25,
    });

    if (isExec || isStaff) {
      // Desktop
      const topGeo = new THREE.BoxGeometry(item.width, 0.12, item.length);
      const topMesh = new THREE.Mesh(topGeo, deskTopMat);
      topMesh.position.set(0, deskH, 0);
      topMesh.castShadow = true;
      group.add(topMesh);

      // Legs
      const legThickness = isExec ? 0.16 : 0.1;
      const legGeo = new THREE.BoxGeometry(legThickness, deskH, legThickness);
      const halfW = item.width / 2 - 0.15;
      const halfL = item.length / 2 - 0.15;

      const legPositions = [
        [-halfW, deskH / 2, -halfL],
        [halfW, deskH / 2, -halfL],
        [-halfW, deskH / 2, halfL],
        [halfW, deskH / 2, halfL],
      ];

      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, metalLegMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });

      // Modesty panel
      const modestyGeo = new THREE.BoxGeometry(item.width - 0.3, deskH * 0.65, 0.05);
      const modestyMat = new THREE.MeshStandardMaterial({
        color: isExec ? 0x27272a : 0x52525b,
        roughness: 0.6,
      });
      const modesty = new THREE.Mesh(modestyGeo, modestyMat);
      modesty.position.set(0, deskH * 0.6, -halfL + 0.1);
      group.add(modesty);

      // Under-desk cable tray
      const trayGeo = new THREE.BoxGeometry(item.width * 0.75, 0.15, 0.3);
      const trayMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.7 });
      const tray = new THREE.Mesh(trayGeo, trayMat);
      tray.position.set(0, deskH - 0.2, 0);
      group.add(tray);

      // Monitors
      if (isExec) {
        const blotter = new THREE.Mesh(
          new THREE.BoxGeometry(item.width * 0.6, 0.02, item.length * 0.55),
          new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 })
        );
        blotter.position.set(0, deskH + 0.07, 0.1);
        group.add(blotter);

        const screen = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.2, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 })
        );
        screen.position.set(0, deskH + 1.1, -0.7);

        const display = new THREE.Mesh(
          new THREE.PlaneGeometry(2.3, 1.1),
          new THREE.MeshBasicMaterial({ color: 0x0284c7 })
        );
        display.position.set(0, 0, 0.035);
        screen.add(display);
        group.add(screen);

        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5), metalLegMat);
        stand.position.set(0, deskH + 0.3, -0.7);
        group.add(stand);
      } else {
        const screen = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 0.95, 0.04),
          new THREE.MeshStandardMaterial({ color: 0x18181b })
        );
        screen.position.set(0, deskH + 0.9, -0.4);

        const screenFace = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 0.88),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        screenFace.position.set(0, 0, 0.025);
        screen.add(screenFace);
        group.add(screen);
      }

      // Chairs
      if (item.hasChair) {
        const chairGroup = new THREE.Group();
        chairGroup.position.set(0, 0, halfL + 1.2);

        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.7, 0.15, 5),
          new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9 })
        );
        chairGroup.add(base);

        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2), base.material);
        cylinder.position.set(0, 0.65, 0);
        chairGroup.add(cylinder);

        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.2, 1.3),
          new THREE.MeshStandardMaterial({ color: isExec ? 0x78350f : 0x1d4ed8, roughness: 0.8 })
        );
        seat.position.set(0, 1.3, 0);
        chairGroup.add(seat);

        const backH = isExec ? 2.2 : 1.6;
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, backH, 0.1),
          new THREE.MeshStandardMaterial({ color: isExec ? 0x451a03 : 0x1e293b, roughness: 0.7 })
        );
        back.position.set(0, 1.3 + backH / 2, 0.6);
        back.rotation.x = -0.15;
        chairGroup.add(back);

        group.add(chairGroup);
      }

      // Visitor Chairs
      if (item.visitorChairs && item.visitorChairs > 0) {
        [-1.3, 1.3].forEach((vX) => {
          const vChair = new THREE.Group();
          vChair.position.set(vX, 0, -halfL - 1.2);
          vChair.rotation.y = Math.PI;

          const vSeat = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.15, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 })
          );
          vSeat.position.set(0, 1.2, 0);
          vChair.add(vSeat);

          const vBack = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.3, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x334155 })
          );
          vBack.position.set(0, 1.8, 0.55);
          vChair.add(vBack);

          group.add(vChair);
        });
      }
    } else if (isBookshelf) {
      // Custom height or default to 3.0 ft; big executive shelf beside big table is 6.0 ft height (5-tier)
      const isBigExecutiveShelf = item.id === 'bookshelf_1' || item.length >= 4.5 || (Boolean(item.height) && (item.height || 0) >= 5.0);
      const shelfH = item.height || (isBigExecutiveShelf ? 6.0 : 3.0);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.45 });
      const plankMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.35 });
      
      // Main bookshelf body
      const bookMesh = new THREE.Mesh(
        new THREE.BoxGeometry(item.width, shelfH, item.length),
        frameMat
      );
      bookMesh.position.set(0, shelfH / 2, 0);
      group.add(bookMesh);

      // Top counter surface
      const counterTop = new THREE.Mesh(
        new THREE.BoxGeometry(item.width * 1.02, 0.08, item.length * 1.02),
        new THREE.MeshStandardMaterial({ color: 0x5c2b0c, roughness: 0.3, metalness: 0.1 })
      );
      counterTop.position.set(0, shelfH + 0.04, 0);
      group.add(counterTop);

      // Horizontal Shelf Planks (5 for 6.0 ft height, 3 for 3.0 ft height)
      const numPlanks = shelfH >= 5.0 ? 5 : 3;
      for (let s = 1; s <= numPlanks; s++) {
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(item.width * 1.01, 0.06, item.length * 0.96),
          plankMat
        );
        plank.position.set(0, (shelfH / (numPlanks + 1)) * s, 0);
        group.add(plank);
      }

      // Decorative file binders and books on shelves
      const binderColors = [0x1d4ed8, 0xd97706, 0x059669, 0xdc2626, 0x475569];
      const longDim = Math.max(item.width, item.length);
      const isAlongLength = item.length > item.width;
      const numBinders = isBigExecutiveShelf ? 8 : 5;
      const shelfRows = shelfH >= 5.0 ? 4 : 2;
      for (let s = 1; s <= shelfRows; s++) {
        const shelfY = (shelfH / (numPlanks + 1)) * s + 0.35;
        for (let b = 0; b < numBinders; b++) {
          const binderGeo = isAlongLength
            ? new THREE.BoxGeometry(item.width * 0.5, 0.6, 0.16)
            : new THREE.BoxGeometry(0.16, 0.6, item.length * 0.5);
          const binder = new THREE.Mesh(
            binderGeo,
            new THREE.MeshStandardMaterial({ color: binderColors[(s + b) % binderColors.length] })
          );
          const spacing = (longDim * 0.75) / numBinders;
          const posAlong = -longDim * 0.35 + b * spacing + spacing / 2;
          if (isAlongLength) {
            binder.position.set(0, shelfY, posAlong);
          } else {
            binder.position.set(posAlong, shelfY, 0);
          }
          group.add(binder);
        }
      }
    } else if (isPlant) {
      const isFlowerBase =
        item.id.includes('flower') ||
        item.name.toLowerCase().includes('flower') ||
        item.label.toLowerCase().includes('flower') ||
        item.label.includes('🌸');

      const isCactusBase =
        item.id.includes('cactus') ||
        item.name.toLowerCase().includes('cactus') ||
        item.label.toLowerCase().includes('cactus') ||
        item.label.includes('🌵') ||
        item.id === 'plant_2';

      if (isFlowerBase) {
        // 1. Classical Pedestal Base (Marble & Brass Accent)
        const marbleMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.2,
          metalness: 0.05,
        });
        const brassMat = new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          metalness: 0.85,
          roughness: 0.25,
        });

        // Plinth (Floor Base)
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), marbleMat);
        plinth.position.set(0, 0.125, 0);
        group.add(plinth);

        // Lower Brass Ring
        const brassRing1 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.06, 24), brassMat);
        brassRing1.position.set(0, 0.28, 0);
        group.add(brassRing1);

        // Pedestal Column Shaft
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 1.3, 24), marbleMat);
        column.position.set(0, 0.95, 0);
        group.add(column);

        // Upper Brass Capital Ring
        const brassRing2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.35, 0.06, 24), brassMat);
        brassRing2.position.set(0, 1.63, 0);
        group.add(brassRing2);

        // Top Pedestal Display Plate
        const topPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 0.1, 24), marbleMat);
        topPlate.position.set(0, 1.71, 0);
        group.add(topPlate);

        // 2. Elegant Porcelain Flower Vase
        const vaseMat = new THREE.MeshStandardMaterial({
          color: 0x090d16, // Midnight obsidian porcelain
          roughness: 0.08,
          metalness: 0.3,
        });
        const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.16, 1.1, 20), vaseMat);
        vase.position.set(0, 2.3, 0);
        group.add(vase);

        // Vase Golden Lip
        const vaseLip = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.05, 20), brassMat);
        vaseLip.position.set(0, 2.87, 0);
        group.add(vaseLip);

        // 3. Luxurious Floral Bouquet (Blooms & Leaves)
        const petalColors = [0xf43f5e, 0xec4899, 0xd946ef, 0xfbbf24, 0xffffff, 0xf472b6];
        for (let b = 0; b < 14; b++) {
          const flowerGroup = new THREE.Group();
          const pColor = petalColors[b % petalColors.length];
          const bloomMat = new THREE.MeshStandardMaterial({
            color: pColor,
            roughness: 0.4,
          });

          // Blossom core
          const blossom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 1), bloomMat);
          blossom.position.set(0, 0, 0);
          flowerGroup.add(blossom);

          // Flower stem
          const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 })
          );
          stem.position.set(0, -0.38, 0);
          flowerGroup.add(stem);

          // Disperse flowers in an organic rounded dome bouquet
          const angle = (b * Math.PI * 2) / 14 + (b % 3) * 0.2;
          const radius = 0.22 + (b % 3) * 0.1;
          const heightOffset = 2.95 + ((b * 7) % 5) * 0.09;
          flowerGroup.position.set(Math.cos(angle) * radius, heightOffset, Math.sin(angle) * radius);
          flowerGroup.rotation.z = Math.cos(angle) * 0.25;
          flowerGroup.rotation.x = Math.sin(angle) * 0.25;
          group.add(flowerGroup);
        }

        // Surrounding lush green foliage
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
        for (let l = 0; l < 8; l++) {
          const archLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.02), leafMat);
          const lAngle = (l * Math.PI * 2) / 8;
          archLeaf.position.set(Math.cos(lAngle) * 0.35, 2.7, Math.sin(lAngle) * 0.35);
          archLeaf.rotation.y = lAngle;
          archLeaf.rotation.z = 0.6;
          group.add(archLeaf);
        }
      } else if (isCactusBase) {
        // High-Fidelity Architectural Southwestern Cactus Base
        const terraMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.7 });
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
        const soilMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 });
        const cactusMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });

        // 1. Terracotta Pedestal Planter Box
        const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.15, 0.88), terraMat);
        basePlinth.position.set(0, 0.075, 0);
        group.add(basePlinth);

        const potBody = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.8, 0.78), terraMat);
        potBody.position.set(0, 0.55, 0);
        group.add(potBody);

        const brassBand = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.82), brassMat);
        brassBand.position.set(0, 0.85, 0);
        group.add(brassBand);

        const potRim = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.86), terraMat);
        potRim.position.set(0, 0.98, 0);
        group.add(potRim);

        // 2. Soil Bed & Desert Pebbles
        const soil = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.72), soilMat);
        soil.position.set(0, 1.02, 0);
        group.add(soil);

        // Desert stones
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 });
        [[-0.22, -0.2], [0.22, 0.18], [-0.15, 0.22], [0.2, -0.22]].forEach(([px, pz]) => {
          const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045, 1), stoneMat);
          pebble.position.set(px, 1.05, pz);
          group.add(pebble);
        });

        // 3. Tall Multi-Ribbed Saguaro Cactus Body
        const saguaroTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.5, 16), cactusMat);
        saguaroTrunk.position.set(-0.04, 1.8, -0.02);
        group.add(saguaroTrunk);

        const saguaroDome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8), cactusMat);
        saguaroDome.position.set(-0.04, 2.55, -0.02);
        group.add(saguaroDome);

        // Right Saguaro Arm
        const armH1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 12), cactusMat);
        armH1.position.set(0.15, 1.9, -0.02);
        armH1.rotation.z = Math.PI / 2;
        group.add(armH1);

        const armV1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 12), cactusMat);
        armV1.position.set(0.27, 2.15, -0.02);
        group.add(armV1);

        const armCap1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), cactusMat);
        armCap1.position.set(0.27, 2.42, -0.02);
        group.add(armCap1);

        // Left Saguaro Arm (Slightly Lower)
        const armH2 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.22, 12), cactusMat);
        armH2.position.set(-0.21, 1.7, -0.02);
        armH2.rotation.z = -Math.PI / 2;
        group.add(armH2);

        const armV2 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.45, 12), cactusMat);
        armV2.position.set(-0.31, 1.9, -0.02);
        group.add(armV2);

        const armCap2 = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), cactusMat);
        armCap2.position.set(-0.31, 2.12, -0.02);
        group.add(armCap2);

        // 4. Golden Barrel Cactus Companion
        const barrel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), barrelMat);
        barrel.position.set(0.2, 1.15, 0.18);
        barrel.scale.set(1.0, 0.85, 1.0);
        group.add(barrel);

        // 5. Desert Bloom Blossoms
        const yellowBloom = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.08, 1),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 })
        );
        yellowBloom.position.set(-0.04, 2.65, -0.02);
        group.add(yellowBloom);

        const pinkBloom = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.05, 1),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 })
        );
        pinkBloom.position.set(0.2, 1.28, 0.18);
        group.add(pinkBloom);
      } else {
        // Standard Planter
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.35, 1.2, 16),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
        );
        pot.position.set(0, 0.6, 0);
        group.add(pot);

        for (let p = 0; p < 9; p++) {
          const leaf = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.8, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 })
          );
          leaf.position.set(0, 1.5, 0);
          leaf.rotation.y = (p * Math.PI * 2) / 9;
          leaf.rotation.z = 0.35;
          group.add(leaf);
        }
      }
    }

    if (isSelected) {
      const boxHelper = new THREE.BoxHelper(group, 0xf59e0b);
      group.add(boxHelper);
    }

    const isRotated90 = Math.abs(item.rotation % 180) === 90;
    const boundW = isRotated90 ? item.length : item.width;
    const boundL = isRotated90 ? item.width : item.length;
    const posX = item.x + boundW / 2;
    const posZ = item.y + boundL / 2;
    group.position.set(posX, 0, posZ);
    group.rotation.y = THREE.MathUtils.degToRad(-item.rotation);

    return group;
  };

  const syncFurniture = useCallback(
    (scene: THREE.Scene) => {
      furnitureMeshesRef.current.forEach((mesh) => scene.remove(mesh));
      furnitureMeshesRef.current.clear();

      items.forEach((item) => {
        const isSelected = item.id === selectedItemId;
        const meshGroup = buildFurnitureGroup(item, isSelected);
        scene.add(meshGroup);
        furnitureMeshesRef.current.set(item.id, meshGroup);
      });
    },
    [items, selectedItemId, roomConfig]
  );

  const applyCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const W = roomConfig.widthFt;
      const L = roomConfig.lengthFt;

      if (preset === 'isometric') {
        targetCamPos.current.set(W * 1.5, 20, L * 1.4);
        targetLookAt.current.set(W / 2, 2, L / 2);
      } else if (preset === 'top_down') {
        targetCamPos.current.set(W / 2, 26, L / 2 + 0.1);
        targetLookAt.current.set(W / 2, 0, L / 2);
      } else if (preset === 'entrance_pov') {
        targetCamPos.current.set(2.5, 5.2, 1.5);
        targetLookAt.current.set(5.5, 4.0, L * 0.8);
      } else if (preset === 'executive_pov') {
        targetCamPos.current.set(10.2, 4.5, 18.8);
        targetLookAt.current.set(7.5, 3.5, 5.0);
      } else if (preset === 'workstation_pov') {
        targetCamPos.current.set(7.2, 4.0, 4.5);
        targetLookAt.current.set(10.5, 3.5, 7.5);
      }
    },
    [roomConfig]
  );

  const applyLightingMode = useCallback((mode: LightingMode) => {
    if (!sunLightRef.current || !ambientLightRef.current) return;

    if (mode === 'natural_daylight') {
      sunLightRef.current.color.setHex(0xfff8ee);
      sunLightRef.current.intensity = 1.4;
      ambientLightRef.current.color.setHex(0xdbeafe);
      ambientLightRef.current.intensity = 0.5;
      ceilingLightsRef.current.forEach((l) => (l.intensity = 0.4));
    } else if (mode === 'office_led') {
      sunLightRef.current.intensity = 0.6;
      ambientLightRef.current.color.setHex(0xf8fafc);
      ambientLightRef.current.intensity = 0.8;
      ceilingLightsRef.current.forEach((l) => (l.intensity = 0.9));
    } else if (mode === 'warm_evening') {
      sunLightRef.current.intensity = 0.2;
      ambientLightRef.current.color.setHex(0xfef3c7);
      ambientLightRef.current.intensity = 0.4;
      ceilingLightsRef.current.forEach((l) => (l.intensity = 1.2));
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const { clientWidth, clientHeight } = container;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.5, 100);
    camera.position.set(15, 18, 24);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(clientWidth, clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
    sunLight.position.set(7.5, 14, 25);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    buildArchitecturalShell(scene);
    syncFurniture(scene);
    applyCameraPreset(cameraPreset);
    applyLightingMode(lightingMode);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (cameraRef.current) {
        if (!isWalkMode) {
          cameraRef.current.position.lerp(targetCamPos.current, 0.08);
          currentLookAt.current.lerp(targetLookAt.current, 0.08);
          cameraRef.current.lookAt(currentLookAt.current);
        } else {
          const speed = 0.2;
          const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), walkYaw.current);
          const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), walkYaw.current);

          if (keysPressed.current['w'] || keysPressed.current['ArrowUp']) walkPos.current.addScaledVector(forward, speed);
          if (keysPressed.current['s'] || keysPressed.current['ArrowDown']) walkPos.current.addScaledVector(forward, -speed);
          if (keysPressed.current['a'] || keysPressed.current['ArrowLeft']) walkPos.current.addScaledVector(right, -speed);
          if (keysPressed.current['d'] || keysPressed.current['ArrowRight']) walkPos.current.addScaledVector(right, speed);

          walkPos.current.x = Math.max(0.8, Math.min(roomConfig.widthFt - 0.8, walkPos.current.x));
          walkPos.current.z = Math.max(0.8, Math.min(roomConfig.lengthFt - 0.8, walkPos.current.z));

          cameraRef.current.position.copy(walkPos.current);
          const lookDir = new THREE.Vector3(0, 0, 5).applyAxisAngle(new THREE.Vector3(0, 1, 0), walkYaw.current);
          cameraRef.current.lookAt(walkPos.current.clone().add(lookDir));
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) syncFurniture(sceneRef.current);
  }, [items, selectedItemId, syncFurniture]);

  useEffect(() => {
    applyCameraPreset(cameraPreset);
  }, [cameraPreset, applyCameraPreset]);

  useEffect(() => {
    applyLightingMode(lightingMode);
  }, [lightingMode, applyLightingMode]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isWalkMode) return;
    isInteracting.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };

    if (cameraRef.current && sceneRef.current && mountRef.current) {
      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const furnitureGroups: THREE.Object3D[] = [];
      furnitureMeshesRef.current.forEach((group) => furnitureGroups.push(group));

      const intersects = raycaster.intersectObjects(furnitureGroups, true);
      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && !furnitureMeshesRef.current.has(hitObj.name) && hitObj.parent) {
          hitObj = hitObj.parent;
        }
        if (hitObj && furnitureMeshesRef.current.has(hitObj.name)) {
          onSelectItem(hitObj.name);
          return;
        }
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isWalkMode) {
      if (isInteracting.current) {
        const deltaX = e.clientX - previousMousePosition.current.x;
        walkYaw.current -= deltaX * 0.005;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (!isInteracting.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    spherical.current.theta -= deltaX * 0.008;
    spherical.current.phi = Math.max(0.15, Math.min(Math.PI / 2.05, spherical.current.phi - deltaY * 0.008));

    const radius = spherical.current.radius;
    const target = targetLookAt.current;
    targetCamPos.current.x = target.x + radius * Math.sin(spherical.current.phi) * Math.sin(spherical.current.theta);
    targetCamPos.current.y = target.y + radius * Math.cos(spherical.current.phi);
    targetCamPos.current.z = target.z + radius * Math.sin(spherical.current.phi) * Math.cos(spherical.current.theta);

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isInteracting.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isWalkMode) return;
    spherical.current.radius = Math.max(8, Math.min(42, spherical.current.radius + e.deltaY * 0.02));
    const radius = spherical.current.radius;
    const target = targetLookAt.current;
    targetCamPos.current.x = target.x + radius * Math.sin(spherical.current.phi) * Math.sin(spherical.current.theta);
    targetCamPos.current.y = target.y + radius * Math.cos(spherical.current.phi);
    targetCamPos.current.z = target.z + radius * Math.sin(spherical.current.phi) * Math.cos(spherical.current.theta);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Clean Minimal Controls Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 z-20 backdrop-blur-md text-xs">
        {/* Camera Views */}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-200">3D Room</span>
          <div className="h-3.5 w-px bg-slate-800 mx-1" />
          <div className="flex items-center bg-slate-800/80 rounded border border-slate-700/60 p-0.5 text-[11px]">
            <button
              onClick={() => { setIsWalkMode(false); onCameraPresetChange('isometric'); }}
              className={`px-2 py-0.5 rounded transition-colors ${
                cameraPreset === 'isometric' && !isWalkMode ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Isometric
            </button>
            <button
              onClick={() => { setIsWalkMode(false); onCameraPresetChange('entrance_pov'); }}
              className={`px-2 py-0.5 rounded transition-colors ${
                cameraPreset === 'entrance_pov' && !isWalkMode ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Door View
            </button>
            <button
              onClick={() => { setIsWalkMode(false); onCameraPresetChange('executive_pov'); }}
              className={`px-2 py-0.5 rounded transition-colors ${
                cameraPreset === 'executive_pov' && !isWalkMode ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exec View
            </button>
          </div>
        </div>

        {/* Lighting & Walk */}
        <div className="flex items-center gap-2">
          {/* Lighting */}
          <div className="flex items-center gap-0.5 bg-slate-800/80 rounded border border-slate-700/60 p-0.5">
            <button
              onClick={() => onLightingModeChange('natural_daylight')}
              className={`p-1 rounded ${lightingMode === 'natural_daylight' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
              title="Daylight"
            >
              <Sun className="w-3 h-3" />
            </button>
            <button
              onClick={() => onLightingModeChange('office_led')}
              className={`p-1 rounded ${lightingMode === 'office_led' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'}`}
              title="Office LED"
            >
              <Lamp className="w-3 h-3" />
            </button>
            <button
              onClick={() => onLightingModeChange('warm_evening')}
              className={`p-1 rounded ${lightingMode === 'warm_evening' ? 'bg-orange-500/20 text-orange-300' : 'text-slate-400 hover:text-slate-200'}`}
              title="Evening"
            >
              <Moon className="w-3 h-3" />
            </button>
          </div>

          {/* Walk Mode Toggle */}
          <button
            onClick={() => {
              setIsWalkMode(!isWalkMode);
              if (!isWalkMode) {
                walkPos.current.set(2.5, 5.0, 3.0);
                walkYaw.current = 0;
              }
            }}
            className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1 font-medium transition-colors ${
              isWalkMode
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>{isWalkMode ? 'Exit Walk' : 'Walk'}</span>
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
      >
        {/* Subtle Walk Mode HUD pill */}
        {isWalkMode && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-emerald-500/50 rounded-full px-3 py-1 text-[11px] text-emerald-300 z-30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>WASD to walk · Mouse to look</span>
          </div>
        )}

        {/* Selected Item Floating Pill */}
        {selectedItem && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-amber-400/60 rounded-full px-3 py-1 shadow-xl backdrop-blur-md z-30 text-xs flex items-center gap-2.5">
            <span className="font-semibold text-amber-300">{selectedItem.name}</span>
            <span className="text-slate-400 font-mono text-[11px]">
              {selectedItem.width}×{selectedItem.length} ft
            </span>
            <button
              onClick={() => {
                const nextRot = (selectedItem.rotation + 90) % 360;
                onUpdateItem({ ...selectedItem, rotation: nextRot });
              }}
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full"
              title="Rotate 90°"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

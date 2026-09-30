export type WallType = 'glass_partition' | 'solid_wall' | 'window_wall';

export type FurnitureType =
  | 'executive_desk'
  | 'staff_desk'
  | 'bookshelf'
  | 'whiteboard'
  | 'plant'
  | 'credenza'
  | 'wastebin';

export type MaterialFinish = 'warm_oak' | 'walnut' | 'scandinavian_ash' | 'matte_black' | 'white_laminate';

export interface FurnitureItem {
  id: string;
  name: string;
  type: FurnitureType;
  // Position in feet/tiles relative to top-left (0,0) of the 15x21 room
  // x: 0 to 15 (width), y: 0 to 21 (length)
  x: number;
  y: number;
  width: number; // width in feet (e.g. 3.5 or 4.5 or 2.0)
  length: number; // depth/length in feet (e.g. 2.0 or 3.0)
  height?: number; // height in feet (e.g. 3.0 or 6.0)
  rotation: number; // 0, 90, 180, 270 degrees
  label: string;
  assignedRole: string;
  color: string;
  material: MaterialFinish;
  hasChair?: boolean;
  visitorChairs?: number;
  chairSide?: 'top' | 'bottom' | 'left' | 'right';
  hasMonitor?: boolean;
  hasLaptop?: boolean;
  cableTray?: boolean;
  notes?: string;
  locked?: boolean;
}

export interface CirculationPath {
  id: string;
  points: [number, number][];
  label: string;
  widthFt: number;
  type: 'primary_highway' | 'secondary_egress' | 'executive_access';
  description: string;
}

export interface RoomZone {
  id: string;
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  color: string;
  purpose: string;
}

export interface LayoutPreset {
  id: string;
  name: string;
  subtitle: string;
  concept: string;
  circulationRating: number;
  acousticRating: number;
  naturalLightRating: number;
  corridorWidthFt: number;
  keyBenefits: string[];
  items: FurnitureItem[];
  circulationPaths: CirculationPath[];
  zones: RoomZone[];
}

export interface DoorOpening {
  id: string;
  name: string;
  wall: 'front' | 'left' | 'right' | 'top';
  startFt: number;
  widthFt: number;
  type: 'entry' | 'double_glass' | 'standard' | 'sliding' | 'double_sliding' | 'glass_sliding';
  isSliding?: boolean;
  description: string;
}

export interface RoomConfig {
  widthFt: number; // 15 tiles
  lengthFt: number; // 21 tiles
  heightFt: number; // 9.5 ft ceiling
  tileGridSizeFt: number; // 1.0 ft
  doors: DoorOpening[];
  windowWall: {
    wall: 'top'; // far wall at y=21
    widthFt: number; // 15 ft with blinds
  };
}

export type ViewMode = 'split' | '2d_blueprint' | '3d_spatial' | 'designer_audit';
export type CameraPreset = 'isometric' | 'top_down' | 'entrance_pov' | 'executive_pov' | 'workstation_pov';
export type LightingMode = 'natural_daylight' | 'office_led' | 'warm_evening';

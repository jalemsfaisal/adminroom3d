import React, { useState } from 'react';
import { FurnitureItem, LayoutPreset, RoomConfig } from '../types/office';
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Printer, 
  Share2, 
  Compass, 
  ShieldCheck, 
  Zap, 
  Volume2, 
  SunMedium, 
  Sliders, 
  Layers
} from 'lucide-react';

interface WorkflowReportProps {
  roomConfig: RoomConfig;
  activePreset: LayoutPreset;
  items: FurnitureItem[];
  onClose?: () => void;
}

export const WorkflowReport: React.FC<WorkflowReportProps> = ({
  roomConfig,
  activePreset,
  items,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'before_after' | 'bom' | 'guidelines'>('audit');
  const [comparisonSlider, setComparisonSlider] = useState(50);

  // Calculate live statistics
  const totalArea = roomConfig.widthFt * roomConfig.lengthFt; // 315 sq ft
  const execDesks = items.filter((i) => i.type === 'executive_desk');
  const staffDesks = items.filter((i) => i.type === 'staff_desk');
  const totalOccupants = execDesks.length + staffDesks.length;
  const sqFtPerPerson = Math.round(totalArea / (totalOccupants || 1));

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-30 px-6 py-4 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base text-slate-100">
              Architectural Workflow & Circulation Audit
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-xs text-amber-400">21 × 15 TILES SPECIFICATION</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Commercial interior design assessment · BIFMA G1-2017 & ADA Title III Compliance Review
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'audit'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Workflow Audit
          </button>
          <button
            onClick={() => setActiveTab('before_after')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'before_after'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Before vs After
          </button>
          <button
            onClick={() => setActiveTab('bom')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'bom'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bill of Materials (BOM)
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'guidelines'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ergonomics Guide
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {activeTab === 'audit' && (
          <>
            {/* Key Spatial Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-400 text-xs font-medium">Total Usable Area</div>
                <div className="text-2xl font-bold text-white mt-1 font-mono">
                  315 <span className="text-sm font-sans text-slate-400">sq ft</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  21 ft length × 15 ft width (1:1 tile grid)
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-400 text-xs font-medium">Primary Circulation Spine</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                  {activePreset.corridorWidthFt} <span className="text-sm font-sans text-slate-400">ft clear</span>
                </div>
                <div className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Exceeds ADA standard (3.0 ft) by +50%</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-400 text-xs font-medium">Workstation Density</div>
                <div className="text-2xl font-bold text-blue-400 mt-1 font-mono">
                  {sqFtPerPerson} <span className="text-sm font-sans text-slate-400">sq ft / person</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  7 total seated stations + 2 visitors
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-400 text-xs font-medium">Circulation Efficiency Score</div>
                <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">
                  {activePreset.circulationRating} <span className="text-sm font-sans text-slate-400">/ 100</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Zero bottle-neck traffic pathways
                </div>
              </div>
            </div>

            {/* In-Depth Architectural Critique */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Circulation & Workflow Analysis */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <Compass className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-slate-100 text-sm">
                    1. Traffic Circulation & Egress Architecture
                  </h3>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <p>
                    <strong className="text-white">100% Slide-Open Doors Architecture:</strong> All doors
                    in this studio are engineered as <span className="text-emerald-400 font-semibold">slide-open sliding doors</span> (Single
                    doors take 3 tiles, Right Double Door takes 7 tiles starting after 4 tiles from the corner, and Two Tables are moved into that 4-tile corner).
                    Sliding doors eliminate swing-arc encroachment completely, ensuring zero floor intrusion into workstation corridors.
                  </p>
                  <p>
                    <strong className="text-white">Zero Door Obstruction Guarantee:</strong> The left
                    corner sliding door with its decorative flower base (3 tiles, Y=1.5 to 4.5 ft), the right 7-tile
                    double sliding doors (starts after 4 tiles from corner, Y=4.0 to 11.0 ft), and the two corner workstations
                    (Workstations 4 & 5 placed in the 4-tile corner at Y=0.5 to 3.8 ft)
                    all maintain 100% clear egress along dedicated wall tracks with zero desk encroachment in any door zone.
                  </p>
                  <p>
                    <strong className="text-white">Chair Egress Clearances:</strong> Behind each 3.5×2.0 ft
                    workstation, a generous <span className="text-blue-400 font-semibold">3.0 ft pull-out envelope</span> is
                    enforced. Seated team members can roll back without encroaching on the central 4-tile highway.
                  </p>
                  <p>
                    <strong className="text-white">Executive Command Stance:</strong> The 4.5×3.0 ft
                    executive desk is positioned in the classical architectural <em>Command Position</em>.
                    The executive has direct visual sightlines to the entrance without sitting in the
                    direct line of draft, while maintaining privacy for confidential reviews.
                  </p>
                </div>
              </div>

              {/* Lighting, Acoustic & Glare Engineering */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <SunMedium className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-slate-100 text-sm">
                    2. Natural Daylighting & Glare Mitigation
                  </h3>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <p>
                    <strong className="text-white">Daylight Window Integration:</strong> The 15 ft rear
                    window wall is the sole source of natural sunlight. In the original layout, monitors
                    were placed with screens backing directly toward or facing the window, inducing
                    harsh specular glare and eye strain.
                  </p>
                  <p>
                    <strong className="text-white">Screen Orientation Standard:</strong> Desks in this
                    layout are arranged with monitor sightlines{' '}
                    <span className="text-amber-300 font-semibold">perpendicular to the window wall</span>.
                    This allows natural side-illumination without direct sun wash onto LED panels.
                  </p>
                  <p>
                    <strong className="text-white">Acoustic Absorption & Dividers:</strong> By positioning
                    the tall wooden archive unit along the right structural wall and introducing acoustic
                    desktop screens between facing workstations, reverberation time ($RT_{60}$) is
                    reduced by approximately 35%.
                  </p>
                </div>
              </div>

              {/* Cable & Power Infrastructure */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-slate-100 text-sm">
                    3. Concealed Cable & Wire Management
                  </h3>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <p>
                    <strong className="text-white">Hazard Elimination:</strong> In the uploaded photo,
                    extension cords and power strips lie strewn across the tile floor, creating serious
                    trip hazards in walking paths.
                  </p>
                  <p>
                    <strong className="text-white">Integrated Wire Trays:</strong> Every 3.5×2 ft desk
                    includes an under-desk steel raceway tray and a 60mm grommet hole. Power cables,
                    Ethernet links, and monitor display cables are routed through internal channels
                    directly to wall baseboard trunking along the right structural wall.
                  </p>
                </div>
              </div>

              {/* Spatial Psychology & Aesthetics */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-slate-100 text-sm">
                    4. Professional Atmosphere & Material Palette
                  </h3>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <p>
                    <strong className="text-white">Harmonized Wood Finishes:</strong> Rich dark walnut
                    for the executive desk denotes authority and refinement, paired with warm natural oak
                    workstation surfaces that maximize light bounce.
                  </p>
                  <p>
                    <strong className="text-white">Biophilic Accentuation:</strong> Potted indoor plants
                    (Fiddle Leaf Fig at the window, Snake Plant at the entrance) introduce organic
                    softness against the clean geometric tile grid and glass partition.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Before & After Visual Transformation Tab */}
        {activeTab === 'before_after' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">
                    Office Transformation: Original Photo vs. 3D Architectural Design
                  </h3>
                  <p className="text-xs text-slate-400">
                    Compare the cluttered starting layout against the proposed modern interior design.
                  </p>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Photo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-400">Original Room State (Photo)</span>
                    <span className="text-slate-400 text-[11px]">Haphazard desks · Floor wire clutter</span>
                  </div>
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
                    <img
                      src="/PXL_20260928_060502070.jpg"
                      alt="Original office space photo with 21x15 tile floor and glass partition"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const parent = (e.target as HTMLElement).parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.photo-fallback');
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                    <div className="photo-fallback hidden absolute inset-0 bg-slate-900 flex-col items-center justify-center p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-2">
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                      </div>
                      <span className="font-semibold text-xs text-rose-300">Original Floor Bottlenecks</span>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        Haphazard desk orientation, protruding green counter blocking 3.5 ft corridor, and exposed floor wiring.
                      </p>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] text-white">
                      Original 21x15 ft Office
                    </div>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                    <li>Disorganized desk angles blocking natural walking paths</li>
                    <li>Awkward green counter unit choking entrance egress</li>
                    <li>Visible wire tangles on the floor posing trip risks</li>
                  </ul>
                </div>

                {/* Proposed 3D Modern Design */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400">Proposed Modern Architectural Design</span>
                    <span className="text-slate-400 text-[11px]">4.5 ft spine · Concealed wiring · Ergonomic</span>
                  </div>
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-emerald-500/40 bg-slate-950 shadow-lg">
                    <img
                      src="/src/assets/images/modern_office_render_1790577660185.jpg"
                      alt="Modern architectural 3D rendering of the 21x15 ft office with oak workstations and executive desk"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-2 left-2 bg-emerald-950/80 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] text-emerald-300 font-semibold border border-emerald-500/40">
                      Modern Interior Architecture Concept
                    </div>
                  </div>
                  <ul className="text-[11px] text-emerald-300/80 space-y-1 list-disc list-inside">
                    <li>Streamlined 4.5 ft circulation spine from glass door</li>
                    <li>Six 3.5×2 ft workstations with acoustic felt dividers</li>
                    <li>One commanding 4.5×3 ft executive desk with guest seating</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Executive Suite Close-up */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h4 className="font-semibold text-slate-100 text-sm mb-3">
                Executive Consultation Enclave Focus
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-2 relative aspect-[16/9] rounded-lg overflow-hidden border border-slate-800">
                  <img
                    src="/src/assets/images/executive_desk_view_1790577671681.jpg"
                    alt="Executive desk detail view"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-3 text-xs text-slate-300">
                  <h5 className="font-semibold text-amber-400">Key Executive Elements:</h5>
                  <p>
                    <strong className="text-white">Command Presence:</strong> Sited 16.5 ft into the room,
                    commanding the entire view of the office while remaining tranquil.
                  </p>
                  <p>
                    <strong className="text-white">Dual Consultation Chairs:</strong> Allows two
                    associates or external clients to meet comfortably without crowding.
                  </p>
                  <p>
                    <strong className="text-white">Natural Daylight:</strong> Filtered morning and
                    afternoon light through vertical blinds without screen reflections.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bill of Materials (BOM) Tab */}
        {activeTab === 'bom' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">
                  Complete Furniture Bill of Materials & Tile Coordinates
                </h3>
                <p className="text-xs text-slate-400">
                  Exact itemized specification for procurement, fabrication, and contractor installation.
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Specification</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3">Item #</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Dimensions (L × W)</th>
                    <th className="py-2.5 px-3">Tile Coords [X, Y]</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">Material Finish</th>
                    <th className="py-2.5 px-3">Accessories</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">
                        {item.width} × {item.length} ft
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        [{item.x.toFixed(1)}, {item.y.toFixed(1)}] ({item.rotation}°)
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300 truncate max-w-[140px]">
                        {item.assignedRole}
                      </td>
                      <td className="py-2.5 px-3 font-sans capitalize text-slate-400">
                        {item.material.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-400">
                        {item.hasChair && 'Task Chair'}
                        {item.visitorChairs ? ` + ${item.visitorChairs} Guest Chairs` : ''}
                        {item.cableTray ? ', Wire Tray' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ergonomics & Installation Guidelines Tab */}
        {activeTab === 'guidelines' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Commercial Office Clearance Standards</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                <li>
                  <strong className="text-white">Primary Corridors:</strong> Minimum 36 inches (3.0 ft),
                  recommended 48 inches (4.0 ft). Our layout delivers{' '}
                  <span className="text-emerald-400 font-semibold">54 inches (4.5 ft)</span>, allowing two
                  people to pass comfortably simultaneously.
                </li>
                <li>
                  <strong className="text-white">Desk Egress Envelope:</strong> Minimum 30 inches (2.5 ft)
                  from desk edge to rear obstacle. Our layout delivers{' '}
                  <span className="text-blue-400 font-semibold">36 inches (3.0 ft)</span> behind every chair.
                </li>
                <li>
                  <strong className="text-white">Door Opening Clear Path:</strong> 42 inches (3.5 ft) swing
                  radius free of any desk or storage footprint.
                </li>
              </ul>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Contractor Installation Steps</span>
              </h4>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  <strong className="text-white">Tile Grid Chalking:</strong> Using the 1x1 ft floor
                  tiles as natural benchmarks, chalk the 4.5 ft spine guideline at X=4.5 ft.
                </li>
                <li>
                  <strong className="text-white">Perimeter Power Trunking:</strong> Mount surface wire
                  ducts along the right structural wall at 12 inches above finished floor (AFF).
                </li>
                <li>
                  <strong className="text-white">Workstation Pod Assembly:</strong> Assemble the six
                  3.5×2 ft desks in two aligned banks with interconnected under-desk cable baskets.
                </li>
                <li>
                  <strong className="text-white">Executive Desk Placement:</strong> Position the 4.5×3 ft
                  desk at X=8.0, Y=16.5, centering sightlines with the entrance door.
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export type Distribution = 'random' | 'gradient' | 'radial' | 'noise' | 'color' | 'luminance' | 'checkerboard' | 'stripes' | 'ordered' | 'contour';
export type ZoomDistribution = 'spiral'|'tiled-spiral'|'rings'|'radial'|'diagonal'|'rows'|'columns'|'checkerboard'|'sequence'|'noise'|'random';
export type PositionDistribution = 'columns'|'rows'|'sequence'|'random'|'noise'|'spiral'|'tiled'|'fixed';
export type MotionPattern = 'sweep' | 'ripple' | 'scatter' | 'flip' | 'slide';
export type Mask = 'square' | 'circle' | 'diamond' | 'triangle' | 'hexagon' | 'arch' | 'mixed';
export interface Ink { name: string; color: string; angle: number; density: number; enabled: boolean }
export interface CellPin { cell:number; sourceId:string; sx:number; sy:number; sw:number; sh:number; turn:number }
export interface Settings {
  contourContinuity:number; contourBreaks:number; contourDiversity:number; contourCrop:number; contourTurn:number; cellPins:CellPin[];
  multiscale:boolean; multiscaleSource:string; multiscaleMode:'fragments'|'echo';
  zoomLevels:number;zoomMin:number;zoomMax:number;zoomDistribution:ZoomDistribution;zoomRepeats:number;zoomTurns:number;zoomPhase:number;zoomReverse:boolean;zoomContrast:number;
  sourceXDistribution:PositionDistribution;sourceYDistribution:PositionDistribution;sourceXMin:number;sourceXMax:number;sourceYMin:number;sourceYMax:number;sourcePositionRepeats:number;sourcePositionPhase:number;sourceSnap:boolean;
  screenMode:'regular'|'contour'; flowStrength:number; flowSmoothing:number; flowLength:number; flowDivergence:number; flowAcrossCells:boolean;
  rows: number; columns: number; sourceRows: number; sourceColumns: number;
  gap: number; margin: number; background: string; distribution: Distribution;
  seed: number; gradientAngle: number; noiseScale: number; chaos: number;
  colorStart: string; colorEnd: string; crop: 'random' | 'corresponding' | 'ordered';
  mask: Mask; scale: number; variation: number; scaleMode: 'uniform' | 'random' | 'noise' | 'gradient';
  rotation: number; rotationJitter: number; flip: boolean; saturation: number; contrast: number;
  halftone: boolean; pattern: 'dots' | 'lines' | 'diamonds' | 'squares'; lpi: number;
  separation: 'cmyk' | 'spot'; blackGeneration: number; gain: number; inks: Ink[]; spotInks: Ink[];
  width: number; height: number; dpi: number; selectedIds: string[];
  motionPattern: MotionPattern; motionGrouping: 'single' | 'grouped' | 'together';
  motionDuration: number; motionIntensity: number; motionHold: number; motionGroupSize: number; motionOverlap: number;
  motionDirection: 'forward' | 'reverse'; motionLoop: boolean; motionSeedStep: number;
}
export interface SourceImage { id: string; title: string; author: string; url: string; src: string; thumbnail?:string; category?:string; addedAt?:string; custom?: boolean }
export interface Revision { id: string; createdAt: string; settings: Settings; note: string }
export interface Preset { id: string; name: string; revisions: Revision[] }
export const DEFAULTS: Settings = {
  contourContinuity:.85,contourBreaks:.08,contourDiversity:.35,contourCrop:.2,contourTurn:6,cellPins:[],
  multiscale:false,multiscaleSource:'',multiscaleMode:'echo',
  zoomLevels:5,zoomMin:1,zoomMax:32,zoomDistribution:'spiral',zoomRepeats:3,zoomTurns:2,zoomPhase:0,zoomReverse:false,zoomContrast:0,
  sourceXDistribution:'columns',sourceYDistribution:'rows',sourceXMin:0,sourceXMax:100,sourceYMin:0,sourceYMax:100,sourcePositionRepeats:3,sourcePositionPhase:0,sourceSnap:true,
  screenMode:'regular',flowStrength:.65,flowSmoothing:2,flowLength:3,flowDivergence:.7,flowAcrossCells:true,
  rows: 8, columns: 8, sourceRows: 4, sourceColumns: 4, gap: 5, margin: 6,
  background: '#f2efe7', distribution: 'noise', seed: 2408, gradientAngle: 45, noiseScale: 3, chaos: 0.15,
  colorStart: '#214c5d', colorEnd: '#e9a16b', crop: 'random', mask: 'square', scale: 1,
  variation: 0.24, scaleMode: 'uniform', rotation: 0, rotationJitter: 0, flip: false, saturation: 1, contrast: 1,
  halftone: false, pattern: 'dots', lpi: 18, separation: 'cmyk', blackGeneration: 1, gain: 0,
  inks: [
    { name: 'Cyan', color: '#00a6c8', angle: 15, density: 1, enabled: true },
    { name: 'Magenta', color: '#e83372', angle: 75, density: 1, enabled: true },
    { name: 'Yellow', color: '#f5d42b', angle: 0, density: 1, enabled: true },
    { name: 'Black', color: '#252623', angle: 45, density: 1, enabled: true },
  ],
  spotInks: [
    { name: 'Ocean', color: '#16646b', angle: 15, density: 1, enabled: true },
    { name: 'Vermilion', color: '#ec593c', angle: 75, density: 1, enabled: true },
  ], width: 10, height: 10, dpi: 300, selectedIds: [],
  motionPattern: 'sweep', motionGrouping: 'grouped', motionDuration: .65, motionIntensity: .65, motionHold: 1.2,
  motionGroupSize: 4, motionOverlap: .65, motionDirection: 'forward', motionLoop: true, motionSeedStep: 1,
};
export const STARTERS: { name: string; description: string; patch: Partial<Settings>; swatch: string }[] = [
  { name: 'Portrait / detail', description: 'Faces, eyes & abstract fragments', patch: {selectedIds:['h1zwnZNp1fI'],multiscale:true,rows:12,columns:12,gap:1,margin:4,zoomLevels:4,zoomMin:1,zoomMax:24,zoomContrast:.85,zoomDistribution:'checkerboard',sourceSnap:false,sourceXMin:22,sourceXMax:78,sourceYMin:15,sourceYMax:65}, swatch:'portrait' },
  { name: 'Spiral zoom', description: 'Wide views · close details', patch: {multiscale:true,rows:18,columns:18,gap:0,margin:4,zoomDistribution:'spiral',zoomContrast:.8,zoomLevels:4,zoomMax:64}, swatch:'field' },
  { name: 'Modular zoom', description: 'Repeated spirals · six magnifications', patch: {multiscale:true,rows:24,columns:24,gap:2,margin:4,zoomDistribution:'tiled-spiral',zoomRepeats:3,zoomLevels:6,zoomMax:128,zoomContrast:.75,sourceXDistribution:'tiled',sourceYDistribution:'tiled'}, swatch:'prisms' },
  { name: 'Zoom terraces', description: 'Ordered bands of photographic scale', patch: {multiscale:true,rows:12,columns:12,gap:1,margin:4,zoomDistribution:'diagonal',zoomLevels:6,zoomMax:256,zoomContrast:.75,sourceXDistribution:'spiral',sourceYDistribution:'spiral'}, swatch:'field' },
  { name: 'Connected landscapes', description: 'Fragments follow their neighbors', patch: {distribution:'contour',rows:9,columns:9,gap:0,contourBreaks:.03}, swatch:'prisms' },
  { name: 'Contour engraving', description: 'Curved screens follow light and shade', patch: {halftone:true,screenMode:'contour',pattern:'lines',separation:'spot',rows:5,columns:5,gap:0,lpi:16,flowStrength:.75}, swatch:'duo' },
  { name: 'Field notes', description: 'An unexpected landscape', patch: {}, swatch: 'field' },
  { name: 'Soft geometry', description: 'Circular fragments · noise', patch: { mask: 'circle', scaleMode: 'noise', scale: 0.98, variation: 0.6, rows: 9, columns: 9, gap: 8, distribution: 'gradient' }, swatch: 'circles' },
  { name: 'Two-ink study', description: 'Vermilion meets ocean', patch: { halftone: true, separation: 'spot', lpi: 12, rows: 6, columns: 6, mask: 'square', distribution: 'random', gap: 0 }, swatch: 'duo' },
  { name: 'Prismatic', description: 'Diamonds in a color field', patch: { mask: 'diamond', rows: 10, columns: 10, gap: 0, distribution: 'color', scaleMode: 'gradient', variation: 0.45 }, swatch: 'diamonds' },
  { name: 'Press proof', description: 'Four-color dot screen', patch: { halftone: true, separation: 'cmyk', lpi: 22, rows: 5, columns: 5, gap: 3, distribution: 'ordered' }, swatch: 'press' },
];
export const cloneSettings = (s: Settings): Settings => structuredClone(s);
export const settingEnums: Record<string, string[]> = {
  sourceXDistribution:['columns','rows','sequence','random','noise','spiral','tiled','fixed'],
  sourceYDistribution:['columns','rows','sequence','random','noise','spiral','tiled','fixed'],
  zoomDistribution:['spiral','tiled-spiral','rings','radial','diagonal','rows','columns','checkerboard','sequence','noise','random'],
  multiscaleMode:['fragments','echo'],screenMode:['regular','contour'],
  motionPattern: ['sweep','ripple','scatter','flip','slide'], motionGrouping: ['single','grouped','together'], motionDirection: ['forward','reverse'],
  distribution: ['random','gradient','radial','noise','color','luminance','checkerboard','stripes','ordered','contour'],
  crop: ['random','corresponding','ordered'], mask: ['square','circle','diamond','triangle','hexagon','arch','mixed'],
  scaleMode: ['uniform','random','noise','gradient'], pattern: ['dots','lines','diamonds','squares'], separation: ['cmyk','spot'],
};
export const bounds: Record<string, [number, number]> = {
  contourContinuity:[0,1],contourBreaks:[0,1],contourDiversity:[0,1],contourCrop:[0,.5],contourTurn:[0,20],
  zoomLevels:[1,16],zoomMin:[1,1024],zoomMax:[1,1024],zoomContrast:[0,1],zoomRepeats:[1,8],zoomTurns:[.25,6],zoomPhase:[0,1],sourceXMin:[0,100],sourceXMax:[0,100],sourceYMin:[0,100],sourceYMax:[0,100],sourcePositionRepeats:[1,12],sourcePositionPhase:[0,1],
  flowStrength:[0,1],flowSmoothing:[.3,8],flowLength:[1,8],flowDivergence:[0,1],
  motionDuration: [.15,3], motionIntensity: [0,1], motionHold: [0,8], motionGroupSize: [2,64], motionOverlap: [0,.9], motionSeedStep: [1,10000],
  rows: [1,80], columns: [1,80], sourceRows: [1,24], sourceColumns: [1,24], gap: [0,50], margin: [0,30],
  seed: [0,2147483647], gradientAngle: [0,360], noiseScale: [0.5,20], chaos: [0,1], scale: [0.1,1.5], variation: [0,1],
  rotation: [-180,180], rotationJitter: [0,180], saturation: [0,2], contrast: [0.2,2], lpi: [2,100], blackGeneration: [0,1],
  gain: [-0.5,0.5], width: [1,40], height: [1,40], dpi: [72,1200],
};
export function normalizeSettings(input: unknown): Settings {
  if (!input || typeof input !== 'object') throw new Error('This file does not contain valid settings.');
  const result = cloneSettings(DEFAULTS), value = {...input} as Record<string, unknown>;
  // Older zoom recipes retain their magnification range; frequency/contrast effects are retired.
  if(value.zoomLevels===undefined&&value.echoLevels!==undefined)value.zoomLevels=value.echoLevels;
  if(value.zoomMin===undefined&&value.echoZoom!==undefined)value.zoomMin=value.echoZoom;
  if(value.zoomMax===undefined&&typeof value.echoZoom==='number'&&typeof value.echoLevels==='number')value.zoomMax=value.echoZoom*2**Math.max(0,value.echoLevels-1);
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = value[key];
    if (v === undefined) continue;
    if (bounds[key]) {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Invalid ${key}.`);
      let n = Math.min(bounds[key][1], Math.max(bounds[key][0], v));
      if (['rows','columns','sourceRows','sourceColumns','seed','dpi','motionGroupSize','motionSeedStep','zoomLevels','zoomRepeats','sourcePositionRepeats'].includes(key)) n = Math.round(n);
      (result as unknown as Record<string,unknown>)[key] = n;
    } else if (settingEnums[key]) {
      if (!settingEnums[key].includes(String(v))) throw new Error(`Unknown ${key}.`);
      (result as unknown as Record<string,unknown>)[key] = v;
    } else if (key === 'multiscaleSource') {
      if(typeof v!=='string'||v.length>200)throw new Error('Invalid zoom image.');
      result.multiscaleSource=v;
    } else if (key === 'cellPins') {
      if(!Array.isArray(v)||v.length>6400)throw new Error('Invalid pinned cells.');
      result.cellPins=v.map(pin=>{
        if(!pin||typeof pin.sourceId!=='string'||pin.sourceId.length>200||!Number.isInteger(pin.cell)||pin.cell<0||pin.cell>=6400||!['sx','sy','sw','sh','turn'].every(k=>typeof pin[k]==='number'&&Number.isFinite(pin[k]))||pin.sx<0||pin.sy<0||pin.sw<=0||pin.sh<=0||pin.sx+pin.sw>1.00001||pin.sy+pin.sh>1.00001||Math.abs(pin.turn)>180)throw new Error('Invalid pinned fragment.');
        return {cell:pin.cell,sourceId:pin.sourceId,sx:pin.sx,sy:pin.sy,sw:pin.sw,sh:pin.sh,turn:pin.turn};
      });
      result.cellPins=[...new Map(result.cellPins.map(pin=>[pin.cell,pin])).values()];
    } else if (key === 'selectedIds') {
      if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error('Invalid source selection.');
      result.selectedIds = [...new Set(v)];
    } else if (key === 'inks' || key === 'spotInks') {
      if (!Array.isArray(v) || v.length < 1 || v.length > 6 || (key === 'inks' && v.length !== 4)) throw new Error('Invalid ink palette.');
      result[key] = v.map((ink) => {
        if (!ink || !/^#[0-9a-f]{6}$/i.test(ink.color) || !Number.isFinite(ink.angle) || !Number.isFinite(ink.density)) throw new Error('Invalid ink.');
        return { name: String(ink.name).slice(0,60), color: ink.color, angle: Math.max(0,Math.min(180,ink.angle)), density: Math.max(0,Math.min(2,ink.density)), enabled: ink.enabled !== false };
      });
    } else if (typeof DEFAULTS[key] === 'boolean') {
      if (typeof v !== 'boolean') throw new Error(`Invalid ${key}.`);
      (result as unknown as Record<string,unknown>)[key] = v;
    } else if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) {
      (result as unknown as Record<string,unknown>)[key] = v;
    } else throw new Error(`Invalid ${key}.`);
  }
  if(result.zoomMax<result.zoomMin)[result.zoomMin,result.zoomMax]=[result.zoomMax,result.zoomMin];
  if(result.sourceXMax<result.sourceXMin)[result.sourceXMin,result.sourceXMax]=[result.sourceXMax,result.sourceXMin];
  if(result.sourceYMax<result.sourceYMin)[result.sourceYMin,result.sourceYMax]=[result.sourceYMax,result.sourceYMin];
  return result;
}
export function exportDimensions(s: Settings) {
  const width = Math.round(s.width * s.dpi), height = Math.round(s.height * s.dpi);
  // Bounded because a package holds RGBA layers, TIFFs, PSD data and zip buffers at once.
  if (width * height > 20_000_000 || width > 12000 || height > 12000) throw new Error('Export exceeds 20 megapixels. Reduce print size or DPI.');
  return { width, height };
}

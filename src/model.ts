export type Distribution = 'random' | 'gradient' | 'radial' | 'noise' | 'color' | 'luminance' | 'checkerboard' | 'stripes' | 'ordered';
export type MotionPattern = 'sweep' | 'ripple' | 'scatter' | 'flip' | 'slide';
export type Mask = 'square' | 'circle' | 'diamond' | 'triangle' | 'hexagon' | 'arch' | 'mixed';
export interface Ink { name: string; color: string; angle: number; density: number; enabled: boolean }
export interface Settings {
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
export interface SourceImage { id: string; title: string; author: string; url: string; src: string; custom?: boolean }
export interface Revision { id: string; createdAt: string; settings: Settings; note: string }
export interface Preset { id: string; name: string; revisions: Revision[] }
export const DEFAULTS: Settings = {
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
  { name: 'Field notes', description: 'An unexpected landscape', patch: {}, swatch: 'field' },
  { name: 'Soft geometry', description: 'Circular fragments · noise', patch: { mask: 'circle', scaleMode: 'noise', scale: 0.98, variation: 0.6, rows: 9, columns: 9, gap: 8, distribution: 'gradient' }, swatch: 'circles' },
  { name: 'Two-ink study', description: 'Vermilion meets ocean', patch: { halftone: true, separation: 'spot', lpi: 12, rows: 6, columns: 6, mask: 'square', distribution: 'random', gap: 0 }, swatch: 'duo' },
  { name: 'Prismatic', description: 'Diamonds in a color field', patch: { mask: 'diamond', rows: 10, columns: 10, gap: 0, distribution: 'color', scaleMode: 'gradient', variation: 0.45 }, swatch: 'diamonds' },
  { name: 'Press proof', description: 'Four-color dot screen', patch: { halftone: true, separation: 'cmyk', lpi: 22, rows: 5, columns: 5, gap: 3, distribution: 'ordered' }, swatch: 'press' },
];
export const cloneSettings = (s: Settings): Settings => structuredClone(s);
const enums: Record<string, string[]> = {
  motionPattern: ['sweep','ripple','scatter','flip','slide'], motionGrouping: ['single','grouped','together'], motionDirection: ['forward','reverse'],
  distribution: ['random','gradient','radial','noise','color','luminance','checkerboard','stripes','ordered'],
  crop: ['random','corresponding','ordered'], mask: ['square','circle','diamond','triangle','hexagon','arch','mixed'],
  scaleMode: ['uniform','random','noise','gradient'], pattern: ['dots','lines','diamonds','squares'], separation: ['cmyk','spot'],
};
export const bounds: Record<string, [number, number]> = {
  motionDuration: [.15,3], motionIntensity: [0,1], motionHold: [0,8], motionGroupSize: [2,64], motionOverlap: [0,.9], motionSeedStep: [1,10000],
  rows: [1,80], columns: [1,80], sourceRows: [1,24], sourceColumns: [1,24], gap: [0,50], margin: [0,30],
  seed: [0,2147483647], gradientAngle: [0,360], noiseScale: [0.5,20], chaos: [0,1], scale: [0.1,1.5], variation: [0,1],
  rotation: [-180,180], rotationJitter: [0,180], saturation: [0,2], contrast: [0.2,2], lpi: [2,100], blackGeneration: [0,1],
  gain: [-0.5,0.5], width: [1,40], height: [1,40], dpi: [72,1200],
};
export function normalizeSettings(input: unknown): Settings {
  if (!input || typeof input !== 'object') throw new Error('This file does not contain valid settings.');
  const result = cloneSettings(DEFAULTS), value = input as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = value[key];
    if (v === undefined) continue;
    if (bounds[key]) {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Invalid ${key}.`);
      let n = Math.min(bounds[key][1], Math.max(bounds[key][0], v));
      if (['rows','columns','sourceRows','sourceColumns','seed','dpi','motionGroupSize','motionSeedStep'].includes(key)) n = Math.round(n);
      (result as unknown as Record<string,unknown>)[key] = n;
    } else if (enums[key]) {
      if (!enums[key].includes(String(v))) throw new Error(`Unknown ${key}.`);
      (result as unknown as Record<string,unknown>)[key] = v;
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
  return result;
}
export function exportDimensions(s: Settings) {
  const width = Math.round(s.width * s.dpi), height = Math.round(s.height * s.dpi);
  // Bounded because a package holds RGBA layers, TIFFs, PSD data and zip buffers at once.
  if (width * height > 20_000_000 || width > 12000 || height > 12000) throw new Error('Export exceeds 20 megapixels. Reduce print size or DPI.');
  return { width, height };
}

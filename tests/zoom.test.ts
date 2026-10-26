import {describe,it,expect} from 'vitest';
import {DEFAULTS,normalizeSettings} from '../src/model';
import {ZOOM_DISTRIBUTIONS,zoomGrid,zoomLevels,zoomLevelAt,zoomTile,sourcePositionAt,POSITION_DISTRIBUTIONS} from '../src/engine/zoom';
import type {Tile} from '../src/engine/tile';

describe('discrete crop magnifications',()=>{
 it('includes exact bounds with consistent ratios and handles a single level',()=>{
  const s={...DEFAULTS,zoomLevels:5,zoomMin:1,zoomMax:16};
  expect(zoomLevels(s)).toEqual([1,2,4,8,16]);
  expect(zoomLevels({...s,zoomLevels:1})).toEqual([1]);
  expect(zoomLevels({...s,zoomMin:3,zoomMax:3})).toEqual([3,3,3,3,3]);
 });
 it.each(ZOOM_DISTRIBUTIONS.map(d=>d.id))('%s is bounded, discrete, reproducible and reversible',zoomDistribution=>{
  const s={...DEFAULTS,rows:13,columns:21,zoomLevels:7,zoomMin:1.5,zoomMax:24,zoomDistribution};
  const levels=zoomLevels(s),values=zoomGrid(s);
  expect(values).toEqual(zoomGrid(s));expect(values.every(v=>levels.includes(v))).toBe(true);
  for(let row=0;row<s.rows;row++)for(let col=0;col<s.columns;col++)expect(zoomLevelAt(s,row,col)+zoomLevelAt({...s,zoomReverse:true},row,col)).toBe(6);
 });
 it('organizes row and column ramps independently of source selection or seed',()=>{
  const s={...DEFAULTS,rows:4,columns:4,zoomLevels:4,zoomMin:1,zoomMax:8,zoomDistribution:'columns' as const};
  expect(zoomGrid(s).map(v=>Math.round(v*1e9)/1e9)).toEqual([1,2,4,8,1,2,4,8,1,2,4,8,1,2,4,8]);
  expect(zoomGrid({...s,zoomDistribution:'rows'}).map(v=>Math.round(v*1e9)/1e9)).toEqual([1,1,1,1,2,2,2,2,4,4,4,4,8,8,8,8]);
  expect(zoomGrid({...s,seed:15})).toEqual(zoomGrid(s));
 });
 it('repeats identical spiral modules',()=>{
  const s={...DEFAULTS,rows:24,columns:24,zoomDistribution:'tiled-spiral' as const,zoomRepeats:3};
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)expect(zoomLevelAt(s,y,x)).toBe(zoomLevelAt(s,y+8,x+16));
 });
 it('varies spiral phases and random layouts with the seed',()=>{
  for(const zoomDistribution of ['spiral','rings','noise','random'] as const)expect(zoomGrid({...DEFAULTS,zoomDistribution,seed:1})).not.toEqual(zoomGrid({...DEFAULTS,zoomDistribution,seed:2}));
 });
 it('keeps crops inside their source at 256× and anchors them to distributed positions',()=>{
  const tile={sx:100,sy:200,sw:800,sh:600} as Tile,s={...DEFAULTS,sourceXMin:100,sourceXMax:100,sourceYMin:0,sourceYMax:0,sourceSnap:false};
  expect(zoomTile(tile,2,s)).toMatchObject({sx:600,sy:200,sw:300,sh:300});
  for(const x of [0,50,100])for(const y of [0,50,100])for(const zoom of [1,2,256]){
   const t=zoomTile(tile,zoom,{...s,width:20,height:5,sourceXMin:x,sourceXMax:x,sourceYMin:y,sourceYMax:y});
   expect(t.sx).toBeGreaterThanOrEqual(100);expect(t.sy).toBeGreaterThanOrEqual(200);expect(t.sx+t.sw).toBeLessThanOrEqual(900);expect(t.sy+t.sh).toBeLessThanOrEqual(800);
  }
 });
 it('migrates old ranges, discards obsolete effects and validates new settings',()=>{
  const s=normalizeSettings({multiscale:true,echoLevels:4,echoZoom:2,multiscaleDetail:2,multiscaleStrength:1});
  expect(s).toMatchObject({zoomLevels:4,zoomMin:2,zoomMax:16});expect(s).not.toHaveProperty('multiscaleDetail');
  expect(normalizeSettings({zoomMin:12,zoomMax:2})).toMatchObject({zoomMin:2,zoomMax:12});
  expect(()=>normalizeSettings({zoomDistribution:'bogus'})).toThrow();expect(()=>normalizeSettings({zoomMin:NaN})).toThrow();
  expect(normalizeSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
 });
});

describe('independent source coordinates',()=>{
 it('visits source cell centers in order and keeps the same center through zoom changes',()=>{
  const s={...DEFAULTS,rows:4,columns:4,sourceRows:4,sourceColumns:4};
  expect(sourcePositionAt(s,0,0)).toEqual([.125,.125]);expect(sourcePositionAt(s,3,3)).toEqual([.875,.875]);
  const tile={sx:100,sy:200,sw:800,sh:800} as Tile;
  for(const zoom of [8,32,256]){
   const crop=zoomTile(tile,zoom,s,1,2);
   expect(crop.sx+crop.sw/2).toBe(600);expect(crop.sy+crop.sh/2).toBe(500);
  }
 });
 it('decouples coordinate layout from zoom and each axis from the other',()=>{
  const s={...DEFAULTS,sourceXDistribution:'random' as const,sourceYDistribution:'rows' as const,sourceSnap:false};
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
   const xy=sourcePositionAt(s,row,col);
   expect(xy[1]).toBe((row+.5)/8);
   expect(sourcePositionAt({...s,zoomMax:256,zoomDistribution:'rings'},row,col)).toEqual(xy);
   expect(sourcePositionAt({...s,sourceYDistribution:'random'},row,col)[0]).toBe(xy[0]);
  }
 });
 it.each(POSITION_DISTRIBUTIONS.map(([id])=>id))('%s stays within requested coordinate bounds and reproduces',mode=>{
  const s={...DEFAULTS,sourceXDistribution:mode,sourceYDistribution:mode,sourceXMin:21,sourceXMax:74,sourceYMin:12,sourceYMax:89};
  for(const sourceSnap of [false,true])for(let row=0;row<8;row++)for(let col=0;col<8;col++){
   const p=sourcePositionAt({...s,sourceSnap},row,col);
   expect(p).toEqual(sourcePositionAt({...s,sourceSnap},row,col));
   expect(p[0]).toBeGreaterThanOrEqual(.21);expect(p[0]).toBeLessThanOrEqual(.74);expect(p[1]).toBeGreaterThanOrEqual(.12);expect(p[1]).toBeLessThanOrEqual(.89);
  }
 });
 it('scans the source lattice and repeats position modules',()=>{
  const s={...DEFAULTS,sourceRows:2,sourceColumns:3,sourceXDistribution:'sequence' as const,sourceYDistribution:'sequence' as const};
  expect(sourcePositionAt(s,0,0)).toEqual([1/6,1/4]);expect(sourcePositionAt(s,0,5)).toEqual([5/6,3/4]);expect(sourcePositionAt(s,0,6)).toEqual(sourcePositionAt(s,0,0));
  const tiled={...DEFAULTS,rows:24,columns:24,sourceXDistribution:'tiled' as const,sourceYDistribution:'tiled' as const,sourceSnap:false};
  for(let i=0;i<8;i++){expect(sourcePositionAt(tiled,i,i)[0]).toBeCloseTo(sourcePositionAt(tiled,i+8,i+16)[0]);expect(sourcePositionAt(tiled,i,i)[1]).toBeCloseTo(sourcePositionAt(tiled,i+8,i+16)[1]);}
 });
 it('gives old recipes spatial defaults and supports saving the expanded ranges',()=>{
  const s=normalizeSettings({zoomFocusX:50,zoomFocusY:50,zoomMax:256,sourceXDistribution:'spiral',sourceYDistribution:'noise'});
  expect(s).not.toHaveProperty('zoomFocusX');expect(s.zoomMax).toBe(256);expect(normalizeSettings(s)).toEqual(s);
 });
});

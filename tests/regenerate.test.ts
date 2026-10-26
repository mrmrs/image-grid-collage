import {describe,it,expect} from 'vitest';
import {DEFAULTS,cloneSettings,normalizeSettings} from '../src/model';
import {regenerateSettings} from '../src/engine/regenerate';

describe('full recipe regeneration',()=>{
 it('preserves paper color, print specification and sources without mutating the previous recipe',()=>{
  const original={...cloneSettings(DEFAULTS),background:'#614b8a',width:12,height:7,dpi:300,selectedIds:['a','b'],cellPins:[{cell:0,sourceId:'a',sx:0,sy:0,sw:1,sh:1,turn:0}]};
  const before=cloneSettings(original),next=regenerateSettings(original,153);
  expect(original).toEqual(before);expect(next).toMatchObject({background:'#614b8a',width:12,height:7,dpi:300,selectedIds:['a','b'],cellPins:[],seed:153});
  expect(next.inks).not.toBe(original.inks);expect(next.selectedIds).not.toBe(original.selectedIds);
 });
 it('produces valid, reproducible settings with visible changes across every parameter family',()=>{
  const recipes=Array.from({length:30},(_,i)=>regenerateSettings({...DEFAULTS,selectedIds:['a','b']},i));
  for(const next of recipes){expect(normalizeSettings(next)).toEqual(next);expect(next.zoomMax).toBeGreaterThan(next.zoomMin);expect(next.sourceXMax).toBeGreaterThan(next.sourceXMin);expect(next.inks.some(i=>i.enabled)).toBe(true);}
  const fixed=['background','width','height','dpi','selectedIds','cellPins'];
  for(const key of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[])if(!fixed.includes(key))expect(new Set(recipes.map(s=>JSON.stringify(s[key]))).size,`${key} must vary`).toBeGreaterThan(1);
  expect(regenerateSettings(DEFAULTS,18)).toEqual(regenerateSettings(DEFAULTS,18));
 });
 it('favors square grids while exploring small grids, rectangles and both strip orientations',()=>{
  const grids=Array.from({length:5000},(_,seed)=>regenerateSettings(DEFAULTS,seed));
  const squareRate=grids.filter(s=>s.rows===s.columns).length/grids.length;
  expect(squareRate).toBeGreaterThan(.88);expect(squareRate).toBeLessThan(.92);
  const shapes=new Set(grids.map(s=>`${s.rows}x${s.columns}`));
  for(const shape of ['2x2','3x3','4x4','1x12','12x1'])expect(shapes.has(shape),shape).toBe(true);
  expect(grids.some(s=>s.rows>1&&s.columns>1&&s.rows!==s.columns)).toBe(true);
  expect(grids.every(s=>s.rows*s.columns>=2)).toBe(true);
 });
 it('handles an empty source library',()=>{
  expect(regenerateSettings({...DEFAULTS,selectedIds:[]},5)).toMatchObject({selectedIds:[],multiscaleSource:''});
 });
});

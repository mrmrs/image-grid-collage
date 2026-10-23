import { describe, it, expect } from 'vitest';
import UTIF from 'utif';
import { encodeTiff } from '../src/engine/tiff';
import { random, noise, cmyk, screenThreshold } from '../src/engine/math';
import { DEFAULTS, cloneSettings, normalizeSettings, exportDimensions } from '../src/model';
import { chooseTile } from '../src/engine/render';
import type { Tile } from '../src/engine/render';
describe('print export',()=>{
  it.each([72,300,600])('encodes RGB pixels and %i DPI tags readable by an independent TIFF decoder',dpi=>{
    const pixels=new Uint8Array([255,0,0,0,255,0,0,0,255,255,255,255]);const bytes=encodeTiff(pixels,2,2,dpi);
    const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);const [ifd]=UTIF.decode(buffer);
    expect(ifd.t282[0]).toBe(dpi);expect(ifd.t283[0]).toBe(dpi);expect(ifd.t296[0]).toBe(2);
    UTIF.decodeImage(buffer,ifd);expect(Array.from(UTIF.toRGBA8(ifd))).toEqual([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
  });
  it('encodes grayscale halftone plates as black ink on white paper',()=>{
    const bytes=encodeTiff(new Uint8Array([0,255,255,0]),2,2,300,1);const [ifd]=UTIF.decode(bytes.buffer);UTIF.decodeImage(bytes.buffer,ifd);
    expect(ifd.t262[0]).toBe(1);expect(Array.from(UTIF.toRGBA8(ifd))).toEqual([0,0,0,255,255,255,255,255,255,255,255,255,0,0,0,255]);
  });
  it('uses physical size and guards export memory',()=>{expect(exportDimensions(DEFAULTS)).toEqual({width:3000,height:3000});expect(()=>exportDimensions({...DEFAULTS,width:40,dpi:1200})).toThrow('20 megapixels');});
});
describe('deterministic composition',()=>{
  it('reproduces random values and changes with the seed',()=>{expect(random(12,4,2)).toBe(random(12,4,2));expect(random(12,4,2)).not.toBe(random(13,4,2));});
  it('has continuous bounded noise across lattice boundaries',()=>{expect(Math.abs(noise(1-.0001,.3,8)-noise(1+.0001,.3,8))).toBeLessThan(.001);for(let i=0;i<100;i++)expect(noise(i*.1,i*.15,8)).toBeGreaterThanOrEqual(0);});
  it('selects reproducible source fragments for every arrangement',()=>{
    const tiles=Array.from({length:48},(_,i)=>({sourceIndex:Math.floor(i/16),tileIndex:i%16,color:[i*5,80,255-i*5]} as Tile));
    for(const distribution of ['random','gradient','radial','noise','color','luminance','checkerboard','stripes','ordered'] as const){const s={...cloneSettings(DEFAULTS),distribution};const a=Array.from({length:64},(_,i)=>chooseTile(tiles,s,Math.floor(i/8),i%8));const b=Array.from({length:64},(_,i)=>chooseTile(tiles,s,Math.floor(i/8),i%8));expect(a).toEqual(b);expect(a.every(t=>tiles.includes(t))).toBe(true);}
  });
});
describe('color and screen math',()=>{
  it('separates paper, black, and primary process colors',()=>{expect(cmyk(1,1,1)).toEqual([0,0,0,0]);expect(cmyk(0,0,0)).toEqual([0,0,0,1]);expect(cmyk(0,1,1)).toEqual([1,0,0,0]);expect(cmyk(0,0,0,0)).toEqual([1,1,1,0]);});
  it.each(['dots','lines','diamonds','squares'])('%s screens preserve requested area coverage',pattern=>{
    for(const tone of [.1,.25,.5,.75,.9]){let covered=0;const n=500;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(tone>screenThreshold((x+.5)/n,(y+.5)/n,pattern))covered++;expect(Math.abs(covered/(n*n)-tone)).toBeLessThan(.012);}
  });
});
describe('recipe validation',()=>{
  it('round trips every setting and preserves snapshots',()=>{const saved=cloneSettings(DEFAULTS);const restored=normalizeSettings(JSON.parse(JSON.stringify(saved)));expect(restored).toEqual(saved);restored.inks[0].color='#abcdef';expect(saved.inks[0].color).toBe('#00a6c8');});
  it('rejects malformed settings and clamps unreasonable counts',()=>{expect(()=>normalizeSettings({rows:'oops'})).toThrow();expect(()=>normalizeSettings({distribution:'unknown'})).toThrow();expect(()=>normalizeSettings({inks:[]})).toThrow();expect(normalizeSettings({rows:9999,columns:0,sourceRows:2.3}).rows).toBe(80);expect(normalizeSettings({columns:0}).columns).toBe(1);});
});

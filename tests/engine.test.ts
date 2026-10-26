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
    for(const distribution of ['random','gradient','radial','noise','color','luminance','checkerboard','stripes','ordered'] as const){const s={...cloneSettings(DEFAULTS),crop:'random' as const,distribution};const a=Array.from({length:64},(_,i)=>chooseTile(tiles,s,Math.floor(i/8),i%8));const b=Array.from({length:64},(_,i)=>chooseTile(tiles,s,Math.floor(i/8),i%8));expect(a).toEqual(b);expect(a.every(t=>tiles.includes(t))).toBe(true);}
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

describe('reconstructed image weave',()=>{
  const images=[{width:1200,height:800},{width:800,height:1200}];
  const tilesFor=(rows:number,columns:number)=>images.flatMap((image,sourceIndex)=>Array.from({length:rows*columns},(_,tileIndex)=>({image,sourceIndex,sourceId:String(sourceIndex),tileIndex,sx:0,sy:0,sw:1,sh:1,color:[0,0,0]} as Tile)));
  it.each([[12,12],[2,2],[3,5],[1,12],[12,1]])('alternates matching pieces on a %i × %i output independently of source slicing', (rows,columns)=>{
    const s={...cloneSettings(DEFAULTS),rows,columns};
    const tiles=tilesFor(4,4),otherTiles=tilesFor(2,3);
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const tile=chooseTile(tiles,s,row,col),sourceIndex=(row+col)%2,image=images[sourceIndex];
      expect(tile.sourceIndex).toBe(sourceIndex);
      expect(tile.sx).toBeCloseTo((image.width-800)/2+col*800/columns);
      expect(tile.sy).toBeCloseTo((image.height-800)/2+row*800/rows);
      expect(tile.sw).toBeCloseTo(800/columns);expect(tile.sh).toBeCloseTo(800/rows);
      expect(chooseTile(otherTiles,{...s,sourceRows:2,sourceColumns:3},row,col)).toEqual(tile);
    }
  });
  it('covers a rectangular print once, allowing for its border',()=>{
    const s={...cloneSettings(DEFAULTS),width:12,height:6,margin:10,rows:2,columns:4};
    const tile=chooseTile(tilesFor(4,4),s,1,3);
    // Inner print is 10.8 × 4.8; a 1200 × 533⅓ crop fills it without stretching.
    expect(tile.sx).toBeCloseTo(900);expect(tile.sw).toBeCloseTo(300);
    expect(tile.sy).toBeCloseTo(400);expect(tile.sh).toBeCloseTo(1200/2.25/2);
  });
});

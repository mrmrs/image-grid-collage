import {describe,it,expect} from 'vitest';
import {DEFAULTS,cloneSettings,normalizeSettings} from '../src/model';
import {blurField,sampleField,linearRGB,toSRGB} from '../src/engine/analysis';
import {edgeCost,solveContours} from '../src/engine/contours';
import {planGrid,separate} from '../src/engine/render';
import type {Tile} from '../src/engine/render';
import {buildFlowField,flowDisplacement} from '../src/engine/flow';

describe('visual system recipes',()=>{
  it('migrates older recipes and preserves all new controls and pins',()=>{
    expect(normalizeSettings({rows:12}).multiscale).toBe(false);
    const recipe={...cloneSettings(DEFAULTS),distribution:'contour',multiscale:true,multiscaleSource:'photo',screenMode:'contour',cellPins:[{cell:0,sourceId:'photo',sx:.1,sy:.2,sw:.4,sh:.5,turn:6}]};
    expect(normalizeSettings(JSON.parse(JSON.stringify(recipe)))).toEqual(recipe);
    expect(()=>normalizeSettings({cellPins:[{...recipe.cellPins[0],sw:2}]})).toThrow();
    expect(()=>normalizeSettings({multiscaleSource:22})).toThrow();
    expect(normalizeSettings({echoLevels:3.7})).toMatchObject({echoLevels:4});
  });
  it('creates reproducible crops of one image at distinct magnifications and honors pins',()=>{
    const tile={image:{width:1200,height:800},sourceId:'photo',sourceIndex:0,tileIndex:0,sx:0,sy:0,sw:1200,sh:800,color:[0,0,0]} as Tile;
    const s={...DEFAULTS,sourceRows:1,sourceColumns:1,distribution:'random' as const,multiscale:true};
    const plan=planGrid([tile],s);
    expect(new Set(plan.map(t=>t.sw))).toEqual(new Set([1200,600,300]));
    expect(plan).toEqual(planGrid([tile],s));
    expect(plan.every(t=>t.sx>=0&&t.sx+t.sw<=1200&&t.sy>=0&&t.sy+t.sh<=800)).toBe(true);
    const pinned=planGrid([tile],{...s,seed:999,cellPins:[{cell:3,sourceId:'photo',sx:.2,sy:.1,sw:.4,sh:.5,turn:5}]});
    expect(pinned[3]).toMatchObject({sx:240,sy:80,sw:480,sh:400,turn:5});
  });
});
describe('contour relationships',()=>{
  const profile=(height:number)=>Float32Array.from({length:64},(_,i)=>i%16<height?.1:.9);
  it('rewards aligned contour crossings',()=>{
    expect(edgeCost(profile(4),1,profile(4),3)).toBe(0);
    expect(edgeCost(profile(4),1,profile(10),3)).toBeGreaterThan(.1);
  });
  it('reduces neighbor discontinuity and keeps a pinned fragment fixed',()=>{
    const candidates=Array.from({length:12},(_,i)=>({tile:{tileIndex:i,sourceIndex:i} as Tile,edges:profile(i+2),fixedCell:i===7?0:undefined}));
    const s={...DEFAULTS,rows:1,columns:20,contourContinuity:1,contourBreaks:0,contourDiversity:0};
    const plan=solveContours(candidates,s),broken=solveContours(candidates,{...s,contourBreaks:1});
    const error=(tiles:Tile[])=>tiles.slice(1).reduce((sum,t,i)=>sum+edgeCost(candidates[tiles[i].tileIndex].edges,1,candidates[t.tileIndex].edges,3),0);
    expect(plan[0].tileIndex).toBe(7);expect(error(plan)).toBeLessThan(error(broken)*.3);
    expect(plan).toEqual(solveContours(candidates,s));
  });
});
describe('multiscale filtering',()=>{
  it('preserves constant color, handles narrow images, and interpolates smoothly',()=>{
    for(const [w,h] of [[32,16],[1,32],[32,1]]){
      const field=blurField(new Float32Array(w*h*3).fill(.4),w,h,3,5);
      expect([...field].every(v=>Math.abs(v-.4)<.00001)).toBe(true);
    }
    expect(sampleField(new Float32Array([0,1]),2,1,.5,.5)).toBeCloseTo(.5);
    for(let value=0;value<256;value++)expect(Math.abs(toSRGB(linearRGB[value])-value)).toBeLessThanOrEqual(1);
  });
});
describe('contour screening',()=>{
  const flat=(tone:number)=>({width:240,height:240,data:Uint8ClampedArray.from({length:240*240*4},(_,i)=>i%4===3?255:tone)} as ImageData);
  it('preserves regular screens exactly at zero follow strength',()=>{
    const image=flat(128),s={...DEFAULTS,width:2,height:2,lpi:12};
    const a=separate(image,s),b=separate(image,{...s,screenMode:'contour',flowStrength:0});
    expect(a.map(p=>p.coverage)).toEqual(b.map(p=>p.coverage));
  });
  it('keeps uniform tone coverage and produces binary export plates',()=>{
    for(const gray of [32,96,160,224]){
      const plates=separate(flat(gray),{...DEFAULTS,width:2,height:2,lpi:12,screenMode:'contour',pattern:'lines',flowStrength:.8});
      const black=plates[3].coverage;
      expect(new Set(black)).toEqual(new Set([0,255]));
      expect(Math.abs(black.reduce((a,b)=>a+b/255,0)/black.length-(1-gray/255))).toBeLessThan(.035);
    }
  });
  it('uses continuous image-driven displacement, with optional cell boundary anchoring',()=>{
    const image=flat(0);for(let y=0;y<240;y++)for(let x=0;x<240;x++)for(let c=0;c<3;c++)image.data[(y*240+x)*4+c]=x/239*255;
    const s={...DEFAULTS,width:2,height:2,margin:0},field=buildFlowField(image,s);
    expect(flowDisplacement(field,.2,.5,s)).toBeLessThan(flowDisplacement(field,.8,.5,s));
    expect(Math.abs(flowDisplacement(field,.5-1e-6,.5,s)-flowDisplacement(field,.5+1e-6,.5,s))).toBeLessThan(.01);
    expect(flowDisplacement(field,.25,.3,{...s,flowAcrossCells:false})).toBeCloseTo(0);
  });
});

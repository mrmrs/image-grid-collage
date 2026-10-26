import {bounds,cloneSettings,DEFAULTS,normalizeSettings,settingEnums} from '../model';
import type {Settings} from '../model';
import {random} from './math';

const GRID_SIZES=[2,3,4,5,6,8,12,16,18,24,28] as const;

/** A reproducible new recipe. Paper color, physical output and the user's source collection stay fixed. */
export function regenerateSettings(current:Settings,seed:number):Settings{
  let channel=0;
  const r=()=>random(seed,channel++,97);
  const between=(min:number,max:number)=>min+r()*(max-min);
  const pick=<T,>(values:readonly T[]):T=>values[Math.floor(r()*values.length)];
  const color=()=>`#${Math.floor(r()*0x1000000).toString(16).padStart(6,'0')}`;
  const next=cloneSettings(current),values=next as unknown as Record<string,unknown>;
  const fixed=new Set(['background','width','height','dpi','selectedIds','cellPins','inks','spotInks','multiscaleSource']);
  for(const key of Object.keys(DEFAULTS)){
    if(fixed.has(key))continue;
    if(settingEnums[key])values[key]=pick(settingEnums[key]);
    else if(bounds[key])values[key]=Number(between(...bounds[key]).toFixed(2));
    else if(typeof values[key]==='boolean')values[key]=r()<.5;
    else if(typeof values[key]==='string')values[key]=color();
  }
  // 90% squares, 5% strips, 5% other rectangles. Never generate a 1×1 grid.
  // Mix the seed before independent grid draws so consecutive seeds explore every shape.
  const gridSeed=Math.floor(random(seed,0,131)*4294967296);
  const size=GRID_SIZES[Math.floor(random(gridSeed,0,197)*GRID_SIZES.length)],layout=random(gridSeed,1,197);
  let rows:number=size,columns:number=size;
  if(layout>=.9){
    if(layout<.95){if(random(gridSeed,2,197)<.5)rows=1;else columns=1;}
    else {const otherSizes=GRID_SIZES.filter(n=>n!==rows);columns=otherSizes[Math.floor(random(gridSeed,2,197)*otherSizes.length)];}
  }
  // Sample useful ranges without making most compositions tiny, over-rotated, or unreadable.
  Object.assign(next,{
    seed,cellPins:[],rows,columns,
    sourceRows:pick([2,3,4,6,8,12]),sourceColumns:pick([2,3,4,6,8,12]),
    gap:pick([0,0,1,2,4,8]),margin:pick([0,2,4,6,8]),
    scale:between(.8,1.15),variation:between(.05,.5),rotation:pick([0,0,0,45,90,-45]),rotationJitter:pick([0,0,3,8,15]),
    saturation:between(.85,1.2),contrast:between(.85,1.2),
    multiscale:r()<.85,multiscaleMode:pick(['echo','echo','fragments']),multiscaleSource:pick(current.selectedIds)??'',
    zoomMin:pick([1,1,1,1.5,2]),zoomMax:pick([16,32,64,128,256,512,1024]),zoomLevels:pick([2,3,4,5,6,8]),
    sourceXMin:between(0,25),sourceXMax:between(75,100),sourceYMin:between(0,25),sourceYMax:between(75,100),
    contourCrop:between(0,.3),contourTurn:pick([0,3,6,12]),
    halftone:r()<.3,lpi:between(8,32),gain:between(-.15,.2),flowStrength:between(.2,.85),
    motionDuration:between(.4,1.5),motionHold:between(.2,2),motionGroupSize:pick([2,4,8,16]),motionOverlap:between(.2,.8),motionSeedStep:pick([1,2,3,7,13]),
  });
  for(const key of ['inks','spotInks'] as const)next[key]=next[key].map((ink,i)=>({...ink,color:color(),angle:Math.round(between(0,180)),density:between(.6,1.3),enabled:i===0||r()<.85}));
  return normalizeSettings(next);
}

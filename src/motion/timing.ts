import type { Settings, MotionPattern } from '../model';
import { clamp, random } from '../engine/math';

export const MOTION_PATTERNS: {id:MotionPattern;name:string;description:string;mark:string}[] = [
  { id:'sweep', name:'Silk wave', description:'A diagonal curtain of fresh fragments.', mark:'↘' },
  { id:'ripple', name:'Bloom', description:'Circular reveals radiate from the center.', mark:'◎' },
  { id:'scatter', name:'Fireflies', description:'Small constellations dissolve into new images.', mark:'✧' },
  { id:'flip', name:'Turn the tiles', description:'Alternating shutters fold into another scene.', mark:'◧' },
  { id:'slide', name:'Tidal rows', description:'Rows glide in alternating directions.', mark:'⇄' },
];
export function variationSeed(seed:number, iteration:number, step:number) {
  return (seed + iteration * step) % 2147483648;
}
export function motionTiming(s:Settings) {
  const count=s.rows*s.columns;
  const batch=s.motionGrouping==='single'?1:s.motionGrouping==='together'?count:Math.min(count,s.motionGroupSize);
  const groups=Math.ceil(count/batch), overlap=s.motionGrouping==='single'?0:s.motionOverlap;
  const gap=s.motionDuration*(1-overlap);
  return {batch,groups,gap,duration:s.motionDuration+(groups-1)*gap};
}
/** Stable, seeded cell ordering. Batch size controls simultaneous starts, overlap controls concurrency. */
export function cellSchedule(s:Settings, seed:number):Float64Array {
  const cells=Array.from({length:s.rows*s.columns},(_,index)=>{
    const row=Math.floor(index/s.columns),col=index%s.columns;
    const x=(col+.5)/s.columns,y=(row+.5)/s.rows;
    let score=0;
    switch(s.motionPattern){
      case 'sweep':score=x+y;break;
      case 'ripple':score=Math.hypot(x-.5,y-.5);break;
      case 'scatter':score=random(seed,index,42);break;
      case 'flip':score=((row+col)%2)*4+x+y;break;
      case 'slide':score=row+(row%2?1-x:x)*.9;break;
    }
    return {index,score};
  });
  cells.sort((a,b)=>a.score-b.score||a.index-b.index);
  if(s.motionDirection==='reverse')cells.reverse();
  const schedule=new Float64Array(cells.length),{batch,gap}=motionTiming(s);
  cells.forEach((cell,rank)=>{schedule[cell.index]=Math.floor(rank/batch)*gap;});
  return schedule;
}
export const cellProgress=(elapsed:number,start:number,duration:number)=>clamp((elapsed-start)/duration);
export const ease=(t:number)=>t*t*t*(t*(t*6-15)+10);
/** Motion settings and print-only resolution do not invalidate the still preview. */
export function artworkKey(settings:Settings) {
  return JSON.stringify(Object.fromEntries(Object.entries(settings).filter(([k])=>!k.startsWith('motion')&&k!=='dpi')));
}

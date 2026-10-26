import type {Settings,ZoomDistribution} from '../model';
import type {Tile} from './tile';
import {clamp,noise,random} from './math';

export const ZOOM_DISTRIBUTIONS:{id:ZoomDistribution;label:string}[]=[
  {id:'spiral',label:'Spiral'},{id:'tiled-spiral',label:'Tiled spirals'},
  {id:'rings',label:'Concentric rings'},{id:'radial',label:'Center outward'},
  {id:'diagonal',label:'Diagonal steps'},{id:'rows',label:'Row steps'},{id:'columns',label:'Column steps'},
  {id:'checkerboard',label:'Alternating levels'},{id:'sequence',label:'Repeating sequence'},
  {id:'noise',label:'Smooth noise'},{id:'random',label:'Random'},
];
const fract=(n:number)=>n-Math.floor(n);
export function zoomLevels(s:Settings){
  return Array.from({length:s.zoomLevels},(_,i)=>s.zoomLevels===1?s.zoomMin:i===s.zoomLevels-1?s.zoomMax:s.zoomMin*(s.zoomMax/s.zoomMin)**(i/(s.zoomLevels-1)));
}
/** A spatial field assigns discrete magnifications; it never changes color or cell geometry. */
export function zoomLevelAt(s:Settings,row:number,col:number){
  const x=s.columns===1?.5:col/(s.columns-1),y=s.rows===1?.5:row/(s.rows-1);
  let dx=(x-.5)*s.width,dy=(y-.5)*s.height,t=0;
  const phase=s.zoomPhase+random(s.seed,0,71);
  const radial=()=>Math.hypot(dx,dy)/Math.hypot(s.width/2,s.height/2);
  switch(s.zoomDistribution){
    case 'tiled-spiral':
      dx=(fract((col+.5)/s.columns*s.zoomRepeats)-.5)*s.width;
      dy=(fract((row+.5)/s.rows*s.zoomRepeats)-.5)*s.height;
      // Each module shares the same spiral, so repetition stays deliberate.
    case 'spiral':t=fract(Math.atan2(dy,dx)/(Math.PI*2)+radial()*s.zoomTurns+phase);break;
    case 'rings':t=fract(radial()*s.zoomRepeats+phase);break;
    case 'radial':t=1-clamp(radial());break;
    case 'diagonal':t=(x+y)/2;break;
    case 'rows':t=y;break;
    case 'columns':t=x;break;
    case 'checkerboard':t=((row+col)%s.zoomLevels)/Math.max(1,s.zoomLevels-1);break;
    case 'sequence':t=((row*s.columns+col)%s.zoomLevels)/Math.max(1,s.zoomLevels-1);break;
    case 'noise':t=noise(x*s.zoomRepeats,y*s.zoomRepeats,s.seed);break;
    case 'random':t=random(s.seed,row*s.columns+col,61);break;
  }
  const level=Math.min(s.zoomLevels-1,Math.floor(clamp(t)*s.zoomLevels));
  return s.zoomReverse?s.zoomLevels-1-level:level;
}
export function zoomGrid(s:Settings){
  const levels=zoomLevels(s);
  return Array.from({length:s.rows*s.columns},(_,i)=>levels[zoomLevelAt(s,Math.floor(i/s.columns),i%s.columns)]);
}
/** Focus is normalized within the source crop. At 1× the source covers the cell at the chosen focus. */
export function zoomTile(tile:Tile,zoom:number,s:Settings):Tile{
  const margin=Math.min(s.width,s.height)*s.margin/100;
  const aspect=((s.width-2*margin)/s.columns)/((s.height-2*margin)/s.rows);
  const sw=Math.min(tile.sw,tile.sh*aspect)/zoom,sh=sw/aspect;
  return {...tile,sx:tile.sx+(tile.sw-sw)*s.zoomFocusX/100,sy:tile.sy+(tile.sh-sh)*s.zoomFocusY/100,sw,sh};
}

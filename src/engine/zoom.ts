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
  // Pull field values toward the endpoints, keeping spatial order and the exact zoom bounds.
  const centered=2*clamp(t)-1;
  const emphasized=.5+.5*Math.sign(centered)*Math.abs(centered)**(1/(1+8*s.zoomContrast));
  const level=Math.min(s.zoomLevels-1,Math.floor(clamp(emphasized)*s.zoomLevels));
  return s.zoomReverse?s.zoomLevels-1-level:level;
}
export function zoomGrid(s:Settings){
  const levels=zoomLevels(s);
  return Array.from({length:s.rows*s.columns},(_,i)=>levels[zoomLevelAt(s,Math.floor(i/s.columns),i%s.columns)]);
}
export const POSITION_DISTRIBUTIONS = [
  ['columns','Across columns'],['rows','Across rows'],['sequence','Scan source grid'],
  ['random','Random'],['noise','Smooth noise'],['spiral','Spiral path'],
  ['tiled','Repeated modules'],['fixed','Fixed position'],
] as const;
/** Independent spatial fields locate crop centers within the source, before magnification. */
export function sourcePositionAt(s:Settings,row:number,col:number):[number,number]{
  const x=(col+.5)/s.columns,y=(row+.5)/s.rows,index=row*s.columns+col;
  const phase=s.sourcePositionPhase,repeats=s.sourcePositionRepeats;
  const t=(index+.5)/(s.rows*s.columns),angle=(t*repeats+phase)*Math.PI*2,radius=.5*Math.sqrt(t);
  const axis=(axis:0|1)=>{
    const mode=axis===0?s.sourceXDistribution:s.sourceYDistribution;
    const n=axis===0?s.sourceColumns:s.sourceRows;
    let value=.5;
    switch(mode){
      case 'columns':value=fract(x+phase);break;
      case 'rows':value=fract(y+phase);break;
      case 'sequence':{
        const cell=(index+Math.floor(phase*s.sourceColumns*s.sourceRows))%(s.sourceColumns*s.sourceRows);
        value=axis===0?(cell%s.sourceColumns+.5)/s.sourceColumns:(Math.floor(cell/s.sourceColumns)+.5)/s.sourceRows;break;
      }
      case 'random':value=random(s.seed,index,83+axis);break;
      case 'noise':value=noise(x*repeats+phase*4,y*repeats+phase*4,s.seed+809+axis*131);break;
      case 'spiral':value=.5+radius*(axis===0?Math.cos(angle):Math.sin(angle));break;
      case 'tiled':value=fract((axis===0?x:y)*repeats+phase);break;
      case 'fixed':value=.5;break;
    }
    const low=(axis===0?s.sourceXMin:s.sourceYMin)/100,high=(axis===0?s.sourceXMax:s.sourceYMax)/100;
    const position=low+(high-low)*clamp(value);
    // Restrict snapping to cell centers inside the requested range; narrow ranges remain continuous.
    const first=Math.max(0,Math.ceil(low*n-.5)),last=Math.min(n-1,Math.floor(high*n-.5));
    return s.sourceSnap&&first<=last?(Math.max(first,Math.min(last,Math.floor(position*n)))+.5)/n:position;
  };
  return [axis(0),axis(1)];
}
/** Anchor each crop on a source location, preserving that center as magnification changes. */
export function zoomTile(tile:Tile,zoom:number,s:Settings,row=0,col=0):Tile{
  const margin=Math.min(s.width,s.height)*s.margin/100;
  const aspect=((s.width-2*margin)/s.columns)/((s.height-2*margin)/s.rows);
  const sw=Math.min(tile.sw,tile.sh*aspect)/zoom,sh=sw/aspect;
  const [x,y]=sourcePositionAt(s,row,col);
  return {...tile,sx:tile.sx+Math.max(0,Math.min(tile.sw-sw,x*tile.sw-sw/2)),sy:tile.sy+Math.max(0,Math.min(tile.sh-sh,y*tile.sh-sh/2)),sw,sh};
}

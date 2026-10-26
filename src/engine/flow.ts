import type {Settings} from '../model';
import {analysisSize,blurField,sampleField} from './analysis';

export interface FlowField {width:number;height:number;values:Float32Array;amplitude:number}
/** A continuous scalar field bends screen phase without rotating disconnected pixel patches. */
export function buildFlowField(image:ImageData,s:Settings):FlowField{
  const size=analysisSize(s.width/s.height),values=new Float32Array(size.width*size.height);
  // Area-average all input samples into the bounded analysis field to avoid sampling aliasing.
  for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++){
    const x0=Math.floor(x*image.width/size.width),x1=Math.max(x0+1,Math.floor((x+1)*image.width/size.width));
    const y0=Math.floor(y*image.height/size.height),y1=Math.max(y0+1,Math.floor((y+1)*image.height/size.height));
    let sum=0,n=0;
    for(let sy=y0;sy<Math.min(y1,image.height);sy++)for(let sx=x0;sx<Math.min(x1,image.width);sx++){
      const k=(sy*image.width+sx)*4;sum+=(image.data[k]*.2126+image.data[k+1]*.7152+image.data[k+2]*.0722)/255;n++;
    }
    values[y*size.width+x]=sum/Math.max(1,n);
  }
  const smooth=blurField(values,size.width,size.height,1,Math.max(1,Math.min(size.width,size.height)*s.flowSmoothing/100));
  let slope=1;
  for(let y=1;y<size.height-1;y++)for(let x=1;x<size.width-1;x++){
    const k=y*size.width+x,dx=(smooth[k+1]-smooth[k-1])*size.width/2,dy=(smooth[k+size.width]-smooth[k-size.width])*size.height/2*s.width/s.height;
    slope=Math.max(slope,Math.hypot(dx,dy));
  }
  return {...size,values:smooth,amplitude:Math.min(.45,1.5/slope)};
}
export function flowDisplacement(field:FlowField,x:number,y:number,s:Settings){
  let value=sampleField(field.values,field.width,field.height,x,y);
  if(!s.flowAcrossCells){
    const margin=Math.min(s.width,s.height)*s.margin/100,mx=margin/s.width,my=margin/s.height;
    const gx=(x-mx)/(1-2*mx)*s.columns,gy=(y-my)/(1-2*my)*s.rows;
    const fx=gx-Math.floor(gx),fy=gy-Math.floor(gy);
    // Fade displacement at grid boundaries: cells can have separate screen behavior without phase jumps.
    value=.5+(value-.5)*Math.sin(Math.PI*fx)**2*Math.sin(Math.PI*fy)**2;
  }
  return (value-.5)*s.flowStrength*s.width*s.lpi*field.amplitude;
}

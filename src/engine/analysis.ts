import { clamp } from './math';

/** Analysis uses a bounded, resolution-independent grid shared by preview and print. */
export function analysisSize(aspect:number,edge=384){
  return {width:Math.max(1,Math.round(edge*Math.min(1,aspect))),height:Math.max(1,Math.round(edge/Math.max(1,aspect)))};
}
/** Three separable box passes approximate a Gaussian, with clamped boundaries. */
export function blurField(input:Float32Array,width:number,height:number,channels:number,radius:number){
  const r=Math.max(0,Math.round(radius));
  if(!r)return input.slice();
  let a=input.slice();const b=new Float32Array(a.length),span=2*r+1;
  for(let pass=0;pass<3;pass++){
    for(let y=0;y<height;y++)for(let c=0;c<channels;c++){
      let sum=0;for(let k=-r;k<=r;k++)sum+=a[(y*width+clamp(k,0,width-1))*channels+c];
      for(let x=0;x<width;x++){b[(y*width+x)*channels+c]=sum/span;sum+=a[(y*width+clamp(x+r+1,0,width-1))*channels+c]-a[(y*width+clamp(x-r,0,width-1))*channels+c];}
    }
    for(let x=0;x<width;x++)for(let c=0;c<channels;c++){
      let sum=0;for(let k=-r;k<=r;k++)sum+=b[(clamp(k,0,height-1)*width+x)*channels+c];
      for(let y=0;y<height;y++){a[(y*width+x)*channels+c]=sum/span;sum+=b[(clamp(y+r+1,0,height-1)*width+x)*channels+c]-b[(clamp(y-r,0,height-1)*width+x)*channels+c];}
    }
  }
  return a;
}
export function sampleField(data:Float32Array,width:number,height:number,x:number,y:number,channels=1,c=0){
  const px=clamp(x*width-.5,0,width-1),py=clamp(y*height-.5,0,height-1),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
  const x1=Math.min(ix+1,width-1),y1=Math.min(iy+1,height-1);
  return (data[(iy*width+ix)*channels+c]*(1-fx)+data[(iy*width+x1)*channels+c]*fx)*(1-fy)+(data[(y1*width+ix)*channels+c]*(1-fx)+data[(y1*width+x1)*channels+c]*fx)*fy;
}

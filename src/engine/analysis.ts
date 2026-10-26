import { clamp } from './math';

/** Analysis uses a bounded, resolution-independent grid shared by preview and print. */
export function analysisSize(aspect:number,edge=384){
  return {width:Math.max(1,Math.round(edge*Math.min(1,aspect))),height:Math.max(1,Math.round(edge/Math.max(1,aspect)))};
}
export const linearRGB=Float32Array.from({length:256},(_,v)=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
const srgb=Uint8Array.from({length:8193},(_,i)=>{const x=i/8192;return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));});
export const toSRGB=(v:number)=>srgb[Math.round(clamp(v)*8192)];
export function linearPixels(data:Uint8ClampedArray){
  const result=new Float32Array(data.length/4*3);
  for(let p=0;p<data.length/4;p++)for(let c=0;c<3;c++)result[p*3+c]=linearRGB[data[p*4+c]];
  return result;
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
export function coverCrop(image:{width:number;height:number},aspect:number,zoom=1){
  const sw=Math.min(image.width,image.height*aspect)/zoom,sh=sw/aspect;
  return {sx:(image.width-sw)/2,sy:(image.height-sh)/2,sw,sh};
}

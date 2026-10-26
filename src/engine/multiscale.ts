import type {Settings} from '../model';
import {clamp} from './math';
import {analysisSize,blurField,coverCrop,linearPixels,linearRGB,sampleField,toSRGB} from './analysis';

/** Replace broad image structure while retaining the actual photographic high-frequency detail. */
export function applyMultiscale(detail:OffscreenCanvas,source:ImageBitmap,s:Settings){
  const {width,height}=detail,margin=Math.min(width,height)*s.margin/100,aw=width-2*margin,ah=height-2*margin;
  const size=analysisSize(s.width/s.height),small=new OffscreenCanvas(size.width,size.height),ctx=small.getContext('2d',{willReadFrequently:true})!;
  ctx.fillStyle=s.background;ctx.fillRect(0,0,size.width,size.height);ctx.drawImage(detail,0,0,size.width,size.height);
  const radius=Math.max(1,Math.min(size.width,size.height)*s.multiscaleCrossover/100);
  const lowDetail=blurField(linearPixels(ctx.getImageData(0,0,size.width,size.height).data),size.width,size.height,3,radius);
  ctx.fillStyle=s.background;ctx.fillRect(0,0,size.width,size.height);
  const crop=coverCrop(source,aw/ah,s.multiscaleZoom),mx=margin/width*size.width,my=margin/height*size.height;
  ctx.filter=`saturate(${s.saturation}) contrast(${s.contrast})`;
  ctx.drawImage(source,crop.sx,crop.sy,crop.sw,crop.sh,mx,my,size.width-2*mx,size.height-2*my);
  const lowTarget=blurField(linearPixels(ctx.getImageData(0,0,size.width,size.height).data),size.width,size.height,3,radius);
  const out=detail.getContext('2d',{willReadFrequently:true})!,pixels=out.getImageData(0,0,width,height),paper=new OffscreenCanvas(1,1).getContext('2d')!;
  paper.fillStyle=s.background;paper.fillRect(0,0,1,1);const bg=paper.getImageData(0,0,1,1).data;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=(y*width+x)*4,a=pixels.data[k+3]/255;
    for(let c=0;c<3;c++){
      if(a===0){pixels.data[k+c]=bg[c];continue;}
      const low=sampleField(lowDetail,size.width,size.height,(x+.5)/width,(y+.5)/height,3,c);
      const target=sampleField(lowTarget,size.width,size.height,(x+.5)/width,(y+.5)/height,3,c);
      const original=linearRGB[pixels.data[k+c]];
      const base=low+s.multiscaleStrength*(target-low),bounded=clamp(base);
      // Reduce detail near black/white so clipping cannot overwhelm the broad image's tones.
      const headroom=1-s.multiscaleStrength+s.multiscaleStrength*(.12+.88*Math.sqrt(4*bounded*(1-bounded)));
      const value=base+s.multiscaleDetail*headroom*(original-low);
      pixels.data[k+c]=toSRGB(value*a+linearRGB[bg[c]]*(1-a));
    }
    pixels.data[k+3]=255;
  }
  out.putImageData(pixels,0,0);return detail;
}

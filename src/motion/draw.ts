import type { Settings } from '../model';
import { cellProgress, ease, motionTiming } from './timing';

/** Composite cached, already-screened frames. No image analysis or halftoning in the animation loop. */
export function drawTransition(canvas:HTMLCanvasElement,from:ImageBitmap,to:ImageBitmap,s:Settings,starts:Float64Array,elapsed:number,reduced=false){
  const ctx=canvas.getContext('2d')!;
  const {width,height}=canvas;
  ctx.globalAlpha=1;ctx.drawImage(from,0,0,width,height);
  const duration=motionTiming(s).duration;
  if(elapsed<=0)return;
  if(elapsed>=duration){ctx.drawImage(to,0,0,width,height);return;}
  if(reduced){ctx.globalAlpha=ease(elapsed/duration);ctx.drawImage(to,0,0,width,height);ctx.globalAlpha=1;return;}
  const margin=Math.min(width,height)*s.margin/100,cw=(width-2*margin)/s.columns,ch=(height-2*margin)/s.rows;
  // Paper stays still. Artwork extending into the margins dissolves without shifting cell centers.
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.rect(margin,margin,width-2*margin,height-2*margin);ctx.clip('evenodd');
  ctx.globalAlpha=ease(elapsed/duration);ctx.drawImage(to,0,0,width,height);ctx.restore();
  for(let row=0;row<s.rows;row++)for(let col=0;col<s.columns;col++){
    const t=cellProgress(elapsed,starts[row*s.columns+col],s.motionDuration);
    if(t<=0)continue;
    // Pixel-aligned grid partitions keep the reveal centered on each cell, regardless of paper margin.
    const x=Math.round(margin+col*cw),y=Math.round(margin+row*ch);
    const right=Math.round(margin+(col+1)*cw),bottom=Math.round(margin+(row+1)*ch);
    const w=right-x,h=bottom-y;
    if(t>=1){ctx.drawImage(to,x,y,w,h,x,y,w,h);continue;}
    const p=ease(t),cx=x+w/2,cy=y+h/2,reverse=s.motionDirection==='reverse'?-1:1;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    switch(s.motionPattern){
      case 'sweep':{
        ctx.beginPath();const reveal=w*p;
        ctx.rect(reverse===1?x:right-reveal,y,reveal,h);ctx.clip();
        ctx.drawImage(to,x,y,w,h,x,y,w,h);break;
      }
      case 'ripple':{
        ctx.beginPath();ctx.arc(cx,cy,Math.hypot(w,h)/2*p,0,Math.PI*2);ctx.clip();
        ctx.drawImage(to,x,y,w,h,x,y,w,h);break;
      }
      case 'scatter':{
        // Gentle focus pull, each group chosen by a seeded shuffle.
        ctx.globalAlpha=p;const scale=1+.28*s.motionIntensity*(1-p);
        ctx.drawImage(to,x,y,w,h,cx-w*scale/2,cy-h*scale/2,w*scale,h*scale);break;
      }
      case 'flip':{
        ctx.fillStyle=s.halftone?'#ffffff':s.background;ctx.fillRect(x,y,w,h);
        const squeeze=Math.max(.002,Math.abs(Math.cos(Math.PI*p)));
        const bitmap=p<.5?from:to;
        if((row+col)%2)ctx.drawImage(bitmap,x,y,w,h,x,cy-h*squeeze/2,w,h*squeeze);
        else ctx.drawImage(bitmap,x,y,w,h,cx-w*squeeze/2,y,w*squeeze,h);
        ctx.fillStyle=`rgba(20,25,18,${.34*s.motionIntensity*(1-squeeze)})`;ctx.fillRect(x,y,w,h);break;
      }
      case 'slide':{
        const direction=(row%2?-1:1)*reverse,offset=w*p*direction;
        ctx.drawImage(from,x,y,w,h,x+offset,y,w,h);
        ctx.drawImage(to,x,y,w,h,x+offset-w*direction,y,w,h);break;
      }
    }
    ctx.restore();
  }
}

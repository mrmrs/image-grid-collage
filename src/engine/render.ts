import type { Settings, SourceImage, Ink, Mask, CellPin } from '../model';
import { random, noise, clamp, rgb, cmyk, screenThreshold } from './math';
import { contourPlan } from './contours';
import { zoomGrid,zoomTile } from './zoom';
import { buildFlowField, flowDisplacement } from './flow';
import { drawFragment } from './tile';
import type { Tile } from './tile';
export type { Tile } from './tile';
const cache = new Map<string, Promise<ImageBitmap>>();
export async function loadSources(sources: SourceImage[]) {
  return Promise.all(sources.map(async source => {
    if (!cache.has(source.src)) cache.set(source.src, fetch(source.src).then(r => { if(!r.ok)throw new Error(`Could not load ${source.title}`);return r.blob(); }).then(b=>createImageBitmap(b)));
    try { return { source, image: await cache.get(source.src)! }; }
    catch(error) { cache.delete(source.src); throw error; }
  }));
}
export function makeTiles(images: { source: SourceImage; image: ImageBitmap }[], s: Settings): Tile[] {
  const tiles: Tile[] = [], size = 4;
  const canvas = new OffscreenCanvas(s.sourceColumns*size,s.sourceRows*size), ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  images.forEach(({image,source},sourceIndex)=>{
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    for(let row=0;row<s.sourceRows;row++)for(let col=0;col<s.sourceColumns;col++) {
      const color=[0,0,0];
      for(let y=0;y<size;y++)for(let x=0;x<size;x++) { const k=((row*size+y)*canvas.width+col*size+x)*4;for(let c=0;c<3;c++)color[c]+=data[k+c]/(size*size); }
      tiles.push({image,sourceId:source.id,sx:col*image.width/s.sourceColumns,sy:row*image.height/s.sourceRows,sw:image.width/s.sourceColumns,sh:image.height/s.sourceRows,color,sourceIndex,tileIndex:row*s.sourceColumns+col});
    }
  });
  return tiles;
}
function gradient(x:number,y:number,angle:number) { const a=angle*Math.PI/180, c=Math.cos(a),s=Math.sin(a);return clamp(.5+((x-.5)*c+(y-.5)*s)/(Math.abs(c)+Math.abs(s))); }
export function chooseTile(tiles: Tile[], s: Settings, row: number, col: number, sourceOffset=0): Tile {
  const index=row*s.columns+col, x=(col+.5)/s.columns,y=(row+.5)/s.rows, n=s.sourceRows*s.sourceColumns;
  const count=tiles.length/n, r=random(s.seed,index), grad=gradient(x,y,s.gradientAngle);
  let t=r, sourceIndex=0;
  switch(s.distribution) {
    case 'gradient':t=grad;break;
    case 'radial':t=clamp(Math.hypot(x-.5,y-.5)*Math.SQRT2);break;
    case 'noise':t=noise(x*s.noiseScale,y*s.noiseScale,s.seed);break;
    case 'checkerboard':t=((row+col)%count+.5)/count;break;
    case 'stripes':t=(col%count+.5)/count;break;
    case 'ordered':t=(index%count+.5)/count;break;
    case 'color': case 'luminance': {
      const a=rgb(s.colorStart),b=rgb(s.colorEnd),target=a.map((v,c)=>v+(b[c]-v)*grad);
      let best=Infinity,chosen=tiles[0];
      for(const tile of tiles) {
        const d=s.distribution==='luminance'?Math.abs(tile.color[0]*.2126+tile.color[1]*.7152+tile.color[2]*.0722-grad*255):Math.sqrt(tile.color.reduce((v,c,i)=>v+(c-target[i])**2,0));
        const score=d+random(s.seed,index+tile.tileIndex*8191+tile.sourceIndex*104729,5)*s.chaos*180;
        if(score<best){best=score;chosen=tile;}
      }
      return chosen;
    }
  }
  if(s.distribution!=='random')t=clamp(t+(random(s.seed,index,6)-.5)*s.chaos);
  sourceIndex=(Math.min(count-1,Math.floor(t*count))+sourceOffset)%count;
  if(s.crop==='reconstruct') {
    const tile=tiles[sourceIndex*n],image=tile.image;
    // Cover the entire composition once, then slice that crop into matching cells.
    // Use physical proportions so preview and print resolve the same source pixels.
    const margin=Math.min(s.width,s.height)*s.margin/100;
    const aspect=(s.width-2*margin)/(s.height-2*margin);
    const sw=Math.min(image.width,image.height*aspect),sh=sw/aspect;
    return {...tile,sx:(image.width-sw)/2+col*sw/s.columns,sy:(image.height-sh)/2+row*sh/s.rows,
      sw:sw/s.columns,sh:sh/s.rows};
  }
  const cropIndex=s.crop==='corresponding'?Math.min(s.sourceRows-1,Math.floor(y*s.sourceRows))*s.sourceColumns+Math.min(s.sourceColumns-1,Math.floor(x*s.sourceColumns)):s.crop==='ordered'?index%n:Math.floor(random(s.seed,index,1)*n);
  return tiles[sourceIndex*n+cropIndex];
}
function maskPath(ctx: OffscreenCanvasRenderingContext2D, mask: Mask, w:number,h:number) {
  ctx.beginPath();
  if(mask==='circle')ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);
  else if(mask==='diamond'){ctx.moveTo(0,-h/2);ctx.lineTo(w/2,0);ctx.lineTo(0,h/2);ctx.lineTo(-w/2,0);}
  else if(mask==='triangle'){ctx.moveTo(0,-h/2);ctx.lineTo(w/2,h/2);ctx.lineTo(-w/2,h/2);}
  else if(mask==='hexagon'){for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.lineTo(Math.cos(a)*w/2,Math.sin(a)*h/2);}}
  else if(mask==='arch'){ctx.moveTo(-w/2,h/2);ctx.lineTo(-w/2,0);ctx.ellipse(0,0,w/2,h/2,0,Math.PI,Math.PI*2);ctx.lineTo(w/2,h/2);}
  else ctx.rect(-w/2,-h/2,w,h);
  ctx.closePath();ctx.clip();
}
export function planGrid(tiles:Tile[],s:Settings,sourceOffset=0):Tile[]{
  if(!tiles.length)return [];
  let plan:Tile[];
  if(s.multiscale&&s.multiscaleMode==='echo'){
    const source=tiles.find(t=>t.sourceId===s.multiscaleSource)??tiles[0];
    const whole={...source,sx:0,sy:0,sw:source.image.width,sh:source.image.height,turn:0};
    plan=Array.from({length:s.rows*s.columns},()=>whole);
  }else plan=s.distribution==='contour'?contourPlan(tiles,s):Array.from({length:s.rows*s.columns},(_,i)=>chooseTile(tiles,s,Math.floor(i/s.columns),i%s.columns,sourceOffset));
  if(s.multiscale){const magnifications=zoomGrid(s);plan=plan.map((tile,i)=>zoomTile(tile,magnifications[i],s,Math.floor(i/s.columns),i%s.columns));}
  for(const pin of s.cellPins){
    const pinned=tiles.find(t=>t.sourceId===pin.sourceId);
    const source=pinned&&sourceOffset?tiles[((pinned.sourceIndex+sourceOffset)%(tiles.length/(s.sourceRows*s.sourceColumns)))*s.sourceRows*s.sourceColumns]:pinned;
    if(source&&pin.cell<plan.length)plan[pin.cell]={...source,sx:pin.sx*source.image.width,sy:pin.sy*source.image.height,sw:pin.sw*source.image.width,sh:pin.sh*source.image.height,turn:pin.turn};
  }
  return plan;
}
export function describePlan(plan:Tile[]):CellPin[]{return plan.map((t,cell)=>({cell,sourceId:t.sourceId??'',sx:t.sx/t.image.width,sy:t.sy/t.image.height,sw:t.sw/t.image.width,sh:t.sh/t.image.height,turn:t.turn??0}));}
export function renderGrid(tiles: Tile[], s:Settings,width:number,height:number,plan=planGrid(tiles,s)) {
  const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.fillStyle=s.background;ctx.fillRect(0,0,width,height);
  if(!tiles.length)return canvas;
  const margin=Math.min(width,height)*s.margin/100,cw=(width-margin*2)/s.columns,ch=(height-margin*2)/s.rows;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter=s.saturation===1&&s.contrast===1?'none':`saturate(${s.saturation}) contrast(${s.contrast})`;
  for(let row=0;row<s.rows;row++)for(let col=0;col<s.columns;col++) {
    const i=row*s.columns+col,x=(col+.5)/s.columns,y=(row+.5)/s.rows,tile=plan[i];
    const factor=s.scaleMode==='random'?random(s.seed,i,2):s.scaleMode==='noise'?noise(x*s.noiseScale,y*s.noiseScale,s.seed+55):s.scaleMode==='gradient'?gradient(x,y,s.gradientAngle):1;
    const scale=s.scale*(1-s.variation*(1-factor));
    const w=cw*(1-s.gap/100)*scale,h=ch*(1-s.gap/100)*scale;
    ctx.save();ctx.translate(margin+(col+.5)*cw,margin+(row+.5)*ch);
    ctx.rotate((s.rotation+(random(s.seed,i,3)-.5)*s.rotationJitter*2)*Math.PI/180);
    if(s.flip&&random(s.seed,i,4)>.5)ctx.scale(-1,1);
    const masks:Mask[]=['square','circle','diamond','triangle','hexagon','arch'];
    maskPath(ctx,s.mask==='mixed'?masks[Math.floor(random(s.seed,i,9)*masks.length)]:s.mask,w,h);
    // Cover the output cell without distorting the selected source slice.
    drawFragment(ctx,tile,w,h);ctx.restore();
  }
  return canvas;
}
export interface Plate { ink: Ink; coverage: Uint8Array }
export function separate(image:ImageData,s:Settings):Plate[] {
  const inks=s.separation==='cmyk'?s.inks:s.spotInks;
  const plates=inks.map(ink=>({ink,coverage:new Uint8Array(image.width*image.height)}));
  const colors=inks.map(ink=>rgb(ink.color).map(v=>v/255));
  const spacing=image.width/(s.width*s.lpi);
  const flow=s.screenMode==='contour'&&s.flowStrength>0?buildFlowField(image,s):null;
  const angles=inks.map(ink=>{const a=ink.angle*(flow?s.flowDivergence:1)*Math.PI/180;return [Math.cos(a)/spacing,Math.sin(a)/spacing];});
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++) {
    const p=y*image.width+x,k=p*4,r=image.data[k]/255,g=image.data[k+1]/255,b=image.data[k+2]/255;
    const displacement=flow?flowDisplacement(flow,(x+.5)/image.width,(y+.5)/image.height,s):0;
    let tones:number[];
    if(s.separation==='cmyk')tones=cmyk(r,g,b,s.blackGeneration);
    else {
      // Soft palette assignment, with paper preserved through luminance coverage.
      const weights=colors.map(c=>1/(.015+(r-c[0])**2+(g-c[1])**2+(b-c[2])**2));
      const total=weights.reduce((a,b)=>a+b,0),darkness=1-(.2126*r+.7152*g+.0722*b);
      tones=weights.map((w,i)=>clamp(w/total*darkness/Math.max(.15,1-(.2126*colors[i][0]+.7152*colors[i][1]+.0722*colors[i][2]))));
    }
    for(let c=0;c<inks.length;c++) {
      const raw=tones[c],tone=clamp((raw+s.gain*4*raw*(1-raw))*inks[c].density),[cos,sin]=angles[c];
      plates[c].coverage[p]=tone>screenThreshold((x+.5)*cos+(y+.5)*sin+displacement,(-(x+.5)*sin+(y+.5)*cos)/(flow?s.flowLength:1),s.pattern)?255:0;
    }
  }
  return plates;
}
export function compositePlates(plates:Plate[],width:number,height:number,solo=-1) {
  const data=new Uint8ClampedArray(width*height*4);data.fill(255);
  plates.forEach(({ink,coverage},index)=>{
    if(solo>=0?index!==solo:!ink.enabled)return;
    const color=solo>=0?[0,0,0]:rgb(ink.color);
    for(let p=0;p<coverage.length;p++)if(coverage[p]){for(let c=0;c<3;c++)data[p*4+c]=Math.round(data[p*4+c]*color[c]/255);}
  });
  return new ImageData(data,width,height);
}
export function plateLayer(plate:Plate,width:number,height:number) {
  const data=new Uint8ClampedArray(width*height*4),color=rgb(plate.ink.color);
  for(let p=0;p<plate.coverage.length;p++){data[p*4]=color[0];data[p*4+1]=color[1];data[p*4+2]=color[2];data[p*4+3]=plate.coverage[p];}
  return new ImageData(data,width,height);
}

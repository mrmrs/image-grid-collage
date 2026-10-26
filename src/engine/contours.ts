import type {Settings} from '../model';
import type {Tile} from './tile';
import {drawFragment} from './tile';
import {random,noise} from './math';

const BINS=16;
export interface ContourCandidate {tile:Tile;edges:Float32Array;fixedCell?:number;mean?:number;contrast?:number}
// Clockwise sides: top, right, bottom, left. Samples always run left→right or top→bottom.
export function edgeCost(a:Float32Array,sideA:number,b:Float32Array,sideB:number){
  let cost=0;
  for(let i=0;i<BINS;i++){
    const x=a[sideA*BINS+i],y=b[sideB*BINS+i];
    cost+=(x-y)**2*.3;
    if(i)cost+=((x-a[sideA*BINS+i-1])-(y-b[sideB*BINS+i-1]))**2*3;
  }
  return cost/BINS;
}
export function analyzeContours(tiles:Tile[],s:Settings):ContourCandidate[]{
  const margin=Math.min(s.width,s.height)*s.margin/100,aspect=(s.width-2*margin)/s.columns/((s.height-2*margin)/s.rows);
  const candidates:Tile[]=[];
  // Bound analysis cost even with 25 sources sliced 24×24. Sample across the entire library.
  const count=Math.min(512,tiles.length);
  for(let i=0;i<count;i++){
    const tile=tiles[Math.floor(i*tiles.length/count)];
    candidates.push({...tile,turn:0});
    if(s.contourCrop||s.contourTurn)for(const sign of [-1,1]){
      const shrink=1-s.contourCrop,sw=tile.sw*shrink,sh=tile.sh*shrink;
      candidates.push({...tile,sw,sh,sx:tile.sx+(tile.sw-sw)*(sign<0?.15:.85),sy:tile.sy+(tile.sh-sh)*(sign<0?.85:.15),turn:sign*s.contourTurn});
    }
  }
  const fixed=new Map<number,number>();
  for(const pin of s.cellPins){
    const source=tiles.find(t=>t.sourceId===pin.sourceId);
    if(source){fixed.set(candidates.length,pin.cell);candidates.push({...source,sx:pin.sx*source.image.width,sy:pin.sy*source.image.height,sw:pin.sw*source.image.width,sh:pin.sh*source.image.height,turn:pin.turn});}
  }
  const size=20,across=32,atlas=new OffscreenCanvas(across*size,Math.ceil(candidates.length/across)*size),ctx=atlas.getContext('2d',{willReadFrequently:true})!;
  ctx.fillStyle=s.background;ctx.fillRect(0,0,atlas.width,atlas.height);
  ctx.filter=s.saturation===1&&s.contrast===1?'none':`saturate(${s.saturation}) contrast(${s.contrast})`;
  candidates.forEach((t,i)=>{
    const x=i%across*size,y=Math.floor(i/across)*size;
    ctx.save();ctx.beginPath();ctx.rect(x,y,size,size);ctx.clip();ctx.translate(x+size/2,y+size/2);ctx.scale(size/aspect,size);
    ctx.rotate(s.rotation*Math.PI/180);
    drawFragment(ctx,t,aspect,1);ctx.restore();
  });
  const data=ctx.getImageData(0,0,atlas.width,atlas.height).data;
  return candidates.map((tile,index)=>{
    const edges=new Float32Array(BINS*4),ox=index%across*size,oy=Math.floor(index/across)*size;
    for(let side=0;side<4;side++)for(let i=0;i<BINS;i++){
      const q=2+i,x=side===1?size-2:side===3?1:q,y=side===0?1:side===2?size-2:q;
      const k=((oy+y)*atlas.width+ox+x)*4;
      edges[side*BINS+i]=(.2126*data[k]+.7152*data[k+1]+.0722*data[k+2])/255;
    }
    let sum=0,squares=0;
    for(let y=2;y<size-2;y++)for(let x=2;x<size-2;x++){const k=((oy+y)*atlas.width+ox+x)*4,v=(.2126*data[k]+.7152*data[k+1]+.0722*data[k+2])/255;sum+=v;squares+=v*v;}
    const mean=sum/256,contrast=Math.sqrt(Math.max(0,squares/256-mean*mean));
    return {tile,edges,fixedCell:fixed.get(index),mean,contrast};
  });
}

/** Deterministic neighbor optimization. Random breaks and source quotas preserve collage diversity. */
export function solveContours(candidates:ContourCandidate[],s:Settings):Tile[]{
  if(!candidates.length)return [];
  const fixed=new Map(candidates.filter(c=>c.fixedCell!==undefined).map(c=>[c.fixedCell,c]));
  const result:ContourCandidate[]=[],used=new Map<string,number>(),count=s.rows*s.columns;
  for(let i=0;i<count;i++){
    const left=i%s.columns?result[i-1]:undefined,top=i>=s.columns?result[i-s.columns]:undefined;
    const broken=random(s.seed,i,41)<s.contourBreaks,tries=Math.min(candidates.length,count>1024?64:160);
    let best:ContourCandidate=candidates[Math.floor(random(s.seed,i,42)*candidates.length)],score=Infinity;
    const target=.2+.6*noise((i%s.columns)/s.columns*3,Math.floor(i/s.columns)/s.rows*3,s.seed+119);
    const start=Math.floor(random(s.seed,i,43)*candidates.length);
    for(let j=0;j<tries&&!fixed.has(i);j++){
      const candidate=candidates[(start+Math.floor(j*candidates.length/tries))%candidates.length],t=candidate.tile;
      let match=0,neighbors=0,same=0;
      if(left){match+=edgeCost(left.edges,1,candidate.edges,3);neighbors++;same+=Number(left.tile.sourceIndex===t.sourceIndex);}
      if(top){match+=edgeCost(top.edges,2,candidate.edges,0);neighbors++;same+=Number(top.tile.sourceIndex===t.sourceIndex);}
      const key=`${t.sourceIndex}:${t.tileIndex}`;
      const value=(broken?0:match/Math.max(1,neighbors)*s.contourContinuity)+random(s.seed,i*candidates.length+j,44)*(broken?.3:.001+(1-s.contourContinuity)*.08)+s.contourDiversity*same*.008+(used.get(key)??0)*.003+(candidate.mean===undefined?0:(candidate.mean-target)**2*.12)+Math.max(0,.1-(candidate.contrast??.1))*.08;
      if(value<score){score=value;best=candidate;}
    }
    best=fixed.get(i)??best;
    result.push(best);const key=`${best.tile.sourceIndex}:${best.tile.tileIndex}`;used.set(key,(used.get(key)??0)+1);
  }
  return result.map(item=>item.tile);
}

let cached:{key:string;images:ImageBitmap[];candidates:ContourCandidate[]}|undefined;
export function contourPlan(tiles:Tile[],s:Settings){
  const images=[...new Set(tiles.map(t=>t.image))],key=JSON.stringify([s.sourceColumns,s.sourceRows,s.width,s.height,s.margin,s.columns,s.rows,s.contourCrop,s.contourTurn,s.rotation,s.background,s.saturation,s.contrast,s.cellPins]);
  if(!cached||cached.key!==key||images.some((image,i)=>image!==cached!.images[i])||images.length!==cached.images.length)cached={key,images,candidates:analyzeContours(tiles,s)};
  return solveContours(cached.candidates,s);
}

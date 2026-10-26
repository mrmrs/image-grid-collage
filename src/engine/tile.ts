export interface Tile {image:ImageBitmap;sx:number;sy:number;sw:number;sh:number;color:number[];sourceIndex:number;tileIndex:number;sourceId?:string;turn?:number}
/** Crop alignment rotates the photograph inside a fixed cell, keeping grid edges intact. */
export function drawFragment(ctx:OffscreenCanvasRenderingContext2D,tile:Tile,w:number,h:number){
  const a=(tile.turn??0)*Math.PI/180,co=Math.abs(Math.cos(a)),si=Math.abs(Math.sin(a));
  const overscan=Math.max(co+si*h/w,co+si*w/h),ratio=Math.max(w/tile.sw,h/tile.sh),sw=w/ratio,sh=h/ratio;
  ctx.save();ctx.rotate(a);
  ctx.drawImage(tile.image,tile.sx+(tile.sw-sw)/2,tile.sy+(tile.sh-sh)/2,sw,sh,-w*overscan/2,-h*overscan/2,w*overscan,h*overscan);ctx.restore();
}

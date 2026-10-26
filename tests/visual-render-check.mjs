import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173');
 const result=await page.evaluate(async()=>{
  const {DEFAULTS}=await import('/src/model.ts');
  const {makeTiles,renderGrid,planGrid}=await import('/src/engine/render.ts');
  const {coverCrop}=await import('/src/engine/analysis.ts');
  const library=await(await fetch('/image-library.json')).json();
  const images=await Promise.all([library[0],library[1]].map(async source=>({source,image:await createImageBitmap(await(await fetch(source.src)).blob())})));
  const settings={...DEFAULTS,rows:14,columns:14,gap:0,margin:0,multiscale:true,multiscaleStrength:1,multiscaleDetail:.65,multiscaleCrossover:1.6};
  const tiles=makeTiles(images,settings);
  const small=renderGrid(tiles,settings,600,600),large=renderGrid(tiles,settings,1800,1800);
  const raw=renderGrid(tiles,{...settings,multiscaleStrength:0,multiscaleDetail:1},600,600);
  const target=new OffscreenCanvas(600,600),tc=target.getContext('2d'),crop=coverCrop(images[0].image,1);
  tc.drawImage(images[0].image,crop.sx,crop.sy,crop.sw,crop.sh,0,0,600,600);
  const sample=(canvas,n)=>{const c=new OffscreenCanvas(n,n),ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,n,n);return ctx.getImageData(0,0,n,n).data;};
  const rmse=(a,b)=>{let e=0;for(let i=0;i<a.length;i++)if(i%4!==3)e+=(a[i]-b[i])**2;return Math.sqrt(e/(a.length*.75))/255;};
  const farError=rmse(sample(small,12),sample(target,12)),rawError=rmse(sample(raw,12),sample(target,12));
  const scaleError=rmse(sample(small,200),sample(large,200));
  const noDetail=renderGrid(tiles,{...settings,multiscaleDetail:0},600,600),detailDifference=rmse(sample(small,400),sample(noDetail,400));
  const contour={...settings,multiscale:false,distribution:'contour',contourTurn:0,contourCrop:0};
  const pinned=planGrid(tiles,contour)[22];
  const pin={cell:22,sourceId:pinned.sourceId,sx:pinned.sx/pinned.image.width,sy:pinned.sy/pinned.image.height,sw:pinned.sw/pinned.image.width,sh:pinned.sh/pinned.image.height,turn:pinned.turn??0};
  const next=planGrid(tiles,{...contour,seed:9898,cellPins:[pin]})[22];
  // Exercise rectangular analysis and transparent masks at print resolution.
  const rectangular=renderGrid(tiles,{...settings,width:12,height:4,mask:'circle',gap:8},1200,400);
  const corners=rectangular.getContext('2d').getImageData(0,0,1,1).data;
  return {farError,rawError,scaleError,detailDifference,pinMatches:next.sx===pinned.sx&&next.sy===pinned.sy&&next.sw===pinned.sw,corner:[...corners]};
 });
 console.log('Render metrics:',result);
 assert.ok(result.farError<result.rawError*.65,'Multiscale should recover the target at a distance');
 assert.ok(result.scaleError<.065,'Preview and print should agree after downsampling');
 assert.ok(result.detailDifference>.035,'Near-view detail must remain visible');
 assert.equal(result.pinMatches,true);
 assert.deepEqual(result.corner,[242,239,231,255],'Masks preserve paper instead of filling it with the distance image');
 console.log('PASS: near/far separation, resolution consistency, preserved detail, pinned crop and rectangular masked output.');
}finally{await browser.close();}

import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173');
 const result=await page.evaluate(async()=>{
  const {DEFAULTS}=await import('/src/model.ts');
  const {makeTiles,renderGrid,planGrid}=await import('/src/engine/render.ts');
  const {ZOOM_DISTRIBUTIONS}=await import('/src/engine/zoom.ts');
  const library=await(await fetch('/image-library.json')).json();
  const images=await Promise.all([library[0],library[1]].map(async source=>({source,image:await createImageBitmap(await(await fetch(source.src)).blob())})));
  const settings={...DEFAULTS,rows:14,columns:14,gap:0,margin:0,multiscale:true};
  const tiles=makeTiles(images,settings);
  const sample=(canvas,n)=>{const c=new OffscreenCanvas(n,n),ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,n,n);return ctx.getImageData(0,0,n,n).data;};
  const rmse=(a,b)=>{let e=0;for(let i=0;i<a.length;i++)if(i%4!==3)e+=(a[i]-b[i])**2;return Math.sqrt(e/(a.length*.75))/255;};
  const small=renderGrid(tiles,settings,600,600),large=renderGrid(tiles,settings,1800,1800),scaleError=rmse(sample(small,200),sample(large,200));
  const directErrors=[];
  // Independently draw the centered square crop at several magnifications. No tone processing is expected.
  for(const zoom of [1,2,7,1024]){
   const s={...settings,rows:1,columns:1,zoomLevels:1,zoomMin:zoom,zoomMax:zoom,sourceSnap:false},image=images[0].image;
   const output=renderGrid(tiles,s,300,300),reference=new OffscreenCanvas(300,300),ctx=reference.getContext('2d',{willReadFrequently:true});
   const size=Math.min(image.width,image.height)/zoom;ctx.imageSmoothingQuality='high';ctx.drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,300,300);
   directErrors.push(rmse(sample(output,300),sample(reference,300)));
  }
  const flat=new OffscreenCanvas(64,64),fc=flat.getContext('2d');fc.fillStyle='rgb(100,140,180)';fc.fillRect(0,0,64,64);
  const flatTiles=makeTiles([{source:{id:'flat'},image:await createImageBitmap(flat)}],settings);
  let colorsPreserved=true;
  for(const {id:zoomDistribution} of ZOOM_DISTRIBUTIONS){
   const c=renderGrid(flatTiles,{...settings,zoomDistribution,rows:8,columns:8},256,256),ctx=c.getContext('2d');
   for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const p=ctx.getImageData(col*32+16,row*32+16,1,1).data;
    colorsPreserved&&=p[0]===100&&p[1]===140&&p[2]===180&&p[3]===255;
   }
  }
  // A source with sixteen colored cells proves output positions sample different source cells.
  const chart=new OffscreenCanvas(128,128),chartCtx=chart.getContext('2d');
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){chartCtx.fillStyle=`rgb(${30+col*60},${30+row*60},100)`;chartCtx.fillRect(col*32,row*32,32,32);}
  const chartSettings={...settings,rows:4,columns:4,sourceRows:4,sourceColumns:4,zoomMin:8,zoomMax:256};
  const chartOutput=renderGrid(makeTiles([{source:{id:'chart'},image:await createImageBitmap(chart)}],chartSettings),chartSettings,256,256),chartPixels=chartOutput.getContext('2d');
  let coordinatesMatch=true;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const pixel=chartPixels.getImageData(col*64+32,row*64+32,1,1).data;
   coordinatesMatch&&=pixel[0]===30+col*60&&pixel[1]===30+row*60&&pixel[2]===100;
  }
  const contour={...settings,multiscale:false,distribution:'contour',contourTurn:0,contourCrop:0},pinned=planGrid(tiles,contour)[22];
  const pin={cell:22,sourceId:pinned.sourceId,sx:pinned.sx/pinned.image.width,sy:pinned.sy/pinned.image.height,sw:pinned.sw/pinned.image.width,sh:pinned.sh/pinned.image.height,turn:pinned.turn??0};
  const next=planGrid(tiles,{...contour,multiscale:true,multiscaleMode:'fragments',seed:9898,cellPins:[pin]})[22];
  const rectangular=renderGrid(tiles,{...settings,width:12,height:4,mask:'circle',gap:8},1200,400);
  return {scaleError,directErrors,colorsPreserved,coordinatesMatch,pinMatches:next.sx===pinned.sx&&next.sy===pinned.sy&&next.sw===pinned.sw,corner:[...rectangular.getContext('2d').getImageData(0,0,1,1).data]};
 });
 console.log('Render metrics:',result);
 assert.ok(result.scaleError<.065,'Preview and print should agree after downsampling');
 assert.ok(result.directErrors.every(error=>error<.001),'Zoom output must match direct photographic crops');
 assert.equal(result.colorsPreserved,true,'Zoom must not introduce contrast or color effects');
 assert.equal(result.coordinatesMatch,true,'Every output cell must sample its independently assigned source cell');
 assert.equal(result.pinMatches,true);
 assert.deepEqual(result.corner,[242,239,231,255]);
 console.log('PASS: actual crop magnification, unchanged colors, resolution consistency, pinned crop and masked output.');
}finally{await browser.close();}

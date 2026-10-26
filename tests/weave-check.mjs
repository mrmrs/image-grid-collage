import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {unzipSync} from 'fflate';
import UTIF from 'utif';
import {readPsd,initializeCanvas} from 'ag-psd';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const first=page.getByLabel('Generative composition preview',{exact:true}),second=page.getByLabel('Complementary composition preview',{exact:true});
 const settle=async()=>{await expect(first).toHaveAttribute('aria-busy','false');await expect(second).toHaveAttribute('aria-busy','false');await expect(page.getByRole('alert')).toHaveCount(0);};
 const hash=canvas=>canvas.evaluate(c=>{let h=0;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=37)h=Math.imul(h,31)+d[i]|0;return h;});
 const tab=name=>page.getByRole('button',{name,exact:true}).click();
 const download=async(name,path)=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:false}).click();const file=await pending;await file.saveAs(path);return unzipSync(await fs.readFile(path));};
 await page.goto(process.env.APP_URL||'http://127.0.0.1:5173');await expect(page.getByText('2 images in the mix')).toBeVisible();await settle();
 await expect(second).toBeVisible();assert.notEqual(await hash(first),await hash(second));
 const a=await first.boundingBox(),b=await second.boundingBox();assert.ok(b.x>=a.x+a.width);assert.equal(Math.round(a.y),Math.round(b.y));
 await page.screenshot({path:'/tmp/print-shop-weave-pair.png'});
 for(const [rows,columns] of [[2,2],[1,12],[12,1],[12,12]]){
  await page.getByRole('spinbutton',{name:'Rows',exact:true}).fill(String(rows));await page.getByRole('spinbutton',{name:'Columns',exact:true}).fill(String(columns));await settle();
  await expect(second).toBeVisible();assert.notEqual(await hash(first),await hash(second));
 }
 const firstHash=await hash(first),secondHash=await hash(second);
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('2 images in the mix')).toBeVisible();await settle();
 assert.equal(await hash(first),firstHash);assert.equal(await hash(second),secondHash);
 const selected=page.locator('.image-select[aria-pressed="true"]');assert.equal(await selected.count(),2);
 const title=(await selected.first().getAttribute('aria-label')).replace('Deselect ','');
 await tab(`Deselect ${title}`);await expect(second).toBeHidden();await settle();
 await tab(`Select ${title}`);await settle();await expect(second).toBeVisible();assert.equal(await hash(second),secondHash);
 await tab('motion');await expect(page.getByLabel('Animated composition preview',{exact:true})).toBeVisible();await expect(page.getByLabel('Animated complementary preview',{exact:true})).toBeVisible();
 await tab('Pause grid animation');await page.getByRole('slider',{name:'Animation progress',exact:true}).fill('0');
 assert.notEqual(await hash(page.getByLabel('Animated composition preview',{exact:true})),await hash(page.getByLabel('Animated complementary preview',{exact:true})));
 await tab('compose');await settle();
 await page.setViewportSize({width:390,height:844});await expect(second).toBeVisible();
 const mobileA=await first.boundingBox(),mobileB=await second.boundingBox();assert.ok(mobileB.y>=mobileA.y+mobileA.height);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/print-shop-weave-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await tab('Export');await page.getByLabel('Print width',{exact:true}).fill('2');await page.getByLabel('Print height',{exact:true}).fill('2');
 const tiffs=await download('ZIP Both collages · TIFFs','/tmp/print-shop-weave-tiffs.zip');
 assert.deepEqual(Object.keys(tiffs).sort(),['collage-1.tif','collage-2.tif']);
 for(const data of Object.values(tiffs)){
  const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),[ifd]=UTIF.decode(buffer);UTIF.decodeImage(buffer,ifd);
  assert.equal(ifd.width,600);assert.equal(ifd.height,600);assert.equal(ifd.t282[0],300);assert.equal(ifd.t283[0],300);
 }
 assert.notDeepEqual(tiffs['collage-1.tif'],tiffs['collage-2.tif']);
 await tab('print');await page.getByRole('switch',{name:'Enable halftone'}).check();await settle();
 await tab('View Cyan plate');await settle();assert.notEqual(await hash(first),await hash(second));
 await tab('Composite');await settle();await tab('Export');
 const files=await download('ZIP Print package + editable layers','/tmp/print-shop-weave-package.zip');
 initializeCanvas(()=>{throw new Error('Canvas not expected');},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
 for(const output of [1,2]){
  const prefix=`collage-${output}/`;assert.ok(files[prefix+'composite.tif']);
  const recipe=JSON.parse(new TextDecoder().decode(files[prefix+'recipe.json']));assert.equal(recipe.output,output);assert.equal(recipe.outputCount,2);
  const plates=Object.keys(files).filter(name=>name.startsWith(prefix+'plates/'));assert.equal(plates.length,4);
  for(const name of plates){const data=files[name],buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),[ifd]=UTIF.decode(buffer);UTIF.decodeImage(buffer,ifd);assert.equal(ifd.width,600);assert.equal(ifd.t282[0],300);assert.ok([...new Set(ifd.data)].every(v=>v===0||v===255));}
  const psd=readPsd(files[prefix+'layers.psd'],{useImageData:true});assert.equal(psd.width,600);assert.equal(psd.height,600);assert.equal(psd.children.length,5);assert.equal(psd.imageResources.resolutionInfo.horizontalResolution,300);
 }
 assert.notDeepEqual(files['collage-1/composite.tif'],files['collage-2/composite.tif']);assert.deepEqual(errors,[]);
 console.log('PASS: complementary pair, resized grids/strips, persistence, source changes, dual motion, desktop/mobile layout, two TIFFs and two complete 300 DPI print packages.');
}finally{await browser.close();}

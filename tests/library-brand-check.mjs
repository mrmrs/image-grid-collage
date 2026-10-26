import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.APP_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 const canvas=page.getByLabel('Generative composition preview',{exact:true});
 const settle=async()=>{await expect(canvas).toHaveAttribute('aria-busy','false',{timeout:30000});await expect(page.getByRole('alert')).toHaveCount(0);};
 const hash=()=>canvas.evaluate(c=>{let h=0;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=37)h=Math.imul(h,31)+d[i]|0;return h;});
 await expect(page.getByText('8 images in the mix')).toBeVisible();await settle();
 const library=await(await page.request.get(base+'/image-library.json')).json(),fresh=library.filter(i=>i.addedAt==='2026-10-26');
 assert.equal(library.length,37);assert.equal(fresh.length,12);assert.equal(new Set(library.map(i=>i.id)).size,library.length);
 await page.getByLabel('Show images',{exact:true}).selectOption('new');await expect(page.locator('.image-select')).toHaveCount(12);
 await page.getByRole('button',{name:'All',exact:true}).click();await expect(page.getByText('12 images in the mix')).toBeVisible();await settle();
 await page.getByLabel('Show images',{exact:true}).selectOption('portraits');await expect(page.locator('.image-select')).toHaveCount(9);
 await page.getByRole('button',{name:'All',exact:true}).click();await expect(page.getByText('9 images in the mix')).toBeVisible();await settle();
 await page.getByRole('button',{name:'presets',exact:true}).click();await page.getByRole('button',{name:/Portrait \/ detail/}).click();await settle();
 await page.getByRole('button',{name:'compose',exact:true}).click();await expect(page.getByText('1 image in the mix')).toBeVisible();
 await page.screenshot({path:'/tmp/fieldwork-portrait-preset.png',fullPage:true});
 await page.getByRole('spinbutton',{name:'Scale contrast value',exact:true}).fill('0');await settle();const balanced=await hash();
 await page.getByRole('spinbutton',{name:'Scale contrast value',exact:true}).fill('1');await settle();assert.notEqual(await hash(),balanced);
 await page.getByRole('spinbutton',{name:'Max zoom',exact:true}).fill('1024');await settle();const extreme=await hash();
 await page.getByRole('button',{name:'Save preset',exact:true}).click();await page.getByLabel('Preset name',{exact:true}).fill('Portrait extremes');await page.getByRole('dialog').getByRole('button',{name:'Save preset',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('1 image in the mix')).toBeVisible();await settle();assert.equal(await hash(),extreme);
 const decoded=await page.evaluate(async fresh=>{
  for(const photo of fresh)for(const src of [photo.src,photo.thumbnail]){
   const response=await fetch(src);if(!response.ok)throw new Error(src);const bitmap=await createImageBitmap(await response.blob());
   if(src===photo.src&&(bitmap.width!==photo.width||bitmap.height!==photo.height))throw new Error('Dimensions: '+photo.id);bitmap.close();
  }return fresh.length;
 },fresh);assert.equal(decoded,12);
 const html=await(await page.request.get(base)).text();assert.ok(html.includes('property="og:image"'));assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
 for(const [file,w,h] of [['og-print-shop.png',1200,630],['favicon-32.png',32,32],['apple-touch-icon.png',180,180]]){
  const response=await page.request.get(base+'/'+file);assert.equal(response.status(),200);assert.ok(response.headers()['content-type'].includes('image/png'));
  const bytes=await response.body();assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);
 }
 await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content','https://image-grid-collage.adam-f8f.workers.dev/og-print-shop.png');
 await expect(page.locator('.brand-symbol')).toHaveAttribute('src','/brand-mark.svg');
 for(const file of ['brand-mark.svg','favicon.svg']){const response=await page.request.get(base+'/'+file);assert.equal(response.status(),200);assert.ok((await response.text()).includes('rotate(-7 32 32)'));}
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS: 37 sources, 12 decoded additions with thumbnails, filters, portrait preset, scale contrast, 1024× persistence, OG metadata, icons and mobile layout.');
}finally{await browser.close();}

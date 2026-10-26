import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5173')&&!r.url().startsWith('data:'))remote.push(r.url());});
await page.addInitScript(()=>{
 const Native=Worker;window.motionJobs=[];let number=0;
 window.Worker=class extends Native{constructor(...args){super(...args);const n=++number;const post=this.postMessage.bind(this);this.postMessage=(data,...rest)=>{window.motionJobs.push({worker:n,seed:data.settings?.seed,mode:data.mode});return post(data,...rest);};}};
});
const still=page.locator('canvas[aria-label="Generative composition preview"]');
const animated=page.locator('canvas[aria-label="Animated composition preview"]');
const settle=async()=>{await page.waitForFunction(()=>document.querySelector('canvas[aria-label="Generative composition preview"]')?.width===1200);await expect(still).toHaveAttribute('aria-busy','false');};
const hash=locator=>locator.evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<data.length;i+=17)h=Math.imul(h,31)+data[i]|0;return h;});
const scrub=async value=>{await page.getByRole('slider',{name:'Animation progress',exact:true}).fill(String(value));await expect(page.locator('.motion-progress-value')).toHaveText(`${value}%`);};
try{
 await page.goto('http://127.0.0.1:5173');await settle();
 await page.getByLabel('Arrange by',{exact:true}).selectOption('random');await settle();
 await page.getByRole('button',{name:'motion',exact:true}).click();await page.getByRole('slider',{name:'Cells per group',exact:true}).waitFor();
 await page.getByRole('button',{name:'Pause grid animation',exact:true}).click();
 const baseJobs=await page.evaluate(()=>window.motionJobs.length);
 await page.getByRole('slider',{name:'Cell duration',exact:true}).press('ArrowRight');
 await page.getByRole('button',{name:'Cell grouping Small groups',exact:true}).click();
 console.log('Grouping menu:',await page.locator('.motion-dials').ariaSnapshot());
 await page.getByRole('option',{name:'All together',exact:true}).click();
 await page.getByRole('radiogroup',{name:'Keep evolving'}).getByRole('radio',{name:'Off',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>window.motionJobs.length),baseJobs,'Motion-only edits should not render the still');
 await page.getByRole('button',{name:'Play grid animation'}).click();await expect(animated).toBeVisible();await page.getByRole('button',{name:'Pause grid animation'}).waitFor();await scrub(0);const from=await hash(animated);await scrub(100);const to=await hash(animated);assert.notEqual(from,to);
 const jobsAfterPrepare=await page.evaluate(()=>window.motionJobs.length);
 for(const label of ['Silk wave','Bloom','Fireflies','Turn the tiles','Tidal rows']){
  await page.getByRole('button',{name:`${label} animation`}).click();await scrub(50);
  const mid=await hash(animated);assert.notEqual(mid,from);assert.notEqual(mid,to);
  await page.screenshot({path:`/tmp/fieldwork-motion-${label.replaceAll(' ','-')}.png`});
  await scrub(0);assert.equal(await hash(animated),from);await scrub(100);assert.equal(await hash(animated),to);
 }
 assert.equal(await page.evaluate(()=>window.motionJobs.length),jobsAfterPrepare,'Scrubbing and pattern changes reuse the two prepared frames');
 await scrub(35);const pausedHash=await hash(animated);await page.getByRole('button',{name:'motion',exact:true}).click();assert.equal(await hash(animated),pausedHash);
 await page.getByRole('button',{name:'Resume animation',exact:true}).click();await expect(page.locator('.motion-progress-value')).toHaveText('100%');await expect(page.getByRole('button',{name:'Resume animation',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Keep destination as still',exact:true}).click();await expect(animated).toBeHidden();await settle();await expect(page.getByRole('spinbutton',{name:'Random seed',exact:true})).toHaveValue('2409');
 // Continuous playback advances to another seed, then stops immediately and returns to the still.
 await page.getByRole('radiogroup',{name:'Keep evolving'}).getByRole('radio',{name:'On',exact:true}).click();
 await page.getByRole('button',{name:'Play grid animation'}).click();await expect(animated).toBeVisible();
 await expect(page.locator('.motion-seeds')).toContainText('2411',{timeout:15000});
 await page.getByRole('button',{name:'Stop animation and return to still'}).click();await expect(animated).toBeHidden();
 assert.equal(await page.evaluate(()=>new Set(window.motionJobs.map(j=>j.worker)).size),1,'Motion and still previews share one worker');
 await page.getByRole('radiogroup',{name:'Keep evolving'}).getByRole('radio',{name:'Off',exact:true}).click();
 // Save motion settings in the existing versioned recipe and reload.
 await page.getByRole('button',{name:'Save preset',exact:true}).click();await page.getByLabel('Preset name',{exact:true}).fill('Living tiles');await page.getByRole('dialog').getByRole('button',{name:'Save preset',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();await settle();await page.getByRole('button',{name:'motion',exact:true}).click();await expect(page.getByRole('button',{name:'Tidal rows animation'})).toHaveAttribute('aria-pressed','true');await expect(animated).toBeVisible();
 // Halftoned plates can animate, changing the recipe stops playback, exporting returns to a reproducible still.
 await page.getByRole('button',{name:'print',exact:true}).click();await page.getByRole('switch',{name:'Enable halftone'}).check();await settle();await page.getByRole('button',{name:'View Cyan plate'}).click();await settle();
 await page.getByRole('button',{name:'Play grid animation'}).click();await expect(animated).toBeVisible();await scrub(50);await page.screenshot({path:'/tmp/fieldwork-motion-halftone.png'});
 await page.getByRole('button',{name:'Export',exact:true}).click();await expect(animated).toBeHidden();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'Play grid animation'}).click();await expect(animated).toBeVisible();await page.getByRole('button',{name:'compose',exact:true}).click();await page.getByRole('spinbutton',{name:'Columns',exact:true}).fill('9');await expect(animated).toBeHidden();await settle();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'motion',exact:true}).click();await page.screenshot({path:'/tmp/fieldwork-motion-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Reduced motion uses the same autoplay behavior with a gentle rendering path.
 const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();await rp.goto('http://127.0.0.1:5173');await rp.getByRole('button',{name:'motion',exact:true}).click();await expect(rp.getByText('Reduced motion is on: playback uses a gentle dissolve.')).toBeVisible();await expect(rp.locator('canvas[aria-label="Animated composition preview"]')).toBeVisible();await reduced.close();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);console.log('PASS: five patterns, exact endpoints, cached scrubbing, DialKit inputs, pause/resume, one-shot, keep seed, persistence, halftones, export reset, recipe edits, responsive layout, reduced motion, no remote requests.');
}finally{await browser.close();}

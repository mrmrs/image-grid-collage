import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const Native=Worker;window.previewStats={sent:[],maxPending:0};
  window.Worker=class extends Native{constructor(...args){super(...args);const pending=new Set(),post=this.postMessage.bind(this);
   this.postMessage=(request,...rest)=>{if(request.mode==='preview'&&request.id>=0){pending.add(request.id);window.previewStats.maxPending=Math.max(window.previewStats.maxPending,pending.size);window.previewStats.sent.push({id:request.id,seed:request.settings.seed});}return post(request,...rest);};
   this.addEventListener('message',({data})=>pending.delete(data.id));
  }};
 });
 await page.goto('http://127.0.0.1:5173');await expect(page.getByText('2 images in the mix')).toBeVisible();
 const canvas=page.getByLabel('Generative composition preview',{exact:true});await expect(canvas).toHaveAttribute('aria-busy','false');
 const totalClicks=await page.evaluate(async()=>{
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Regenerate'),original=Math.random;
  const seeds=[10,4,9,19,132,10,4,9,19,132,10];
  try{for(const seed of seeds){Math.random=()=>seed/2147483648;button.click();await new Promise(resolve=>setTimeout(resolve,8));}}finally{Math.random=original;}
  return seeds.length;
 });
 await expect(page.getByRole('spinbutton',{name:'Random seed',exact:true})).toHaveValue('10');await expect(canvas).toHaveAttribute('aria-busy','false',{timeout:30000});
 const stats=await page.evaluate(()=>window.previewStats);
 assert.equal(stats.maxPending,1,'At most one still render may be in flight');
 assert.ok(stats.sent.length-1<totalClicks,'Intermediate regeneration requests must be dropped');
 assert.equal(stats.sent.at(-1).seed,10);
 const matches=await page.evaluate(async()=>{
  const {DEFAULTS}=await import('/src/model.ts'),{regenerateSettings}=await import('/src/engine/regenerate.ts');
  const {loadSources,makeTiles,renderGrid,separate,compositePlates}=await import('/src/engine/render.ts');
  const settings=regenerateSettings(DEFAULTS,10),library=await(await fetch('/image-library.json')).json(),sources=library.filter(i=>DEFAULTS.selectedIds.includes(i.id));
  const tiles=makeTiles(await loadSources(sources),settings),reference=renderGrid(tiles,settings,1200,1200),ctx=reference.getContext('2d');
  const expected=settings.halftone?compositePlates(separate(ctx.getImageData(0,0,1200,1200),settings),1200,1200).data:ctx.getImageData(0,0,1200,1200).data;
  const actual=document.querySelector('canvas[aria-label="Generative composition preview"]').getContext('2d').getImageData(0,0,1200,1200).data;
  return actual.every((value,i)=>value===expected[i]);
 });
 assert.equal(matches,true,'The final preview must exactly match the newest recipe');
 await page.getByRole('button',{name:'Undo regenerate',exact:true}).click();await expect(canvas).toHaveAttribute('aria-busy','false');
 await expect(page.getByRole('alert')).toHaveCount(0);assert.deepEqual(errors,[]);
 console.log(`PASS: ${totalClicks} rapid regenerations submitted ${stats.sent.length-1} renders; newest output matches every reference pixel; Undo works.`);
}finally{await browser.close();}

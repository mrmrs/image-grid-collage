import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>{
  const Native=Worker;window.renderJobs=[];
  window.Worker=class extends Native{
   constructor(...args){super(...args);const post=this.postMessage.bind(this);const starts=new Map();
    this.postMessage=(data,...rest)=>{if(data.mode==='preview'){starts.set(data.id,performance.now());window.renderJobs.push({id:data.id,seed:data.settings.seed,posted:performance.now()});}return post(data,...rest);};
    this.addEventListener('message',({data})=>{if(data.bitmap){const job=window.renderJobs.findLast(j=>j.id===data.id);if(job){job.elapsed=performance.now()-starts.get(data.id);job.received=performance.now();}}});
   }
  };
 });
 await page.goto('http://127.0.0.1:5173');await expect(page.getByText('2 images in the mix')).toBeVisible();
 const canvas=page.getByLabel('Generative composition preview',{exact:true});await expect(canvas).toHaveAttribute('aria-busy','false');
 const results=[];
 // Fixed recipes include ordinary photographs, contour matching and both halftone systems.
 const seeds=[1,2,3,5,8,13,21,34,55,89,144,233,4,9,10,19,132];
 for(const all of [false,true]){
  if(all){await page.getByRole('button',{name:'All',exact:true}).click();await expect(canvas).toHaveAttribute('aria-busy','false');}
  for(const seed of seeds){
   const result=await page.evaluate(async seed=>{
    const {regenerateSettings}=await import('/src/engine/regenerate.ts');const {DEFAULTS}=await import('/src/model.ts');
    const s=regenerateSettings(DEFAULTS,seed),start=performance.now();
    const original=Math.random;Math.random=()=>seed/2147483648;
    [...document.querySelectorAll('button')].find(b=>b.textContent==='Regenerate').click();Math.random=original;
    const c=document.querySelector('canvas[aria-label="Generative composition preview"]');
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{observer.disconnect();reject(new Error(`Preview timed out for seed ${seed}`));},30000);const observer=new MutationObserver(()=>{if(c.getAttribute('aria-busy')==='false'&&window.renderJobs.some(j=>j.seed===seed&&j.received>=start)){clearTimeout(timeout);observer.disconnect();resolve();}});observer.observe(c,{attributes:true,attributeFilter:['aria-busy']});});
    const end=performance.now(),job=window.renderJobs.findLast(j=>j.seed===seed);let hash=0;
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<pixels.length;i++)hash=Math.imul(hash,31)+pixels[i]|0;
    return {seed,clickToPreview:Math.round(end-start),worker:Math.round(job.elapsed),beforeWorker:Math.round(job.posted-start),hash,rows:s.rows,columns:s.columns,multiscale:s.multiscale,mode:s.multiscale?s.multiscaleMode:s.distribution,halftone:s.halftone,screen:s.screenMode,separation:s.separation};
   },seed);
   results.push({...result,sources:all?37:2});console.log(JSON.stringify(results.at(-1)));
  }
 }
 const out=process.env.PERF_OUTPUT||'/tmp/print-shop-regenerate-perf.json';await fs.writeFile(out,JSON.stringify(results,null,2));
 for(const sources of [2,37]){const samples=results.filter(r=>r.sources===sources).map(r=>r.clickToPreview).sort((a,b)=>a-b);console.log({sources,median:samples[Math.floor(samples.length/2)],max:samples.at(-1)});}
}finally{await browser.close();}

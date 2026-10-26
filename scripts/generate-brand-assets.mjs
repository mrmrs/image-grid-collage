/** Generate social artwork from the actual engine and icons from the shared brand mark.
 * Run the Vite dev server first, then npm run assets:brand. */
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const origin=process.env.APP_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.goto(origin);
 const artwork=await page.evaluate(async()=>{
  const {DEFAULTS}=await import('/src/model.ts');
  const {makeTiles,renderGrid}=await import('/src/engine/render.ts');
  const library=await(await fetch('/image-library.json')).json(),source=library.find(i=>i.id==='h1zwnZNp1fI');
  const image=await createImageBitmap(await(await fetch(source.src)).blob());
  const settings={...DEFAULTS,width:12,height:10,rows:7,columns:8,margin:0,gap:0,multiscale:true,zoomLevels:4,zoomMin:1,zoomMax:12,zoomContrast:.7,zoomDistribution:'checkerboard',sourceSnap:false,sourceXMin:20,sourceXMax:80,sourceYMin:20,sourceYMax:70};
  const canvas=renderGrid(makeTiles([{source,image}],settings),settings,756,630);
  return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);canvas.convertToBlob({type:'image/png'}).then(blob=>reader.readAsDataURL(blob));});
 });
 await page.setContent(`<!doctype html><html><head><style>
 @font-face{font-family:Space;src:url('${origin}/fonts/font-6.ttf')}@font-face{font-family:DM;src:url('${origin}/fonts/font-0.ttf')}
 *{box-sizing:border-box}body{margin:0;background:#f5f4f0;color:#30372a;width:1200px;height:630px;overflow:hidden}
 .art{position:absolute;left:444px;top:0;width:756px;height:630px}.panel{position:absolute;inset:0 auto 0 0;width:444px;padding:52px 42px;display:flex;flex-direction:column;background:#f5f4f0}
 .mark{width:60px;height:60px;margin-bottom:24px}.name{font:600 68px Space;letter-spacing:-4px;line-height:1}.description{font:27px/1.25 DM;margin-top:28px;letter-spacing:-.6px}.bottom{margin-top:auto;border-top:1px solid #c9cebd;padding-top:22px;font:16px DM;letter-spacing:.2px}.accent{width:52px;height:8px;background:#d5f170;margin-bottom:22px}
 </style></head><body><img class="art" src="${artwork}"/><div class="panel"><img class="mark" src="${origin}/brand-mark.svg"/><div class="name">print shop</div><div class="description">Generative image<br>& print studio.</div><div class="bottom"><div class="accent"></div>Compose. Animate. Print.</div></div></body></html>`);
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 await page.screenshot({path:'public/og-print-shop.png'});
 const icons=await page.evaluate(async origin=>{
  const image=new Image();image.src=origin+'/favicon.svg';await image.decode();
  return [32,180].map(size=>{const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(image,0,0,size,size);return c.toDataURL();});
 },origin);
 for(const [i,file] of ['favicon-32.png','apple-touch-icon.png'].entries())await writeFile('public/'+file,Buffer.from(icons[i].split(',')[1],'base64'));
 console.log('Generated 1200×630 social card, 32px favicon and 180px touch icon.');
}finally{await browser.close();}

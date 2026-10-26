import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import UTIF from 'utif';
import {readPsd,initializeCanvas} from 'ag-psd';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const settled=async()=>{await expect(page.locator('canvas[aria-label="Generative composition preview"]')).toHaveAttribute('aria-busy','false');await page.waitForFunction(()=>document.querySelector('canvas').width>300);};
const fingerprint=()=>page.locator('canvas[aria-label="Generative composition preview"]').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=0;for(let i=0;i<a.length;i+=97)hash=(Math.imul(hash,31)+a[i])|0;return hash;});
const saveDownload=async(action,name)=>{const pending=page.waitForEvent('download',{timeout:120000});await action();const result=await pending;const out=path.join(os.tmpdir(),name);await result.saveAs(out);return fs.readFile(out);};
try{
 await page.goto('http://127.0.0.1:5173');await settled();
 const initial=await fingerprint();
 for(const mode of ['random','gradient','radial','noise','color','luminance','checkerboard','stripes','ordered']){await page.getByLabel('Arrange by',{exact:true}).selectOption(mode);await settled();assert.equal(await page.getByRole('alert').count(),0);}
 await page.getByLabel('Arrange by',{exact:true}).selectOption('checkerboard');await settled();assert.equal(await fingerprint(),initial);
 for(const mask of ['circle','diamond','triangle','hexagon','arch','mixed','square']){await page.getByRole('button',{name:`${mask} mask`,exact:true}).click();await settled();}
 await page.getByRole('button',{name:'None',exact:true}).click();await expect(page.getByText('Start with an image.')).toBeVisible();
 await page.getByRole('button',{name:'All',exact:true}).click();await settled();
 const library=JSON.parse(await fs.readFile('public/image-library.json','utf8'));
 await page.locator('input[type=file][multiple]').setInputFiles(`public${library[0].src}`);await expect(page.getByText(`${library.length+1} images in the mix`)).toBeVisible();await settled();
 await page.getByRole('button',{name:'Save preset',exact:true}).click();await page.getByLabel('Preset name',{exact:true}).fill('Portable upload study');await page.getByRole('dialog').getByRole('button',{name:'Save preset',exact:true}).click();
 await page.getByRole('button',{name:'presets',exact:true}).click();
 const backup=await saveDownload(()=>page.getByRole('button',{name:'Backup',exact:true}).click(),'fieldwork-backup.json');const recipe=JSON.parse(backup);assert.equal(recipe.uploads.length,1);assert.equal(recipe.presets.length,1);
 await page.getByRole('button',{name:'print',exact:true}).click();await page.getByRole('switch',{name:'Enable halftone'}).check();
 await page.getByRole('button',{name:'Export',exact:true}).click();
 const started=Date.now();const bytes=await saveDownload(()=>page.getByRole('button',{name:'ZIP Print package + editable layers',exact:false}).click(),'fieldwork-300dpi.zip');
 const zip=unzipSync(bytes);for(const [name,data] of Object.entries(zip)){if(!name.endsWith('.tif'))continue;const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),[ifd]=UTIF.decode(buffer);UTIF.decodeImage(buffer,ifd);assert.equal(ifd.width,3000);assert.equal(ifd.height,3000);assert.equal(ifd.t282[0],300);assert.equal(ifd.t283[0],300);if(name.startsWith('plates/'))assert.ok([...new Set(ifd.data)].every(v=>v===0||v===255));}
 initializeCanvas(()=>{throw new Error('Canvas not expected');},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
 const psd=readPsd(zip['layers.psd'],{useImageData:true});assert.deepEqual(psd.children.map(c=>c.name),['Paper','Cyan','Magenta','Yellow','Black']);assert.equal(psd.imageResources.resolutionInfo.horizontalResolution,300);assert.ok(psd.children.slice(1).every(c=>c.blendMode==='multiply'));
 console.log('3000 × 3000 export verified:',Object.keys(zip),`${Math.round((Date.now()-started)/1000)}s including decoding`,`${(bytes.length/1e6).toFixed(1)} MB ZIP`);
 await page.getByLabel('Ink system',{exact:true}).selectOption('spot');await settled();await expect(page.getByRole('button',{name:'View Ocean plate'})).toBeVisible();await page.getByRole('button',{name:'View Ocean plate'}).click();await settled();
 for(const pattern of ['lines','squares','diamonds','dots']){await page.getByLabel('Pattern',{exact:true}).selectOption(pattern);await settled();}
 await page.getByRole('button',{name:'Hide Ocean ink',exact:true}).click();await page.getByRole('button',{name:'Composite',exact:true}).click();await settled();
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByLabel('Print width',{exact:true}).fill('1');await page.getByLabel('Print height',{exact:true}).fill('1');
 const spotBytes=await saveDownload(()=>page.getByRole('button',{name:'ZIP Print package + editable layers',exact:false}).click(),'fieldwork-spot.zip');
 const spot=readPsd(unzipSync(spotBytes)['layers.psd'],{useImageData:true});assert.equal(spot.children.length,3);assert.equal(spot.children[1].name,'Ocean');assert.equal(spot.children[1].hidden,true);
 const second=await context.newPage();await second.goto('http://127.0.0.1:5173');await second.locator('input[type=file][accept=".json,application/json"]').setInputFiles(path.join(os.tmpdir(),'fieldwork-backup.json'));await expect(second.getByText('Recipe imported',{exact:true})).toBeVisible();await expect(second.getByText(`${library.length+1} images in the mix`)).toBeVisible();
 assert.deepEqual(errors,[]);console.log('Verified all arrangements/masks, empty state, uploads, portable backup/import, CMYK and spot PSD layers, all screens; no browser errors.');
}finally{await browser.close();}

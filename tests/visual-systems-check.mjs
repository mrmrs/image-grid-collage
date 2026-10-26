import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {unzipSync} from 'fflate';
import UTIF from 'utif';

const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1080}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const canvas=page.getByLabel('Generative composition preview',{exact:true});
const settle=async()=>{await expect(canvas).toHaveAttribute('aria-busy','false',{timeout:30000});await expect(page.getByRole('alert')).toHaveCount(0);};
const tab=async name=>page.getByRole('button',{name,exact:true}).click();
const hash=()=>canvas.evaluate(c=>{let h=0;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=37)h=Math.imul(h,31)+d[i]|0;return h;});
const saveArt=async name=>fs.writeFile(`/tmp/fieldwork-${name}.png`,Buffer.from((await canvas.evaluate(c=>c.toDataURL())).split(',')[1],'base64'));
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:5173');await expect(page.getByText('2 images in the mix')).toBeVisible({timeout:20000});await settle();
 await tab('presets');await page.getByRole('button',{name:/Spiral zoom/}).click();await settle();await tab('compose');
 await expect(page.getByRole('switch',{name:'Enable cell zoom'})).toBeChecked();
 await saveArt('zoom-spiral');const initial=await hash();
 await page.getByRole('spinbutton',{name:'Max zoom',exact:true}).fill('16');await settle();assert.notEqual(await hash(),initial);
 await page.getByRole('spinbutton',{name:'Zoom levels value',exact:true}).fill('8');await settle();
 for(const mode of ['spiral','tiled-spiral','rings','radial','diagonal','rows','columns','checkerboard','sequence','noise','random']){
  await page.getByLabel('Zoom distribution',{exact:true}).selectOption(mode);await settle();
  if(['tiled-spiral','rings','diagonal'].includes(mode))await saveArt(`zoom-${mode}`);
 }
 await page.getByLabel('Zoom distribution',{exact:true}).selectOption('tiled-spiral');await settle();
 await page.screenshot({path:'/tmp/fieldwork-zoom-ui.png',fullPage:true});
 await page.getByRole('spinbutton',{name:'Max zoom',exact:true}).fill('256');await settle();
 for(const mode of ['columns','rows','sequence','random','noise','spiral','tiled','fixed']){
  await page.getByLabel('Source X distribution',{exact:true}).selectOption(mode);await settle();
  await page.getByLabel('Source Y distribution',{exact:true}).selectOption(mode);await settle();
 }
 await page.getByLabel('Source X distribution',{exact:true}).selectOption('spiral');
 await page.getByLabel('Source Y distribution',{exact:true}).selectOption('noise');await settle();
 await saveArt('source-distributions');await page.getByLabel('Source X distribution',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/fieldwork-source-ui.png',fullPage:true});
 await page.getByLabel('Zoom image',{exact:true}).selectOption({index:2});await settle();
 await page.getByLabel('Zoom content',{exact:true}).selectOption('fragments');await settle();
 await expect(page.getByLabel('Viewing distance',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('slider',{name:'Fine detail contrast',exact:true})).toHaveCount(0);
 const beforeRegenerate=await hash(),seedBefore=await page.getByRole('spinbutton',{name:'Random seed',exact:true}).inputValue();
 await tab('Regenerate');await settle();assert.notEqual(await hash(),beforeRegenerate);
 await tab('Undo regenerate');await settle();assert.equal(await hash(),beforeRegenerate);await expect(page.getByRole('spinbutton',{name:'Random seed',exact:true})).toHaveValue(seedBefore);
 await tab('presets');await page.getByRole('button',{name:/Connected landscapes/}).click();await settle();await tab('compose');
 await expect(page.getByLabel('Arrange by',{exact:true})).toHaveValue('contour');await saveArt('contours');
 await tab('Pin fragments');const grid=page.getByRole('button',{name:/Pin grid cell/});await grid.press('Enter');await settle();await expect(page.getByRole('button',{name:'Release 1 pinned fragment',exact:true})).toBeVisible();
 await tab('New seed');await settle();await expect(page.locator('.pin-marker')).toHaveCount(1);
 await tab('Finish pinning');
 // All three systems can be composed, saved, animated and printed together.
 await page.locator('summary').filter({hasText:'Cell zoom'}).click();await page.getByRole('switch',{name:'Enable cell zoom'}).check();await settle();
 await page.getByLabel('Zoom content',{exact:true}).selectOption('fragments');await settle();
 await page.getByLabel('Source X distribution',{exact:true}).selectOption('random');await page.getByLabel('Source Y distribution',{exact:true}).selectOption('spiral');
 await page.getByRole('switch',{name:'Snap to source cells'}).uncheck();await settle();
 await tab('print');await page.getByRole('switch',{name:'Enable halftone'}).check();
 await page.getByLabel('Screen structure',{exact:true}).selectOption('contour');await page.getByLabel('Pattern',{exact:true}).selectOption('lines');await settle();await saveArt('all-systems');
 const flowing=await hash();await page.getByLabel('Screen structure',{exact:true}).selectOption('regular');await settle();assert.notEqual(await hash(),flowing);
 await page.getByLabel('Screen structure',{exact:true}).selectOption('contour');await settle();assert.equal(await hash(),flowing);
 await tab('Save preset');await page.getByLabel('Preset name',{exact:true}).fill('Contour zoom study');await page.getByRole('dialog').getByRole('button',{name:'Save preset',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('2 images in the mix')).toBeVisible();await settle();assert.equal(await hash(),flowing,'Saved settings reproduce the exact composite');
 await tab('motion');await expect(page.getByLabel('Animated composition preview',{exact:true})).toBeVisible({timeout:30000});await tab('Regenerate');await expect(page.getByLabel('Animated composition preview',{exact:true})).toBeVisible({timeout:30000});
 await expect(page.getByRole('button',{name:'Pause grid animation',exact:true})).toBeEnabled({timeout:30000});
 await tab('Undo regenerate');await expect(page.getByRole('button',{name:'Pause grid animation',exact:true})).toBeEnabled({timeout:30000});await tab('Stop animation and return to still');
 await tab('Export');await page.getByLabel('Print width',{exact:true}).fill('3');await page.getByLabel('Print height',{exact:true}).fill('3');
 const pending=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:/ZIP Print package/}).click();const download=await pending;await download.saveAs('/tmp/fieldwork-visual-systems.zip');
 const zip=unzipSync(await fs.readFile('/tmp/fieldwork-visual-systems.zip'));
 for(const [name,data] of Object.entries(zip))if(name.endsWith('.tif')){const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),[ifd]=UTIF.decode(buffer);UTIF.decodeImage(buffer,ifd);assert.equal(ifd.width,900);assert.equal(ifd.t282[0],300);if(name.startsWith('plates/'))assert.ok([...new Set(ifd.data)].every(v=>v===0||v===255));}
 const recipe=JSON.parse(new TextDecoder().decode(zip['recipe.json']));assert.equal(recipe.settings.multiscale,true);assert.equal(recipe.settings.distribution,'contour');assert.equal(recipe.settings.screenMode,'contour');assert.equal(recipe.settings.cellPins.length,1);assert.equal(recipe.settings.sourceXDistribution,'random');assert.equal(recipe.settings.sourceYDistribution,'spiral');assert.equal(recipe.settings.sourceSnap,false);
 await tab('compose');await page.getByRole('spinbutton',{name:'Columns',exact:true}).fill('10');await settle();await expect(page.getByRole('button',{name:'Release 1 pinned fragment',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/fieldwork-visual-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: three visual systems, eleven zoom layouts, 256× zoom, source distributions, regeneration/undo during motion, pinning, presets, animation, combined 300 DPI plate export, mobile layout.');
}finally{await browser.close();}

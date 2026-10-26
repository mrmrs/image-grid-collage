import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const animated=page.getByLabel('Animated composition preview',{exact:true});
const playing=async()=>{
 await expect(animated).toBeVisible();
 await expect(page.getByRole('button',{name:'Pause grid animation',exact:true})).toBeEnabled();
 const progress=await page.locator('.motion-progress-value').textContent();
 await expect(page.locator('.motion-progress-value')).not.toHaveText(progress);
};
const tab=async name=>page.getByRole('button',{name,exact:true}).click();
const setSeed=async seed=>page.getByRole('spinbutton',{name:'Random seed',exact:true}).fill(String(seed));
const staysStopped=async()=>{
 await expect(animated).toBeHidden();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 // Let queued frame preparation finish; an explicit stop must outlast it.
 await page.waitForTimeout(300);
 await expect(animated).toBeHidden();
};
const visibility=async hidden=>page.evaluate(value=>{
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>value});
 document.dispatchEvent(new Event('visibilitychange'));
},hidden);
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:5173');
 await expect(page.getByText('2 images in the mix')).toBeVisible();
 await expect(animated).toBeHidden();
 await tab('motion');await playing();
 // Both cached edits and edits that invalidate rendered frames keep animating.
 await page.getByRole('slider',{name:'Cell duration',exact:true}).press('ArrowRight');await playing();
 await tab('Bloom animation');await playing();
 await page.getByRole('slider',{name:'Seed increment',exact:true}).press('ArrowRight');
 await expect(page.locator('.motion-seeds')).toContainText('2410');await playing();
 await setSeed(3100);await setSeed(3200);await setSeed(3300);
 await expect(page.locator('.motion-seeds')).toContainText('3302');await playing();
 const source=page.locator('.image-select[aria-pressed="true"]').first();
 const title=(await source.getAttribute('aria-label')).replace('Deselect ','');
 await source.click();await expect(page.getByText('1 image in the mix')).toBeVisible();await playing();
 await tab(`Select ${title}`);await playing();
 // Leaving the inspector tab and dialogs temporarily interrupt playback, not intent.
 await tab('compose');await expect(animated).toBeHidden();
 await page.getByRole('spinbutton',{name:'Columns',exact:true}).fill('9');
 await tab('motion');await playing();
 await tab('Save preset');await expect(animated).toBeHidden();await tab('Close dialog');await playing();
 await tab('Export');await expect(animated).toBeHidden();await tab('Close dialog');await playing();
 await visibility(true);await expect(page.getByRole('button',{name:'Resume animation',exact:true})).toBeVisible();
 await visibility(false);await playing();
 // Pause is an opt-out across edits, dialogs, visibility changes and tab changes.
 await tab('Pause grid animation');
 const paused=await page.locator('.motion-progress-value').textContent();
 await page.getByRole('slider',{name:'Cell duration',exact:true}).press('ArrowRight');
 await expect(page.locator('.motion-progress-value')).toHaveText(paused);
 await setSeed(3400);await staysStopped();
 await tab('compose');await tab('motion');await staysStopped();
 await tab('Studio guide');await tab('Close dialog');await staysStopped();
 await visibility(true);await visibility(false);await staysStopped();
 await tab('Play grid animation');await playing();
 // Stop cancels pending preparation and never gets undone by subsequent edits.
 await setSeed(3500);
 await expect(page.getByRole('button',{name:'Stop animation and return to still'})).toBeEnabled();
 await tab('Stop animation and return to still');await setSeed(3600);await staysStopped();
 await tab('Fireflies animation');await staysStopped();
 await tab('Restart sequence');await playing();
 // Empty image selection suspends playback; selecting images restores it automatically.
 await tab('None');await expect(animated).toBeHidden();
 await tab('All');const libraryCount=await page.locator('.image-select').count();await expect(page.getByText(`${libraryCount} images in the mix`)).toBeVisible();await playing();
 await page.getByRole('button',{name:'Cell grouping Small groups',exact:true}).click();
 await page.getByRole('option',{name:'All together',exact:true}).click();
 await tab('Animate one variation');
 await expect(page.getByRole('button',{name:'Resume animation',exact:true})).toBeVisible();
 await expect(page.locator('.motion-progress-value')).toHaveText('100%');
 await tab('Bloom animation');await expect(page.getByRole('button',{name:'Resume animation',exact:true})).toBeVisible();
 await tab('Keep destination as still');await staysStopped();
 assert.deepEqual(errors,[]);
 console.log('PASS: tab autoplay, live edits, source changes, rapid seed changes, tab/dialog/visibility recovery, pause/stop opt-out, restart, empty selection recovery, single variation and keep still.');
}finally{await browser.close();}

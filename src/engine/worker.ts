import { zipSync, strToU8 } from 'fflate';
import { writePsd } from 'ag-psd';
import { exportDimensions, normalizeSettings } from '../model';
import type { SourceImage } from '../model';
import { loadSources, makeTiles, planGrid, describePlan, renderGrid, separate, compositePlates, plateLayer } from './render';
import { encodeTiff, rgbaToRgb } from './tiff';
self.onmessage = async (event: MessageEvent) => {
  const { id, mode, settings: raw, sources, solo = -1, previewWidth = 1000 } = event.data;
  try {
    const s=normalizeSettings(raw);
    const images=await loadSources(sources as SourceImage[]);
    if(!images.length)throw new Error('Select at least one source image.');
    const dimensions=mode==='preview'?{width:Math.round(previewWidth),height:Math.max(1,Math.round(previewWidth*s.height/s.width))}:exportDimensions(s);
    const {width,height}=dimensions;
    const tiles=makeTiles(images,s),plan=planGrid(tiles,s);
    const canvas=renderGrid(tiles,s,width,height,plan),ctx=canvas.getContext('2d')!;
    const original=ctx.getImageData(0,0,width,height);
    const needsPlates=s.halftone||mode==='package';
    const plates=needsPlates?separate(original,s):[];
    const composite=s.halftone?compositePlates(plates,width,height,mode==='preview'?solo:-1):original;
    if(mode==='preview') {
      ctx.putImageData(composite,0,0);const bitmap=canvas.transferToImageBitmap();
      self.postMessage({id,mode,bitmap,renderKey:event.data.renderKey,cells:id>=0?describePlan(plan):undefined}, {transfer:[bitmap]});return;
    }
    self.postMessage({id,progress:'Encoding print files…'});
    if(mode==='tiff') {
      const bytes=encodeTiff(rgbaToRgb(composite.data),width,height,s.dpi);
      self.postMessage({id,mode,bytes,mime:'image/tiff',extension:'tif'},{transfer:[bytes.buffer]});return;
    }
    const files:Record<string,Uint8Array>={
      'composite.tif':encodeTiff(rgbaToRgb(composite.data),width,height,s.dpi),
      'recipe.json':strToU8(JSON.stringify({schemaVersion:1,settings:s,sources:sources.map(({src,...rest}:SourceImage)=>rest)},null,2)),
      'README.txt':strToU8(`PRINT SHOP / PRINT PACKAGE\n${width} × ${height} pixels · ${s.dpi} DPI · ${s.width} × ${s.height} inches\n\nComposite TIFF: RGB proof. Plates: 8-bit grayscale TIFFs, black = ink, white = paper.\nEach plate contains a binary ${s.screenMode} halftone screen at ${s.lpi} nominal lines/inch. Contour screens vary local spacing with image structure.\nLayers.psd has transparent named ink layers in Multiply mode above white paper.\nDisabled inks remain in the package and are hidden in the PSD.\nCMYK separation is mathematical, not ICC-profiled. Spot separation is a creative palette approximation.\nHalftone setting for composite: ${s.halftone ? 'on':'off'}; plates are always screened.\n`),
    };
    plates.forEach((plate,i)=>{const gray=plate.coverage.map(v=>255-v);files[`plates/${String(i+1).padStart(2,'0')}-${plate.ink.name.replace(/[^a-z0-9-]/gi,'_')}.tif`]=encodeTiff(gray,width,height,s.dpi,1);});
    const white=new Uint8ClampedArray(width*height*4);white.fill(255);
    const proof=compositePlates(plates,width,height);
    const psd=writePsd({width,height,imageData:proof,imageResources:{resolutionInfo:{horizontalResolution:s.dpi,horizontalResolutionUnit:'PPI',widthUnit:'Inches',verticalResolution:s.dpi,verticalResolutionUnit:'PPI',heightUnit:'Inches'}},children:[
      {name:'Paper',imageData:new ImageData(white,width,height)},
      ...plates.map(plate=>({name:plate.ink.name,blendMode:'multiply' as const,hidden:!plate.ink.enabled,imageData:plateLayer(plate,width,height)})),
    ]});
    files['layers.psd']=new Uint8Array(psd);
    self.postMessage({id,progress:'Packing TIFF plates and layers…'});
    const bytes=zipSync(files,{level:1});
    self.postMessage({id,mode,bytes,mime:'application/zip',extension:'zip'},{transfer:[bytes.buffer]});
  } catch(error) { self.postMessage({id,error:error instanceof Error?error.message:String(error)}); }
};

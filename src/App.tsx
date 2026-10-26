import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Square, Waves, ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleHelp, Copy, Eye, EyeOff, FolderOpen, Grid2X2, ImagePlus, Layers, LoaderCircle, Maximize2, Plus, RotateCcw, Save, Shuffle, SlidersHorizontal, Upload, X } from 'lucide-react';
import { DEFAULTS, STARTERS, cloneSettings, normalizeSettings, exportDimensions } from './model';
import type { Settings, SourceImage, Preset, Ink, Revision, CellPin } from './model';
import { MultiscaleControls, ContourControls, FlowControls } from './components/VisualSystems';
import { Section, Slider, Select, Color, Toggle, NumberField } from './components/Controls';
import { readSession, writeSession, download, fileDataUrl } from './storage';

import { useGridMotion } from './motion/useGridMotion';
import { artworkKey } from './motion/timing';
import './motion/style.css';
const MotionPanel=lazy(()=>import('./components/MotionPanel').then(m=>({default:m.MotionPanel})));

type Tab='compose'|'motion'|'print'|'presets';
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>{children}</dialog>;
}
export default function App(){
  const [settings,setSettings]=useState<Settings>(cloneSettings(DEFAULTS));
  const [library,setLibrary]=useState<SourceImage[]>([]),[uploads,setUploads]=useState<SourceImage[]>([]);
  const [presets,setPresets]=useState<Preset[]>([]),[activePreset,setActivePreset]=useState<string|null>(null),[activeRevision,setActiveRevision]=useState<string|null>(null);
  const [ready,setReady]=useState(false),[tab,setTab]=useState<Tab>('compose'),[modal,setModal]=useState<'save'|'export'|'help'|null>(null);
  const [name,setName]=useState('Untitled study'),[note,setNote]=useState(''),[toast,setToast]=useState(''),[error,setError]=useState('');
  const [rendering,setRendering]=useState(false),[exporting,setExporting]=useState(''),[solo,setSolo]=useState(-1),[zoom,setZoom]=useState(1),[filter,setFilter]=useState('all');
  const [renderedKey,setRenderedKey]=useState('');
  const [pinning,setPinning]=useState(false),[pinCursor,setPinCursor]=useState(0);
  const cellPlan=useRef<CellPin[]>([]);
  const [saveStatus,setSaveStatus]=useState('Saved locally');
  const canvasRef=useRef<HTMLCanvasElement>(null),workerRef=useRef<Worker|null>(null),exportWorker=useRef<Worker|null>(null),jobRef=useRef(0);
  const fileRef=useRef<HTMLInputElement>(null),importRef=useRef<HTMLInputElement>(null);
  const allImages=useMemo(()=>[...library,...uploads],[library,uploads]);
  const selected=useMemo(()=>allImages.filter(i=>settings.selectedIds.includes(i.id)),[allImages,settings.selectedIds]);
  const motion=useGridMotion(settings,selected,solo,workerRef,setError,ready&&tab==='motion'&&!modal);
  const previewKey=artworkKey(settings);
  const previewPending=rendering||!ready||(selected.length>0&&renderedKey!==previewKey+':'+solo);
  const currentPreset=presets.find(p=>p.id===activePreset);
  const inks=settings.separation==='cmyk'?settings.inks:settings.spotInks;
  const patch=(values:Partial<Settings>)=>setSettings(s=>({...s,...values,...((values.rows!==undefined&&values.rows!==s.rows)||(values.columns!==undefined&&values.columns!==s.columns)?{cellPins:[]}: {})}));
  const set=<K extends keyof Settings>(key:K,value:Settings[K])=>patch({[key]:value});
  const notify=(message:string)=>{setToast(message);};
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer);}},[toast]);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try {
        const response=await fetch('/image-library.json');if(!response.ok)throw new Error('Could not load the sample library.');const images=await response.json() as SourceImage[];
        let stored;try{stored=await readSession();}catch{if(alive)setSaveStatus('Storage unavailable');}
        if(!alive)return;setLibrary(images);
        if(stored){setSettings(normalizeSettings(stored.settings));setUploads(stored.uploads??[]);setPresets((stored.presets??[]).map(p=>({...p,revisions:p.revisions.map(r=>({...r,settings:normalizeSettings(r.settings)}))})));setActivePreset(stored.activePreset);setActiveRevision(stored.activeRevision);}
        else setSettings({...cloneSettings(DEFAULTS),selectedIds:images.filter((_,i)=>[0,1,5,6,10,12,18,23].includes(i)).map(i=>i.id)});
      } catch(e){if(alive)setError(String(e));}finally{if(alive)setReady(true);}
    })();return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!ready)return;setSaveStatus('Saving…');const timer=setTimeout(()=>{
      writeSession({settings,uploads,presets,activePreset,activeRevision}).then(()=>setSaveStatus('Saved locally')).catch(()=>setSaveStatus('Could not save — export a backup'));
    },400);return()=>clearTimeout(timer);
  },[settings,uploads,presets,activePreset,activeRevision,ready]);
  useEffect(()=>{
    const worker=new Worker(new URL('./engine/worker.ts',import.meta.url),{type:'module'});workerRef.current=worker;
    worker.onmessage=e=>{
      const {id,bitmap,error:message}=e.data;
      if(id<0)return; // Motion player owns these responses.
      if(id!==jobRef.current){bitmap?.close();return;}
      cellPlan.current=e.data.cells??[];setRenderedKey(e.data.renderKey??'');
      setRendering(false);if(message){setError(message);return;}
      const canvas=canvasRef.current;if(canvas&&bitmap){canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d')!.drawImage(bitmap,0,0);bitmap.close();}
    };
    worker.onerror=e=>{setError(`Preview failed: ${e.message}`);setRendering(false);};
    return()=>{worker.terminate();exportWorker.current?.terminate();};
  },[]);
  useEffect(()=>{
    if(!ready)return;
    const id=++jobRef.current;
    if(!selected.length){setRendering(false);const c=canvasRef.current;c?.getContext('2d')?.clearRect(0,0,c.width,c.height);return;}
    setRendering(true);
    const timer=setTimeout(()=>{workerRef.current?.postMessage({id,mode:'preview',renderKey:previewKey+':'+solo,settings,sources:selected,solo,previewWidth:Math.min(1200,Math.round(1200*settings.width/settings.height))});},100);
    return()=>clearTimeout(timer);
  },[previewKey,selected,solo,ready]);
  function applyStarter(index:number){const starter=STARTERS[index];setSettings({...cloneSettings(DEFAULTS),...starter.patch,selectedIds:settings.selectedIds});setActivePreset(null);setActiveRevision(null);setSolo(-1);setName(starter.name);notify(`${starter.name} loaded`);}
  useEffect(()=>setPinCursor(i=>Math.min(i,settings.rows*settings.columns-1)),[settings.rows,settings.columns]);
  function togglePin(cell:number){
    if(previewPending||!cellPlan.current[cell])return;
    const pin=cellPlan.current[cell];
    set('cellPins',settings.cellPins.some(p=>p.cell===cell)?settings.cellPins.filter(p=>p.cell!==cell):[...settings.cellPins,pin]);
  }
  function toggleSource(id:string){set('selectedIds',settings.selectedIds.includes(id)?settings.selectedIds.filter(i=>i!==id):[...settings.selectedIds,id]);}
  async function upload(files:FileList|null){
    if(!files?.length)return;
    try{
      const added:SourceImage[]=[];
      for(const file of Array.from(files)){
        if(!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type))throw new Error('Use JPEG, PNG, WebP, AVIF or GIF images.');
        const src=await fileDataUrl(file),bitmap=await createImageBitmap(file);bitmap.close();
        added.push({id:crypto.randomUUID(),title:file.name,author:'Your image',url:'',src,custom:true});
      }
      setUploads(u=>[...u,...added]);setSettings(s=>({...s,selectedIds:[...s.selectedIds,...added.map(a=>a.id)]}));notify(`${added.length} image${added.length===1?'':'s'} added`);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    if(fileRef.current)fileRef.current.value='';
  }
  function savePreset(newPreset:boolean){
    if(!name.trim()){setError('Give this preset a name.');return;}
    const revision:Revision={id:crypto.randomUUID(),createdAt:new Date().toISOString(),settings:cloneSettings(settings),note:note.trim()};
    const id=!newPreset&&currentPreset?currentPreset.id:crypto.randomUUID();
    setPresets(p=>!newPreset&&currentPreset?p.map(item=>item.id===id?{...item,revisions:[...item.revisions,revision]}:item):[...p,{id,name:name.trim(),revisions:[revision]}]);
    setActivePreset(id);setActiveRevision(revision.id);setModal(null);setNote('');notify(`Saved ${!newPreset&&currentPreset?`version ${currentPreset.revisions.length+1}`:'new preset'}`);
  }
  function restore(preset:Preset,revision:Revision){setSettings(normalizeSettings(revision.settings));setActivePreset(preset.id);setActiveRevision(revision.id);setName(preset.name);setSolo(-1);notify('Version restored');}
  function exportRecipe(){download(JSON.stringify({schemaVersion:1,settings,presets,uploads},null,2),'fieldwork-library.json','application/json');notify('Preset library and uploads exported');}
  async function importRecipe(file:File|undefined){
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());if(data.schemaVersion!==1)throw new Error('Unsupported recipe version.');
      const parsed=normalizeSettings(data.settings);
      const importedUploads:SourceImage[]=(data.uploads??[]).map((item:SourceImage)=>{
        if(typeof item.id!=='string'||typeof item.src!=='string'||!/^data:image\/(jpeg|png|webp|avif|gif);base64,/.test(item.src))throw new Error('Invalid embedded image.');
        return {...item,title:String(item.title),author:'Your image',url:'',custom:true};
      });
      const importedPresets:Preset[]=(data.presets??[]).map((p:Preset)=>{
        if(typeof p.name!=='string'||!Array.isArray(p.revisions))throw new Error('Invalid preset history.');
        return {id:crypto.randomUUID(),name:p.name,revisions:p.revisions.map(r=>({id:crypto.randomUUID(),note:String(r.note??''),createdAt:new Date(r.createdAt).toISOString(),settings:normalizeSettings(r.settings)}))};
      });
      setUploads(old=>[...old.filter(o=>!importedUploads.some(n=>n.id===o.id)),...importedUploads]);setPresets(old=>[...old,...importedPresets]);setSettings(parsed);setActivePreset(null);setActiveRevision(null);setSolo(-1);notify('Recipe imported');
    }catch(e){setError(e instanceof Error?e.message:'Could not import this recipe.');}
    if(importRef.current)importRef.current.value='';
  }
  function startExport(mode:'tiff'|'package'){
    try{exportDimensions(settings);if(!selected.length)throw new Error('Select at least one source image.');}catch(e){setError((e as Error).message);return;}
    setExporting('Rendering at print resolution…');
    const worker=new Worker(new URL('./engine/worker.ts',import.meta.url),{type:'module'});exportWorker.current=worker;
    worker.onmessage=e=>{
      if(e.data.progress){setExporting(e.data.progress);return;}
      if(e.data.error)setError(e.data.error);
      else {download(e.data.bytes,`fieldwork-${settings.seed}-${settings.dpi}dpi.${e.data.extension}`,e.data.mime);notify('Print file exported');setModal(null);}
      setExporting('');worker.terminate();exportWorker.current=null;
    };
    worker.onerror=e=>{setError(`Export failed: ${e.message}`);setExporting('');worker.terminate();exportWorker.current=null;};
    worker.postMessage({id:1,mode,settings:cloneSettings(settings),sources:selected});
  }
  function cancelExport(){exportWorker.current?.terminate();exportWorker.current=null;setExporting('');notify('Export canceled');}
  function updateInk(index:number,values:Partial<Ink>){const key=settings.separation==='cmyk'?'inks':'spotInks';set(key,inks.map((ink,i)=>i===index?{...ink,...values}:ink));}
  const num=(key:keyof Settings,label:string,min:number,max:number,step=1,suffix='')=><Slider label={label} value={settings[key] as number} onChange={v=>set(key,v as never)} min={min} max={max} step={step} suffix={suffix}/>;
  const select=(key:keyof Settings,label:string,options:readonly (string|readonly [string,string])[])=><Select label={label} value={String(settings[key])} onChange={v=>{set(key,v as never);if(key==='separation')setSolo(-1);}} options={options}/>;
  const pxW=Math.round(settings.width*settings.dpi),pxH=Math.round(settings.height*settings.dpi);
  const visibleImages=filter==='selected'?selected:filter==='uploads'?uploads:allImages;
  const missing=settings.selectedIds.filter(id=>!allImages.some(i=>i.id===id));
  return <div className="app">
    <header className="topbar"><a className="brand" href="/" aria-label="Fieldwork home"><span className="brand-mark"><i/><i/><i/><i/></span>fieldwork</a><div className="top-actions"><button className="icon-button" aria-label="Studio guide" onClick={()=>setModal('help')}><CircleHelp size={17}/></button><button className="quiet-button" onClick={()=>set('seed',Math.floor(Math.random()*1000000))}><Shuffle size={14}/>Regenerate</button><button className="quiet-button" onClick={()=>{setName(currentPreset?.name??name);setModal('save');}}><Save size={15}/>Save preset</button><button className="primary-button" onClick={()=>setModal('export')}><ArrowDownToLine size={15}/>Export<ArrowUpRight size={14}/></button></div></header>
    <div className="workspace">
      <aside className="library-panel"><div className="panel-heading"><div><h2>Image library <span>{allImages.length.toString().padStart(2,'0')}</span></h2></div><button className="icon-button" aria-label="Upload images" onClick={()=>fileRef.current?.click()}><Plus size={19}/></button></div>
        <div className="library-tools"><Select label="Show images" value={filter} onChange={setFilter} options={[['all','All images'],['selected','Selected'],['uploads','Your uploads']]}/><div><button onClick={()=>set('selectedIds',allImages.map(i=>i.id))}>All</button><span>/</span><button onClick={()=>set('selectedIds',[])}>None</button></div></div>
        <div className="image-list" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void upload(e.dataTransfer.files);}}>
          {visibleImages.map((image)=><div className={`image-card ${settings.selectedIds.includes(image.id)?'is-selected':''}`} key={image.id}><button className="image-select" aria-label={`${settings.selectedIds.includes(image.id)?'Deselect':'Select'} ${image.title}`} aria-pressed={settings.selectedIds.includes(image.id)} onClick={()=>toggleSource(image.id)} title={image.title}><img src={image.src} alt={image.title} loading="lazy"/><span className="image-index">{String(allImages.indexOf(image)+1).padStart(2,'0')}</span><span className="image-check">{settings.selectedIds.includes(image.id)&&<Check size={11}/>}</span></button><div className="image-credit">{image.url?<a href={image.url} target="_blank" rel="noreferrer" title={`Photo by ${image.author} on Unsplash`}>{image.author}<ArrowUpRight size={10}/></a>:<span>{image.title}</span>}</div></div>)}
          {!visibleImages.length&&<p className="empty-small">{filter==='uploads'?'Drop your images here to begin.':'No images in this view.'}</p>}
          <button className="upload-tile" onClick={()=>fileRef.current?.click()}><ImagePlus size={22}/><span>Add images</span><small>or drop files here</small></button>
        </div>
        <div className="library-footer"><span className="selection-count">{selected.length} images in the mix</span><p>25 photographs from <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash ↗</a></p><details><summary>Source slicing <span>{settings.sourceColumns} × {settings.sourceRows}</span></summary><div className="two-columns"><NumberField label="Slice columns" value={settings.sourceColumns} onChange={v=>set('sourceColumns',Math.round(v))} min={1} max={24}/><NumberField label="Slice rows" value={settings.sourceRows} onChange={v=>set('sourceRows',Math.round(v))} min={1} max={24}/></div><p>Each image is cut into {settings.sourceRows*settings.sourceColumns} reusable fragments.</p></details></div>
      </aside>
      <main className="stage-panel" aria-label="Composition">
        <div className="stage" style={{'--art-ratio':settings.width/settings.height} as React.CSSProperties}>
          <div className="artboard-wrap" style={{transform:`scale(${zoom})`}}><span className="dimension-top">{settings.width} IN</span><span className="dimension-left">{settings.height} IN</span><div className="artboard" style={{aspectRatio:settings.width/settings.height,background:settings.background}}><canvas ref={canvasRef} aria-label="Generative composition preview" aria-busy={previewPending}/><canvas ref={motion.canvasRef} className="motion-canvas" aria-label="Animated composition preview" hidden={!motion.state.visible} aria-hidden={!motion.state.visible}/>{pinning&&tab==='compose'&&settings.distribution==='contour'&&selected.length>0&&<button className="pin-grid" style={{left:`${Math.min(settings.width,settings.height)*settings.margin/settings.width}%`,right:`${Math.min(settings.width,settings.height)*settings.margin/settings.width}%`,top:`${Math.min(settings.width,settings.height)*settings.margin/settings.height}%`,bottom:`${Math.min(settings.width,settings.height)*settings.margin/settings.height}%`,'--pin-columns':settings.columns,'--pin-rows':settings.rows} as React.CSSProperties} aria-label={`Pin grid cell ${Math.floor(pinCursor/settings.columns)+1}, ${pinCursor%settings.columns+1}. Arrow keys choose a cell; Enter pins it.`} disabled={previewPending} onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),col=Math.min(settings.columns-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*settings.columns))),row=Math.min(settings.rows-1,Math.max(0,Math.floor((e.clientY-r.top)/r.height*settings.rows)));setPinCursor(row*settings.columns+col);togglePin(row*settings.columns+col);}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key)){e.preventDefault();if(e.key==='Enter'||e.key===' ')togglePin(pinCursor);else setPinCursor(i=>Math.max(0,Math.min(settings.rows*settings.columns-1,i+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-settings.columns:settings.columns))));}}}><span className="pin-cursor" style={{left:`${pinCursor%settings.columns/settings.columns*100}%`,top:`${Math.floor(pinCursor/settings.columns)/settings.rows*100}%`,width:`${100/settings.columns}%`,height:`${100/settings.rows}%`}}/>{settings.cellPins.map(pin=><span key={pin.cell} className="pin-marker" style={{left:`${(pin.cell%settings.columns+.5)/settings.columns*100}%`,top:`${(Math.floor(pin.cell/settings.columns)+.5)/settings.rows*100}%`}}>●</span>)}</button>}{!selected.length&&ready&&<div className="canvas-empty"><Grid2X2 size={32}/><h2>Start with an image.</h2><p>Select photographs from the library<br/>or add a few of your own.</p></div>}</div><div className="artboard-foot"><span>FIELDWORK — {settings.columns} × {settings.rows}</span><span>{settings.halftone?`${settings.separation.toUpperCase()} / ${settings.pattern.toUpperCase()}`:'IMAGE STUDY'}</span></div></div>
          {(rendering||!ready)&&<span className="rendering"><LoaderCircle size={13} className="spin"/>{ready?'Composing':'Loading studio'}</span>}
        </div>
        <div className="stage-toolbar"><div className="view-options"><button className={solo===-1?'active':''} onClick={()=>setSolo(-1)}><Grid2X2 size={14}/>Composite</button>{settings.halftone&&<div className="plate-shortcuts">{inks.map((ink,i)=><button key={i} className={solo===i?'active':''} aria-label={`View ${ink.name} plate`} title={`${ink.name} plate`} onClick={()=>setSolo(solo===i?-1:i)}><span style={{background:ink.color}}/></button>)}</div>}</div><div className="zoom-controls"><button className="icon-button" aria-label="Zoom out" onClick={()=>setZoom(Math.max(.5,zoom-.25))}>−</button><span>{Math.round(zoom*100)}%</span><button className="icon-button" aria-label="Zoom in" onClick={()=>setZoom(Math.min(2,zoom+.25))}>+</button><button className="icon-button" aria-label="Fit artwork" onClick={()=>setZoom(1)}><Maximize2 size={14}/></button></div></div>
        <div className={`motion-transport ${motion.state.visible?'is-live':''}`}>
          <button className="motion-transport-play" aria-label={motion.state.phase==='playing'?'Pause grid animation':'Play grid animation'} disabled={!ready||!selected.length||rendering||motion.state.phase==='preparing'} onClick={()=>{setTab('motion');motion.toggle();}}>{motion.state.phase==='preparing'?<LoaderCircle size={13} className="spin"/>:motion.state.phase==='playing'?<Pause size={13}/>:<Play size={13}/>}</button>
          <button className="motion-transport-title" onClick={()=>setTab('motion')}><Waves size={13}/><span>{motion.state.phase==='idle'?'Animate':motion.state.phase==='preparing'?'Preparing next variation':motion.state.phase==='playing'?'Evolving':'Paused'}</span></button>
          <input ref={motion.scrubRef} className="motion-scrubber" aria-label="Animation progress" type="range" min="0" max="100" step=".1" defaultValue="0" onFocus={motion.pause} onPointerDown={motion.pause} onKeyDown={motion.pause} disabled={!motion.state.visible||motion.state.phase==='preparing'} onChange={e=>motion.seek(Number(e.target.value)/100)}/>
          <span ref={motion.percentRef} className="motion-progress-value">0%</span>
          <button className="icon-button" disabled={motion.state.phase==='idle'} aria-label="Stop animation and return to still" title="Return to still" onClick={motion.stop}><Square size={11}/></button>
        </div>
      </main>
      <aside className="inspector"><nav className="inspector-tabs" aria-label="Studio controls">{(['compose','motion','print','presets'] as Tab[]).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='compose'?<SlidersHorizontal size={14}/>:t==='motion'?<Waves size={14}/>:t==='print'?<Layers size={14}/>:<FolderOpen size={14}/>}<span>{t}</span></button>)}</nav><div className="inspector-parameters"><NumberField label="Random seed" value={settings.seed} onChange={v=>set('seed',Math.round(v))} min={0} max={2147483647}/></div><div className="inspector-content">
      {tab==='compose'&&<>
        <MultiscaleControls settings={settings} patch={patch} images={selected}/>
        <Section title="The grid"><div className="two-columns"><NumberField label="Columns" value={settings.columns} onChange={v=>set('columns',Math.round(v))} min={1} max={80}/><NumberField label="Rows" value={settings.rows} onChange={v=>set('rows',Math.round(v))} min={1} max={80}/></div>{num('gap','Cell gap',0,50,1,'%')}{num('margin','Outer margin',0,30,.5,'%')}<Color label="Paper color" value={settings.background} onChange={v=>set('background',v)}/></Section>
        <Section title="Distribution">{select('distribution','Arrange by',[['contour','Connected contours'],['random','Random scatter'],['gradient','Linear gradient'],['radial','Radial gradient'],['noise','Noise field'],['color','Color selection'],['luminance','Light → dark'],['checkerboard','Checkerboard'],['stripes','Stripes'],['ordered','Sequential']])}<p className="control-hint">{settings.distribution==='contour'?'Align the contours of neighboring fragments.':settings.distribution==='noise'?'Soft clusters of images, guided by a continuous noise field.':settings.distribution==='color'?'Match fragment colors to a two-color gradient.':settings.distribution==='luminance'?'Arrange fragments by their average brightness.':'Arrange images across the grid, then choose a fragment from each.'}</p>{!['color','luminance','contour'].includes(settings.distribution)&&select('crop','Pick fragments',[['random','Random slice'],['corresponding','Match grid position'],['ordered','Sequential slices']])}{['gradient','color','luminance'].includes(settings.distribution)&&num('gradientAngle','Gradient angle',0,360,1,'°')}{settings.distribution==='color'&&<><Color label="From color" value={settings.colorStart} onChange={v=>set('colorStart',v)}/><Color label="To color" value={settings.colorEnd} onChange={v=>set('colorEnd',v)}/></>}{(settings.distribution==='noise'||settings.scaleMode==='noise')&&num('noiseScale','Noise frequency',.5,20,.1)}{settings.distribution==='contour'&&<ContourControls settings={settings} patch={patch} pinning={pinning} setPinning={v=>{setPinning(v);setPinCursor(0);}}/>}{!['random','contour'].includes(settings.distribution)&&num('chaos','Variation',0,1,.01)}</Section>
        <Section title="Cell shape"><div className="shape-picker">{(['square','circle','diamond','triangle','hexagon','arch','mixed'] as const).map(m=><button key={m} className={settings.mask===m?'active':''} title={m} aria-label={`${m} mask`} aria-pressed={settings.mask===m} onClick={()=>set('mask',m)}>{m==='mixed'?<Shuffle size={15}/>:<span className={`shape ${m}`}/>}</button>)}</div>{num('scale','Cell scale',.1,1.5,.01,'×')}{select('scaleMode','Scale variation',['uniform','random','noise','gradient'])}{settings.scaleMode!=='uniform'&&num('variation','Variation amount',0,1,.01)}{settings.scaleMode==='gradient'&&num('gradientAngle','Scale gradient angle',0,360,1,'°')}{num('rotation','Rotation',-180,180,1,'°')}{num('rotationJitter','Rotation randomness',0,180,1,'°')}<Toggle label="Randomly mirror cells" value={settings.flip} onChange={v=>set('flip',v)}/></Section>
        <Section title="Image adjustments" defaultOpen={false}>{num('saturation','Saturation',0,2,.05)}{num('contrast','Contrast',.2,2,.05)}</Section>
      </>}
      {tab==='motion'&&<Suspense fallback={<p className="motion-loading">Loading motion controls…</p>}><MotionPanel settings={settings} patch={patch} motion={motion} canPlay={ready&&selected.length>0&&!rendering} onKeep={()=>{const seed=motion.targetSeed();motion.stop();set('seed',seed);notify(`Variation ${seed} is now your still composition`);}}/></Suspense>}
      {tab==='print'&&<>

        <Section title="Halftone screen"><Toggle label="Enable halftone" value={settings.halftone} onChange={v=>{set('halftone',v);setSolo(-1);}}/><FlowControls settings={settings} patch={patch}/>{select('pattern','Pattern',[['dots','Round dots'],['lines','Parallel lines'],['diamonds','Diamonds'],['squares','Squares']])}{num('lpi','Screen frequency',2,100,1,'LPI')}{num('gain','Dot gain',-.5,.5,.01)}<p className="control-hint">LPI is lines per printed inch. Preview is downsampled; export renders at full resolution.</p></Section>
        <Section title="Color separation">{select('separation','Ink system',[['cmyk','CMYK · four color'],['spot','Custom ink palette']])}{settings.separation==='cmyk'&&num('blackGeneration','Black generation',0,1,.05)}<p className="control-hint">{settings.separation==='cmyk'?'Mathematical CMYK separation. Ink colors simulate the proof; no ICC profile is applied.':'Creative separation into your palette. Add up to six inks and tune each screen.'}</p>
        <div className="ink-list">{inks.map((ink,i)=><details className="ink-card" key={`${settings.separation}-${i}`}><summary><span className="ink-dot" style={{background:ink.color}}/><span>{ink.name}</span><small>{ink.angle}°</small><button className="icon-button" aria-label={`${ink.enabled?'Hide':'Show'} ${ink.name} ink`} onClick={e=>{e.preventDefault();updateInk(i,{enabled:!ink.enabled});}}>{ink.enabled?<Eye size={14}/>:<EyeOff size={14}/>}</button><ChevronDown size={12}/></summary><div className="ink-body"><label className="text-field">Ink name<input value={ink.name} maxLength={60} onChange={e=>updateInk(i,{name:e.target.value})}/></label><Color label={`${ink.name} color`} value={ink.color} onChange={color=>updateInk(i,{color})}/><Slider label={`${ink.name} angle`} value={ink.angle} min={0} max={180} suffix="°" onChange={angle=>updateInk(i,{angle})}/><Slider label={`${ink.name} density`} value={ink.density} min={0} max={2} step={.05} onChange={density=>updateInk(i,{density})}/><button className="wide-button" onClick={()=>{set('halftone',true);setSolo(solo===i?-1:i);}}><Eye size={14}/>{solo===i?'Show composite':'Isolate plate'}</button>{settings.separation==='spot'&&inks.length>1&&<button className="text-button danger" onClick={()=>{set('spotInks',inks.filter((_,n)=>n!==i));setSolo(-1);}}>Remove ink</button>}</div></details>)}</div>{settings.separation==='spot'&&inks.length<6&&<button className="wide-button" onClick={()=>set('spotInks',[...inks,{name:`Ink ${inks.length+1}`,color:'#292b28',angle:45,density:1,enabled:true}])}><Plus size={14}/>Add ink</button>}</Section>
        <Section title="Print dimensions"><div className="two-columns"><NumberField label="Width" value={settings.width} onChange={v=>set('width',v)} min={1} max={40} step={.25} suffix="in"/><NumberField label="Height" value={settings.height} onChange={v=>set('height',v)} min={1} max={40} step={.25} suffix="in"/></div><NumberField label="Resolution" value={settings.dpi} onChange={v=>set('dpi',Math.round(v))} min={72} max={1200} suffix="DPI"/><div className="print-spec"><span>{pxW.toLocaleString()} × {pxH.toLocaleString()} px</span><span>{(pxW*pxH/1e6).toFixed(1)} MP</span></div>{pxW*pxH>20e6&&<p className="inline-warning">Above the 20 MP export limit. Lower dimensions or DPI.</p>}{settings.dpi/settings.lpi<4&&<p className="inline-warning">Fewer than 4 pixels per screen cell. Increase DPI or lower LPI for cleaner dots.</p>}</Section>
      </>}
      {tab==='presets'&&<><Section title="Starting points"><div className="starter-list">{STARTERS.map((starter,i)=><button className="starter" key={starter.name} onClick={()=>applyStarter(i)}><span className={`starter-swatch ${starter.swatch}`}/><span><strong>{starter.name}</strong><small>{starter.description}</small></span><ArrowUpRight size={14}/></button>)}</div></Section><Section title="Your presets"><button className="wide-button" onClick={()=>setModal('save')}><Plus size={14}/>Save preset</button>{!presets.length&&<p className="empty-small">No saved presets.</p>}{presets.map(p=><details className="preset-item" key={p.id} open={p.id===activePreset}><summary><span>{p.name}</span><small>{p.revisions.length} versions</small></summary><div className="versions">{p.revisions.map((r,i)=><button className={r.id===activeRevision?'selected':''} key={r.id} onClick={()=>restore(p,r)}><span><strong>Version {i+1}</strong><small>{r.note||new Date(r.createdAt).toLocaleString()}</small></span>{r.id===activeRevision?<Check size={13}/>:<RotateCcw size={13}/>}</button>)}</div></details>)}</Section><Section title="Backup & import"><p className="control-hint">Back up every preset, version, current setting, and uploaded image in one JSON file.</p><div className="two-columns"><button className="wide-button" onClick={exportRecipe}><ArrowDownToLine size={14}/>Backup</button><button className="wide-button" onClick={()=>importRef.current?.click()}><Upload size={14}/>Import</button></div></Section></>}
      </div></aside>
    </div>
    <footer className="bottom-bar"><span className="save-status">{saveStatus}</span><span className="composition-stats">{settings.rows*settings.columns} cells <i>·</i> {selected.length*settings.sourceRows*settings.sourceColumns} source fragments <i>·</i> {settings.dpi} DPI</span><span>v0.1</span></footer>
    <input hidden ref={fileRef} aria-label="Image files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={e=>void upload(e.target.files)}/><input hidden ref={importRef} aria-label="Import recipe file" type="file" accept=".json,application/json" onChange={e=>void importRecipe(e.target.files?.[0])}/>
    {missing.length>0&&<div className="missing-banner">{missing.length} saved source image(s) missing. Import the library backup that includes them.<button onClick={()=>set('selectedIds',settings.selectedIds.filter(id=>!missing.includes(id)))}>Remove missing</button></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}{error&&<div className="error-toast" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
    {modal==='save'&&<Modal title="Save an exploration" onClose={()=>setModal(null)}><p className="modal-copy">Keep this exact mix of images, parameters, and seed. Earlier versions stay untouched.</p><label className="text-field">Preset name<input autoFocus value={name} maxLength={80} onChange={e=>setName(e.target.value)} placeholder="A name for this idea"/></label><label className="text-field">Version note <span>optional</span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="What changed in this iteration?" maxLength={500}/></label><div className="modal-actions">{currentPreset&&<button className="quiet-button" onClick={()=>savePreset(true)}><Copy size={14}/>Save as new preset</button>}<button className="primary-button" onClick={()=>savePreset(!currentPreset)}><Save size={14}/>{currentPreset?`Save version ${currentPreset.revisions.length+1}`:'Save preset'}</button></div></Modal>}
    {modal==='export'&&<Modal title="From screen to print" onClose={()=>{if(!exporting)setModal(null);}}><p className="modal-copy">Full-resolution output, with your print size and resolution embedded in every TIFF.</p><div className="export-spec"><strong>{pxW.toLocaleString()} × {pxH.toLocaleString()}<small>PIXELS</small></strong><div>{settings.width} × {settings.height} in<span>{settings.dpi} DPI</span></div></div><div className="two-columns export-dimensions"><NumberField label="Print width" value={settings.width} onChange={v=>set('width',v)} min={1} max={40} step={.25} suffix="in"/><NumberField label="Print height" value={settings.height} onChange={v=>set('height',v)} min={1} max={40} step={.25} suffix="in"/></div><NumberField label="Export resolution" value={settings.dpi} onChange={v=>set('dpi',Math.round(v))} min={72} max={1200} suffix="DPI"/>{pxW*pxH>20e6&&<p className="inline-warning">This exceeds the 20 megapixel limit. Reduce size or DPI.</p>}<div className="export-options"><button disabled={!!exporting||!selected.length||pxW*pxH>20e6} onClick={()=>startExport('tiff')}><span className="file-type">TIF</span><span><strong>Composite TIFF</strong><small>Flattened RGB artwork · lossless · {settings.dpi} DPI</small></span><ArrowDownToLine size={18}/></button><button disabled={!!exporting||!selected.length||pxW*pxH>20e6} onClick={()=>startExport('package')}><span className="file-type">ZIP</span><span><strong>Print package + editable layers</strong><small>TIFF composite + {inks.length} screened plates + layered PSD + recipe</small></span><ArrowDownToLine size={18}/></button></div><p className="control-hint">Plates are black ink on white paper, aligned at identical dimensions. The PSD contains named transparent ink layers. Separations are creative, without ICC color management.</p>{exporting&&<div className="export-progress" role="status"><LoaderCircle className="spin" size={15}/>{exporting}<button onClick={cancelExport}>Cancel</button></div>}</Modal>}
    {modal==='help'&&<Modal title="A few ways to get lost" onClose={()=>setModal(null)}><ol className="guide"><li><strong>Collect your material.</strong> Select any number of images or drop in your own. Source slicing cuts each image into a reusable grid.</li><li><strong>Compose a new whole.</strong> Set output rows and columns, arrange fragments with noise, gradients, colors, and more. Mask and scale each cell.</li><li><strong>Follow a happy accident.</strong> Regenerate changes only the seed. Save a preset, then save new versions as the idea evolves.</li><li><strong>Make it physical.</strong> In Print, pick a halftone and ink palette. Isolate a plate using the colored dots below the artwork. Export TIFFs or the complete layered package.</li></ol><p className="control-hint">Everything stays in this browser. Back up presets to keep a portable copy, including your uploaded images.</p></Modal>}
  </div>;
}

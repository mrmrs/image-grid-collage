import type {Settings,SourceImage} from '../model';
import {Section,Slider,Select,Toggle,NumberField} from './Controls';
import {ZOOM_DISTRIBUTIONS,zoomLevelAt,zoomLevels} from '../engine/zoom';

type ControlsProps={settings:Settings;patch:(p:Partial<Settings>)=>void};
export function MultiscaleControls({settings:s,patch,images}:{images:SourceImage[]}&ControlsProps){
  const image=images.find(i=>i.id===s.multiscaleSource)??images[0];
  const levels=zoomLevels(s),paths=levels.map(()=> '');
  if(s.multiscale)for(let row=0;row<s.rows;row++)for(let col=0;col<s.columns;col++)paths[zoomLevelAt(s,row,col)]+= `M${col} ${row}h1v1h-1z`;
  const periodic=['spiral','tiled-spiral','rings'].includes(s.zoomDistribution);
  return <Section title="Cell zoom" defaultOpen={s.multiscale}>
    <Toggle label="Enable cell zoom" value={s.multiscale} onChange={multiscale=>patch({multiscale})}/>
    {s.multiscale&&<>
      <Select label="Zoom content" value={s.multiscaleMode} options={[["echo","Single image"],["fragments","Selected fragments"]]} onChange={multiscaleMode=>patch({multiscaleMode:multiscaleMode as Settings['multiscaleMode']})}/>
      {s.multiscaleMode==='echo'&&<><Select label="Zoom image" value={images.some(i=>i.id===s.multiscaleSource)?s.multiscaleSource:''} options={[["","First selected image"],...images.map(i=>[i.id,i.title] as const)]} onChange={multiscaleSource=>patch({multiscaleSource})}/>
      {image&&<div className="zoom-source"><img src={image.src} alt="Zoom source"/><span>{image.title}</span></div>}</>}
      <Slider label="Zoom levels" value={s.zoomLevels} onChange={zoomLevels=>patch({zoomLevels})} min={1} max={16}/>
      <div className="two-columns"><NumberField label="Min zoom" value={s.zoomMin} min={1} max={32} step={.25} suffix="×" onChange={zoomMin=>patch({zoomMin,zoomMax:Math.max(zoomMin,s.zoomMax)})}/><NumberField label="Max zoom" value={s.zoomMax} min={1} max={32} step={.25} suffix="×" onChange={zoomMax=>patch({zoomMax,zoomMin:Math.min(zoomMax,s.zoomMin)})}/></div>
      <Select label="Zoom distribution" value={s.zoomDistribution} options={ZOOM_DISTRIBUTIONS.map(d=>[d.id,d.label] as const)} onChange={zoomDistribution=>patch({zoomDistribution:zoomDistribution as Settings['zoomDistribution']})}/>
      {['spiral','tiled-spiral'].includes(s.zoomDistribution)&&<Slider label="Spiral turns" value={s.zoomTurns} onChange={zoomTurns=>patch({zoomTurns})} min={.25} max={6} step={.25}/>}
      {['tiled-spiral','rings','noise'].includes(s.zoomDistribution)&&<Slider label={s.zoomDistribution==='tiled-spiral'?'Modules per side':s.zoomDistribution==='rings'?'Ring repeats':'Zoom noise frequency'} value={s.zoomRepeats} onChange={zoomRepeats=>patch({zoomRepeats})} min={1} max={8}/>}
      {periodic&&<Slider label="Pattern phase" value={s.zoomPhase} onChange={zoomPhase=>patch({zoomPhase})} min={0} max={1} step={.01}/>}
      <Toggle label="Reverse zoom order" value={s.zoomReverse} onChange={zoomReverse=>patch({zoomReverse})}/>
      <figure className="zoom-map"><svg viewBox={`0 0 ${s.columns} ${s.rows}`} role="img" aria-label="Zoom placement map: lighter cells have more magnification" preserveAspectRatio="xMidYMid meet">{paths.map((d,i)=><path key={i} d={d} fill={`hsl(80 9% ${23+65*i/Math.max(1,levels.length-1)}%)`}/>)}</svg><figcaption>{levels.map((z,i)=><span key={i}>{Number(z.toFixed(2))}×</span>)}</figcaption></figure>
      <details className="zoom-focus"><summary>Crop focus</summary><Slider label="Focus X" value={s.zoomFocusX} onChange={zoomFocusX=>patch({zoomFocusX})} min={0} max={100} suffix="%"/><Slider label="Focus Y" value={s.zoomFocusY} onChange={zoomFocusY=>patch({zoomFocusY})} min={0} max={100} suffix="%"/></details>
      <p className="control-hint">1× fills the cell; higher levels crop closer. Levels are evenly spaced by ratio.{s.zoomLevels===1?' One level uses Min zoom.':''}{s.cellPins.length?' Pinned crops retain their zoom.':''}</p>
    </>}
  </Section>;
}
export function ContourControls({settings:s,patch,pinning,setPinning}:{pinning:boolean;setPinning:(v:boolean)=>void}&ControlsProps){
  return <div className="visual-subcontrols">
    <Slider label="Contour continuity" value={s.contourContinuity} onChange={contourContinuity=>patch({contourContinuity})} min={0} max={1} step={.01}/>
    <Slider label="Deliberate breaks" value={s.contourBreaks} onChange={contourBreaks=>patch({contourBreaks})} min={0} max={1} step={.01}/>
    <Slider label="Source diversity" value={s.contourDiversity} onChange={contourDiversity=>patch({contourDiversity})} min={0} max={1} step={.01}/>
    <Slider label="Crop freedom" value={s.contourCrop} onChange={contourCrop=>patch({contourCrop})} min={0} max={.5} step={.01}/>
    <Slider label="Alignment rotation" value={s.contourTurn} onChange={contourTurn=>patch({contourTurn})} min={0} max={20} suffix="°"/>
    <button className="wide-button" aria-pressed={pinning} onClick={()=>setPinning(!pinning)}>{pinning?'Finish pinning':'Pin fragments'}</button>
    {s.cellPins.length>0&&<button className="wide-button" onClick={()=>patch({cellPins:[]})}>Release {s.cellPins.length} pinned {s.cellPins.length===1?'fragment':'fragments'}</button>}
    <p className="control-hint">Connect edges between neighboring photographs. Square masks, small gaps, and low rotation keep the connections clear. Pinning holds a crop through new variations; changing grid dimensions releases pins.</p>
  </div>;
}
export function FlowControls({settings:s,patch}:ControlsProps){
  return <>
    <Select label="Screen structure" value={s.screenMode} onChange={screenMode=>patch({screenMode:screenMode as Settings['screenMode']})} options={[["regular","Regular screen"],["contour","Follow image contours"]]}/>
    {s.screenMode==='contour'&&<div className="visual-subcontrols">
      <Slider label="Contour following" value={s.flowStrength} onChange={flowStrength=>patch({flowStrength})} min={0} max={1} step={.01}/>
      <Slider label="Field smoothing" value={s.flowSmoothing} onChange={flowSmoothing=>patch({flowSmoothing})} min={.3} max={8} step={.1} suffix="%"/>
      {s.pattern!=='lines'&&<Slider label="Mark length" value={s.flowLength} onChange={flowLength=>patch({flowLength})} min={1} max={8} step={.1} suffix="×"/>}
      <Slider label="Direction difference between inks" value={s.flowDivergence} onChange={flowDivergence=>patch({flowDivergence})} min={0} max={1} step={.01}/>
      <Toggle label="Flow across cell boundaries" value={s.flowAcrossCells} onChange={flowAcrossCells=>patch({flowAcrossCells})}/>
      <p className="control-hint">Screens curve along light and dark boundaries. Lines create continuous engraving; other marks form elongated dashes. Local spacing varies with the image.</p>
    </div>}
  </>;
}

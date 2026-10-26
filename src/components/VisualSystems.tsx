import type {Settings,SourceImage} from '../model';
import {Section,Slider,Select,Toggle} from './Controls';

type ControlsProps={settings:Settings;patch:(p:Partial<Settings>)=>void};
export function MultiscaleControls({settings:s,patch,images}:{images:SourceImage[]}&ControlsProps){
  const image=images.find(i=>i.id===s.multiscaleSource)??images[0];
  return <Section title="Image at multiple scales" defaultOpen={s.multiscale}>
    <Toggle label="Enable multiple scales" value={s.multiscale} onChange={multiscale=>patch({multiscale})}/>
    {s.multiscale&&<>
      <Select label="Distance image" value={images.some(i=>i.id===s.multiscaleSource)?s.multiscaleSource:''} options={[["","First selected image"],...images.map(i=>[i.id,i.title] as const)]} onChange={multiscaleSource=>patch({multiscaleSource})}/>
      {image&&<div className="distance-source"><img src={image.src} alt="Image seen from a distance"/><span>{image.title}</span></div>}
      <Select label="Close-up content" value={s.multiscaleMode} options={[["echo","Same image at multiple zoom levels"],["fragments","Selected image fragments"]]} onChange={multiscaleMode=>patch({multiscaleMode:multiscaleMode as Settings['multiscaleMode']})}/>
      {s.multiscaleMode==='echo'&&<><Slider label="Zoom levels" value={s.echoLevels} onChange={echoLevels=>patch({echoLevels})} min={1} max={5}/><Slider label="Close-up magnification" value={s.echoZoom} onChange={echoZoom=>patch({echoZoom})} min={1} max={8} step={.1} suffix="×"/></>}
      <Slider label="Distance image strength" value={s.multiscaleStrength} onChange={multiscaleStrength=>patch({multiscaleStrength})} min={0} max={1} step={.01}/>
      <Slider label="Fine detail contrast" value={s.multiscaleDetail} onChange={multiscaleDetail=>patch({multiscaleDetail})} min={0} max={2} step={.01}/>
      <Slider label="Crossover scale" value={s.multiscaleCrossover} onChange={multiscaleCrossover=>patch({multiscaleCrossover})} min={.3} max={8} step={.1} suffix="%"/>
      <Slider label="Distance image crop" value={s.multiscaleZoom} onChange={multiscaleZoom=>patch({multiscaleZoom})} min={1} max={4} step={.05} suffix="×"/>
      <button className="wide-button" onClick={()=>patch({rows:14,columns:14,gap:0,margin:4,mask:'square',scale:1,scaleMode:'uniform',rotation:0,rotationJitter:0,flip:false,multiscaleStrength:1,multiscaleDetail:.65,multiscaleCrossover:1.6,cellPins:[]})}>Use a continuous 14 × 14 grid</button>
      <p className="control-hint">Near: photographic detail. Far: the whole image. Use the distance preview below the artwork. Smaller gaps and restrained detail make the distant image clearer.</p>
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

import { Slider as DialSlider, SelectControl as DialSelect, Toggle as DialToggle } from 'dialkit';
import { Play, Pause, RotateCcw, SkipForward, Pin, LoaderCircle } from 'lucide-react';
import type { Settings } from '../model';
import type { GridMotion } from '../motion/useGridMotion';
import { MOTION_PATTERNS, motionTiming } from '../motion/timing';
import { Section } from './Controls';
import 'dialkit/styles.css';

export function MotionPanel({settings:s,patch,motion,canPlay,onKeep}:{settings:Settings;patch:(p:Partial<Settings>)=>void;motion:GridMotion;canPlay:boolean;onKeep:()=>void}){
  const {state}=motion,loading=state.phase==='preparing',playing=state.phase==='playing';
  const timing=motionTiming(s);
  return <>
    <Section title="Movement studies"><div className="motion-patterns">{MOTION_PATTERNS.map(pattern=><button key={pattern.id} className={`motion-pattern ${s.motionPattern===pattern.id?'is-active':''}`} aria-pressed={s.motionPattern===pattern.id} aria-label={`${pattern.name} animation`} onClick={()=>patch({motionPattern:pattern.id})}><div className={`motion-miniature motion-miniature-${pattern.id}`} aria-hidden="true">{Array.from({length:16},(_,j)=><i key={j} style={{'--cell':j,'--row':Math.floor(j/4),'--column':j%4} as React.CSSProperties}/>)}</div><span><strong>{pattern.name}</strong><span>{pattern.description}</span></span></button>)}</div></Section>
    <Section title="Choreography"><div className="dialkit-root motion-dials" data-theme="light" data-mode="inline">
      <DialSelect label="Cell grouping" value={s.motionGrouping} options={[{value:'single',label:'One at a time'},{value:'grouped',label:'Small groups'},{value:'together',label:'All together'}]} onChange={v=>patch({motionGrouping:v as Settings['motionGrouping']})}/>
      {s.motionGrouping==='grouped'&&<><DialSlider label="Cells per group" value={s.motionGroupSize} min={2} max={64} step={1} onChange={v=>patch({motionGroupSize:v})}/><DialSlider label="Group overlap" value={s.motionOverlap} min={0} max={.9} step={.05} onChange={v=>patch({motionOverlap:v})}/></>}
      <DialSlider label="Cell duration" value={s.motionDuration} min={.15} max={3} step={.05} unit="s" onChange={v=>patch({motionDuration:v})}/>
      {['scatter','flip'].includes(s.motionPattern)&&<DialSlider label={s.motionPattern==='scatter'?'Zoom intensity':'Fold shading'} value={s.motionIntensity} min={0} max={1} step={.05} onChange={v=>patch({motionIntensity:v})}/>}
      <DialSlider label="Rest between variations" value={s.motionHold} min={0} max={8} step={.1} unit="s" onChange={v=>patch({motionHold:v})}/>
      <DialSelect label="Travel direction" value={s.motionDirection} options={[{value:'forward',label:'Forward'},{value:'reverse',label:'Reverse'}]} onChange={v=>patch({motionDirection:v as Settings['motionDirection']})}/>
      <DialToggle label="Keep evolving" checked={s.motionLoop} onChange={v=>patch({motionLoop:v})}/>
      <DialSlider label="Seed increment" value={s.motionSeedStep} min={1} max={10000} step={1} onChange={v=>patch({motionSeedStep:v})}/>
    </div><div className="motion-duration"><span>{timing.duration.toFixed(1)}s <small>per transition</small></span><span>{timing.groups} <small>{timing.groups===1?'group':'groups'}</small></span></div><p className="control-hint">One at a time completes each cell before the next. Group overlap lets successive groups move together. Fully ordered recipes may repeat the same content.</p></Section>
    <Section title="Playback"><div className="motion-playback"><button className="primary-button" disabled={!canPlay||loading} onClick={motion.toggle}>{loading?<LoaderCircle size={15} className="spin"/>:playing?<Pause size={15}/>:<Play size={15}/>} {loading?'Preparing variations':playing?'Pause animation':state.phase==='paused'?'Resume animation':'Play animation'}</button><button className="icon-button" disabled={!canPlay||loading} aria-label="Animate one variation" title="Animate one variation" onClick={motion.step}><SkipForward size={16}/></button><button className="icon-button" disabled={!canPlay} aria-label="Restart sequence" title="Restart sequence" onClick={motion.restart}><RotateCcw size={14}/></button></div>
      <div className="motion-seeds"><span>{state.visible?state.fromSeed:s.seed}</span><span>→</span><span>{state.visible?state.toSeed:(s.seed+s.motionSeedStep)%2147483648}</span><small>SEEDS</small></div>
      <button className="wide-button" disabled={!state.visible||loading} onClick={onKeep}><Pin size={13}/>Keep destination as still</button><p className="control-hint">Use Keep to make the destination seed your new composition, then save or export it. Motion timing is saved with every preset version. Print exports use the still composition.</p>
      {motion.reduced&&<p className="motion-accessibility">Reduced motion is on: playback uses a gentle dissolve.</p>}
    </Section>
  </>;
}

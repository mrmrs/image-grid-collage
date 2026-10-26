import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Settings, SourceImage } from '../model';
import { GridMotionPlayer, IDLE_MOTION } from './player';

export function useGridMotion(settings:Settings,sources:SourceImage[],solo:number,worker:RefObject<Worker|null>,onError:(message:string)=>void,active:boolean){
  const canvasRef=useRef<HTMLCanvasElement>(null),scrubRef=useRef<HTMLInputElement>(null),percentRef=useRef<HTMLSpanElement>(null);
  const playerRef=useRef<GridMotionPlayer|null>(null);
  // Playback intent survives recipe changes and temporary interruptions, but is not saved in presets.
  const autoplay=useRef(true);
  const [state,setState]=useState(IDLE_MOTION);
  const [hidden,setHidden]=useState(()=>document.hidden);
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const errorRef=useRef(onError);errorRef.current=onError;
  useEffect(()=>{
    const player=new GridMotionPlayer(canvasRef.current!,setState,p=>{
      if(scrubRef.current){scrubRef.current.value=String(p*100);scrubRef.current.style.setProperty('--fill',`${p*100}%`);}
      if(percentRef.current)percentRef.current.textContent=`${Math.round(p*100)}%`;
    },message=>{autoplay.current=false;errorRef.current(message);},()=>worker.current);
    playerRef.current=player;
    const query=matchMedia('(prefers-reduced-motion: reduce)');
    const preference=()=>{player.reduced=query.matches;setReduced(query.matches);};preference();
    const visibility=()=>{if(document.hidden)player.pause();setHidden(document.hidden);};
    query.addEventListener('change',preference);document.addEventListener('visibilitychange',visibility);
    return()=>{player.dispose();playerRef.current=null;query.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{
    const player=playerRef.current;
    if(!player)return;
    const changed=player.configure(settings,sources,solo);
    if(!active||!sources.length){player.stop();return;}
    if(hidden){player.pause();return;}
    if(!autoplay.current)return;
    // Coalesce slider edits before preparing new frames. Timing-only edits keep the cached frames.
    const timer=setTimeout(()=>{if(autoplay.current)void player.play();},changed?100:0);
    return()=>clearTimeout(timer);
  },[settings,sources,solo,active,hidden]);
  const pause=()=>{autoplay.current=false;playerRef.current?.pause();};
  return {state,canvasRef,scrubRef,percentRef,reduced,
    toggle:()=>{if(state.phase==='playing'||state.phase==='preparing')pause();else{autoplay.current=true;void playerRef.current?.play();}},
    step:()=>{autoplay.current=false;void playerRef.current?.play(true);},
    pause,stop:()=>{autoplay.current=false;playerRef.current?.stop();},restart:()=>{autoplay.current=true;playerRef.current?.restart();},
    seek:(p:number)=>{autoplay.current=false;playerRef.current?.seek(p);},targetSeed:()=>playerRef.current?.targetSeed()??settings.seed,
  };
}
export type GridMotion = ReturnType<typeof useGridMotion>;

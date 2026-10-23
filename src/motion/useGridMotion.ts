import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Settings, SourceImage } from '../model';
import { GridMotionPlayer, IDLE_MOTION } from './player';

export function useGridMotion(settings:Settings,sources:SourceImage[],solo:number,worker:RefObject<Worker|null>,onError:(message:string)=>void){
  const canvasRef=useRef<HTMLCanvasElement>(null),scrubRef=useRef<HTMLInputElement>(null),percentRef=useRef<HTMLSpanElement>(null);
  const playerRef=useRef<GridMotionPlayer|null>(null);
  const [state,setState]=useState(IDLE_MOTION);
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const errorRef=useRef(onError);errorRef.current=onError;
  useEffect(()=>{
    const player=new GridMotionPlayer(canvasRef.current!,setState,p=>{
      if(scrubRef.current){scrubRef.current.value=String(p*100);scrubRef.current.style.setProperty('--fill',`${p*100}%`);}
      if(percentRef.current)percentRef.current.textContent=`${Math.round(p*100)}%`;
    },message=>errorRef.current(message),()=>worker.current);
    playerRef.current=player;
    const query=matchMedia('(prefers-reduced-motion: reduce)');
    const preference=()=>{player.reduced=query.matches;setReduced(query.matches);};preference();
    const visibility=()=>{if(document.hidden)player.pause();};
    query.addEventListener('change',preference);document.addEventListener('visibilitychange',visibility);
    return()=>{player.dispose();playerRef.current=null;query.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{playerRef.current?.configure(settings,sources,solo);},[settings,sources,solo]);
  return {state,canvasRef,scrubRef,percentRef,reduced,
    toggle:()=>{if(state.phase==='playing'||state.phase==='preparing')playerRef.current?.pause();else void playerRef.current?.play();},
    step:()=>void playerRef.current?.play(true),
    pause:()=>playerRef.current?.pause(),stop:()=>playerRef.current?.stop(),restart:()=>playerRef.current?.restart(),
    seek:(p:number)=>playerRef.current?.seek(p),targetSeed:()=>playerRef.current?.targetSeed()??settings.seed,
  };
}
export type GridMotion = ReturnType<typeof useGridMotion>;

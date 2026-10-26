import type { Settings, SourceImage } from '../model';
import { artworkKey, cellSchedule, motionTiming, variationSeed } from './timing';
import { drawTransition } from './draw';

export type MotionPhase='idle'|'preparing'|'playing'|'paused';
export interface MotionState { phase:MotionPhase; visible:boolean; iteration:number; fromSeed:number; toSeed:number }
export const IDLE_MOTION:MotionState={phase:'idle',visible:false,iteration:0,fromSeed:0,toSeed:0};

interface RenderedFrame {
  bitmap:ImageBitmap;
  complement?:ImageBitmap;
  close:()=>void;
}

/** Owns exactly two rendered variations and shares the preview worker’s decoded image cache. Frame ticks never update React or persist settings. */
export class GridMotionPlayer {
  private settings!:Settings;
  private sources:SourceImage[]=[];
  private solo=-1;
  private key='';
  private worker?:Worker;
  private requestId=0;
  private generation=0;
  private pending=new Map<number,{resolve:(image:RenderedFrame)=>void;reject:(reason:Error)=>void}>();
  private from?:RenderedFrame;
  private to?:RenderedFrame;
  private starts:Float64Array=new Float64Array();
  private elapsed=0;
  private frame=0;
  private lastTime=0;
  private wantsPlay=false;
  private once=false;
  private disposed=false;
  private state:MotionState={...IDLE_MOTION};
  reduced=false;

  constructor(private canvas:HTMLCanvasElement,private onState:(state:MotionState)=>void,private onProgress:(progress:number)=>void,private onError:(message:string)=>void,private getWorker:()=>Worker|null,private getComplementCanvas:()=>HTMLCanvasElement|null=()=>null){}
  configure(s:Settings,sources:SourceImage[],solo:number){
    const key=artworkKey(s)+':'+solo+':'+s.motionSeedStep;
    const sourceChanged=sources.length!==this.sources.length||sources.some((source,i)=>source!==this.sources[i]);
    const oldDuration=this.settings?motionTiming(this.settings).duration:1;
    const fraction=this.elapsed/oldDuration;
    const changed=this.key!==key||sourceChanged;
    if(changed)this.stop();
    this.settings=s;this.sources=sources;this.solo=solo;this.key=key;
    if(this.from&&this.to){
      this.elapsed=fraction*motionTiming(s).duration;
      this.starts=cellSchedule(s,this.state.fromSeed);
      this.paint();
    }
    return changed;
  }
  private publish(patch:Partial<MotionState>){this.state={...this.state,...patch};if(!this.disposed)this.onState(this.state);}
  private render(seed:number):Promise<RenderedFrame>{
    const worker=this.getWorker();
    if(!worker)return Promise.reject(new Error('Preview worker is not ready.'));
    if(this.worker!==worker){
      this.worker?.removeEventListener('message',this.handleMessage);
      this.worker?.removeEventListener('error',this.handleError);
      this.worker=worker;
      worker.addEventListener('message',this.handleMessage);
      worker.addEventListener('error',this.handleError);
    }
    // Still previews use positive IDs; motion requests have their own negative namespace.
    const id=--this.requestId;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      // Resolution is bounded separately from print resolution; both frames use the exact same recipe pipeline.
      this.worker!.postMessage({id,mode:'preview',settings:{...this.settings,seed},sources:this.sources,solo:this.solo,previewWidth:Math.max(1,Math.min(1000,Math.round(1000*this.settings.width/this.settings.height)))});
    });
  }
  private handleMessage=(event:MessageEvent)=>{
    if(event.data.id>=0)return;
    const job=this.pending.get(event.data.id);
    if(!job){event.data.bitmap?.close();event.data.complement?.close();return;}
    this.pending.delete(event.data.id);
    if(event.data.error)job.reject(new Error(event.data.error));else {
      const {bitmap,complement}=event.data;
      job.resolve({bitmap,complement,close:()=>{bitmap.close();complement?.close();}});
    }
  };
  private handleError=(event:ErrorEvent)=>{
    for(const job of this.pending.values())job.reject(new Error(event.message||'Motion worker failed'));
    this.pending.clear();
  };
  async play(once=false){
    if(!this.settings||!this.sources.length||this.disposed)return;
    this.wantsPlay=true;this.once=once;
    if(this.state.phase==='preparing'||this.state.phase==='playing')return;
    if(this.from&&this.to){
      if(this.elapsed>=motionTiming(this.settings).duration){await this.advance();return;}
      this.publish({phase:'playing'});this.schedule();return;
    }
    const gen=this.generation;
    this.publish({phase:'preparing',fromSeed:this.settings.seed,toSeed:variationSeed(this.settings.seed,1,this.settings.motionSeedStep)});
    try{
      const from=await this.render(this.state.fromSeed);
      if(gen!==this.generation){from.close();return;}this.from=from;
      this.canvas.width=from.bitmap.width;this.canvas.height=from.bitmap.height;
      const complementCanvas=this.getComplementCanvas();
      if(complementCanvas&&from.complement){complementCanvas.width=from.complement.width;complementCanvas.height=from.complement.height;}
      const to=await this.render(this.state.toSeed);
      if(gen!==this.generation){to.close();return;}this.to=to;
      this.elapsed=0;this.starts=cellSchedule(this.settings,this.state.fromSeed);this.paint();
      this.publish({phase:this.wantsPlay?'playing':'paused',visible:true});
      if(this.wantsPlay)this.schedule();
    }catch(error){if(gen===this.generation)this.fail(error);}
  }
  private async advance(){
    if(!this.to)return;
    const gen=this.generation;
    this.from?.close();this.from=this.to;this.to=undefined;
    const seed=this.state.toSeed;
    this.publish({phase:'preparing',iteration:this.state.iteration+1,fromSeed:seed,toSeed:variationSeed(seed,1,this.settings.motionSeedStep)});
    // Keep the completed variation on screen while the next frame is prepared.
    try{
      const to=await this.render(this.state.toSeed);
      if(gen!==this.generation){to.close();return;}this.to=to;
      this.elapsed=0;this.starts=cellSchedule(this.settings,seed);this.paint();
      this.publish({phase:this.wantsPlay?'playing':'paused'});
      if(this.wantsPlay)this.schedule();
    }catch(error){if(gen===this.generation)this.fail(error);}
  }
  private fail(error:unknown){this.stop();this.onError(error instanceof Error?error.message:String(error));}
  private schedule(){cancelAnimationFrame(this.frame);this.lastTime=0;this.frame=requestAnimationFrame(this.tick);}
  private tick=(time:number)=>{
    if(!this.wantsPlay||!this.from||!this.to)return;
    if(this.lastTime)this.elapsed+=Math.min(.1,(time-this.lastTime)/1000);
    this.lastTime=time;this.paint();
    const duration=motionTiming(this.settings).duration;
    if(this.elapsed>=duration){
      if(this.once||!this.settings.motionLoop){this.pause();return;}
      if(this.elapsed>=duration+this.settings.motionHold){void this.advance();return;}
    }
    this.frame=requestAnimationFrame(this.tick);
  };
  private paint(){
    if(!this.from||!this.to)return;
    drawTransition(this.canvas,this.from.bitmap,this.to.bitmap,this.settings,this.starts,this.elapsed,this.reduced);
    const complementCanvas=this.getComplementCanvas();
    if(complementCanvas&&this.from.complement&&this.to.complement)drawTransition(complementCanvas,this.from.complement,this.to.complement,this.settings,this.starts,this.elapsed,this.reduced);
    this.onProgress(Math.min(1,this.elapsed/motionTiming(this.settings).duration));
  }
  pause(){
    this.wantsPlay=false;cancelAnimationFrame(this.frame);this.lastTime=0;
    if(this.state.phase==='playing')this.publish({phase:'paused'});
  }
  seek(progress:number){
    if(!this.from||!this.to)return;
    this.pause();this.elapsed=Math.max(0,Math.min(1,progress))*motionTiming(this.settings).duration;this.paint();
  }
  targetSeed(){return this.state.toSeed;}
  restart(){this.stop();void this.play();}
  stop(){
    this.generation++;this.wantsPlay=false;cancelAnimationFrame(this.frame);this.lastTime=0;this.elapsed=0;
    for(const job of this.pending.values())job.reject(new Error('Motion reset'));
    this.pending.clear();this.from?.close();this.to?.close();this.from=undefined;this.to=undefined;
    if(this.state.phase!=='idle'||this.state.visible)this.publish({...IDLE_MOTION});
    this.onProgress(0);
  }
  dispose(){this.disposed=true;this.stop();this.worker?.removeEventListener('message',this.handleMessage);this.worker?.removeEventListener('error',this.handleError);this.worker=undefined;}
}

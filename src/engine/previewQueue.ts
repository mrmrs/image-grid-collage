/** Keep one still preview in flight and replace queued work with the newest recipe. */
export class PreviewQueue<T extends {id:number}> {
  private running:number|null=null;
  private pending?:T;
  constructor(private send:(request:T)=>void){}
  submit(request:T){
    if(this.running!==null){this.pending=request;return;}
    this.running=request.id;this.send(request);
  }
  // A newer edit may be debouncing, or the source selection may now be empty.
  clearPending(){this.pending=undefined;}
  complete(id:number){
    if(id!==this.running)return;
    this.running=null;
    const next=this.pending;this.pending=undefined;
    if(next)this.submit(next);
  }
}

import {describe,it,expect} from 'vitest';
import {PreviewQueue} from '../src/engine/previewQueue';

describe('latest still preview scheduling',()=>{
  it('renders the first and newest request without queuing intermediate regenerations',()=>{
    const sent:number[]=[],queue=new PreviewQueue<{id:number}>(request=>sent.push(request.id));
    for(let id=1;id<=10;id++)queue.submit({id});
    expect(sent).toEqual([1]);queue.complete(1);expect(sent).toEqual([1,10]);
    queue.complete(10);queue.submit({id:11});expect(sent).toEqual([1,10,11]);
  });
  it('ignores motion responses and clears outdated work while newer edits debounce',()=>{
    const sent:number[]=[],queue=new PreviewQueue<{id:number}>(request=>sent.push(request.id));
    queue.submit({id:1});queue.submit({id:2});queue.complete(-1);expect(sent).toEqual([1]);
    queue.clearPending();queue.complete(1);expect(sent).toEqual([1]);
    queue.submit({id:3});queue.complete(1);queue.submit({id:4});expect(sent).toEqual([1,3]);
    queue.complete(3);expect(sent).toEqual([1,3,4]);
  });
});

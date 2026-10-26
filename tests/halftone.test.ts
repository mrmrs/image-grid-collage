import {afterAll,describe,it,expect,vi} from 'vitest';
import {DEFAULTS,cloneSettings} from '../src/model';
import type {Settings} from '../src/model';
import {separate,compositePlates} from '../src/engine/render';
import {buildFlowField,flowDisplacement} from '../src/engine/flow';
import {clamp,cmyk,rgb,screenThreshold} from '../src/engine/math';

vi.stubGlobal('ImageData',class {constructor(public data:Uint8ClampedArray,public width:number,public height:number){}});
afterAll(()=>vi.unstubAllGlobals());
const image={width:32,height:24,data:Uint8ClampedArray.from({length:32*24*4},(_,i)=>i%4===3?255:(i*73+Math.floor(i/17)*43)%256)} as ImageData;

// Straightforward reference implementation retained to guard the optimized pixel loop.
function reference(s:Settings){
 const inks=s.separation==='cmyk'?s.inks:s.spotInks,colors=inks.map(ink=>rgb(ink.color).map(v=>v/255));
 const plates=inks.map(ink=>({ink,coverage:new Uint8Array(image.width*image.height)}));
 const flow=s.screenMode==='contour'&&s.flowStrength>0?buildFlowField(image,s):null,spacing=image.width/(s.width*s.lpi);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const p=y*image.width+x,k=p*4,r=image.data[k]/255,g=image.data[k+1]/255,b=image.data[k+2]/255;
  const weights=colors.map(c=>1/(.015+(r-c[0])**2+(g-c[1])**2+(b-c[2])**2)),total=weights.reduce((a,b)=>a+b,0),darkness=1-(.2126*r+.7152*g+.0722*b);
  const tones=s.separation==='cmyk'?cmyk(r,g,b,s.blackGeneration):weights.map((w,i)=>clamp(w/total*darkness/Math.max(.15,1-(.2126*colors[i][0]+.7152*colors[i][1]+.0722*colors[i][2]))));
  const displacement=flow?flowDisplacement(flow,(x+.5)/image.width,(y+.5)/image.height,s):0;
  inks.forEach((ink,i)=>{
   const angle=ink.angle*(flow?s.flowDivergence:1)*Math.PI/180,cos=Math.cos(angle)/spacing,sin=Math.sin(angle)/spacing,raw=tones[i],tone=clamp((raw+s.gain*4*raw*(1-raw))*ink.density);
   plates[i].coverage[p]=tone>screenThreshold((x+.5)*cos+(y+.5)*sin+displacement,(-(x+.5)*sin+(y+.5)*cos)/(flow?s.flowLength:1),s.pattern)?255:0;
  });
 }
 return plates;
}
describe('halftone optimization preserves every pixel',()=>{
 for(const separation of ['cmyk','spot'] as const)for(const screenMode of ['regular','contour'] as const)for(const pattern of ['dots','lines','diamonds','squares'] as const){
  it(`${separation} / ${screenMode} / ${pattern}`,()=>{
   const s={...cloneSettings(DEFAULTS),separation,screenMode,pattern,width:3,height:2,gain:.17,blackGeneration:.63,flowAcrossCells:false};
   s.spotInks.push({name:'Pale',color:'#eeeac5',angle:123,density:.82,enabled:false},{name:'Purple',color:'#8636a7',angle:43,density:1.2,enabled:true});
   const expected=reference(s),actual=separate(image,s);expect(actual).toEqual(expected);
   for(const solo of [-1,0,2]){
    const pixels=new Uint8ClampedArray(image.data.length).fill(255);
    expected.forEach(({ink,coverage},i)=>{if(solo>=0?solo!==i:!ink.enabled)return;const color=solo>=0?[0,0,0]:rgb(ink.color);for(let p=0;p<coverage.length;p++)if(coverage[p])for(let c=0;c<3;c++)pixels[p*4+c]=Math.round(pixels[p*4+c]*color[c]/255);});
    expect(compositePlates(actual,image.width,image.height,solo).data).toEqual(pixels);
   }
  });
 }
});

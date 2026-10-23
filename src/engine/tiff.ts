/** Baseline TIFF 6.0: little endian, uncompressed, chunky RGB or grayscale, real inch resolution tags. */
export function encodeTiff(data: Uint8Array | Uint8ClampedArray, width: number, height: number, dpi: number, channels: 1 | 3 = 3): Uint8Array {
  if (data.length !== width*height*channels) throw new Error('TIFF pixel buffer size mismatch');
  const entries = 13, ifdSize = 2+entries*12+4, extras = 8+ifdSize;
  const bitsOffset = extras, xres = extras+8, yres = extras+16, pixels = extras+24;
  const bytes = new Uint8Array(pixels+data.length), v = new DataView(bytes.buffer);
  v.setUint16(0,0x4949,true); v.setUint16(2,42,true); v.setUint32(4,8,true); v.setUint16(8,entries,true);
  let at = 10;
  const tag = (id:number,type:number,count:number,value:number) => { v.setUint16(at,id,true); v.setUint16(at+2,type,true); v.setUint32(at+4,count,true); if(type===3 && count===1)v.setUint16(at+8,value,true);else v.setUint32(at+8,value,true); at+=12; };
  tag(256,4,1,width); tag(257,4,1,height); tag(258,3,channels,channels===1?8:bitsOffset);
  tag(259,3,1,1); tag(262,3,1,channels===1?1:2); tag(273,4,1,pixels); tag(277,3,1,channels);
  tag(278,4,1,height); tag(279,4,1,data.length); tag(282,5,1,xres); tag(283,5,1,yres); tag(284,3,1,1); tag(296,3,1,2);
  for(let i=0;i<3;i++)v.setUint16(bitsOffset+i*2,8,true);
  for(const offset of [xres,yres]) { v.setUint32(offset,Math.round(dpi*1000),true); v.setUint32(offset+4,1000,true); }
  bytes.set(data,pixels); return bytes;
}
export function rgbaToRgb(data: Uint8ClampedArray) {
  const out = new Uint8Array(data.length/4*3);
  for(let i=0,j=0;i<data.length;i+=4,j+=3) { out[j]=data[i];out[j+1]=data[i+1];out[j+2]=data[i+2]; }
  return out;
}

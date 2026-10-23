export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export function random(seed: number, index: number, channel = 0): number {
  let x = (seed ^ Math.imul(index + 1, 374761393) ^ Math.imul(channel + 1, 668265263)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => random(seed, a + b * 65537);
  return (h(ix,iy)*(1-u)+h(ix+1,iy)*u)*(1-v)+(h(ix,iy+1)*(1-u)+h(ix+1,iy+1)*u)*v;
}
export const rgb = (hex: string) => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
export function cmyk(r: number, g: number, b: number, black = 1) {
  const k = (1-Math.max(r,g,b)) * black, d = 1-k;
  return d < 1e-8 ? [0,0,0,1] : [(1-r-k)/d,(1-g-k)/d,(1-b-k)/d,k];
}
export function screenThreshold(x: number, y: number, pattern: string) {
  const u = Math.abs(x - Math.floor(x) - 0.5), v = Math.abs(y - Math.floor(y) - 0.5);
  if (pattern === 'lines') return u * 2;
  if (pattern === 'squares') return 4*Math.max(u,v)**2;
  if (pattern === 'diamonds') { const t = u+v; return t <= .5 ? 2*t*t : 1-2*(1-t)**2; }
  const r2 = u*u+v*v;
  if (r2 <= .25) return Math.PI*r2;
  const r = Math.sqrt(r2);
  return clamp(Math.PI*r2-4*(r2*Math.acos(.5/r)-.5*Math.sqrt(r2-.25)));
}

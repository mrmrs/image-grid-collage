import {describe,it,expect} from 'vitest';
import {DEFAULTS,cloneSettings,normalizeSettings} from '../src/model';
import {artworkKey,cellProgress,cellSchedule,ease,motionTiming,MOTION_PATTERNS,variationSeed} from '../src/motion/timing';

describe('motion choreography',()=>{
  it('one-at-a-time has no overlapping cells',()=>{
    const s={...cloneSettings(DEFAULTS),rows:8,columns:8,motionGrouping:'single' as const,motionDuration:.5};
    const starts=[...cellSchedule(s,s.seed)].sort((a,b)=>a-b);
    expect(starts).toEqual(Array.from({length:64},(_,i)=>i*.5));expect(motionTiming(s).duration).toBe(32);
    for(let t=.1;t<32;t+=.25)expect(starts.filter(start=>cellProgress(t,start,.5)>0&&cellProgress(t,start,.5)<1)).toHaveLength(1);
  });
  it('groups launch the requested batch size and finish every cell',()=>{
    const s={...cloneSettings(DEFAULTS),rows:3,columns:5,motionGroupSize:4,motionOverlap:.5,motionDuration:1};
    const starts=[...cellSchedule(s,42)].sort((a,b)=>a-b);
    expect(starts).toEqual([0,0,0,0,.5,.5,.5,.5,1,1,1,1,1.5,1.5,1.5]);
    expect(starts.every(start=>cellProgress(motionTiming(s).duration,start,1)===1)).toBe(true);
  });
  it('all together and a 1×1 grid have a single transition',()=>{
    const together={...DEFAULTS,motionGrouping:'together' as const};
    expect([...cellSchedule(together,7)].every(v=>v===0)).toBe(true);
    expect(motionTiming({...DEFAULTS,rows:1,columns:1}).duration).toBe(DEFAULTS.motionDuration);
  });
  it.each(MOTION_PATTERNS.map(p=>p.id))('%s ordering is deterministic, reversible and covers the grid',motionPattern=>{
    const s={...DEFAULTS,rows:8,columns:8,motionPattern,motionGrouping:'single' as const};
    const starts=cellSchedule(s,42),reverse=cellSchedule({...s,motionDirection:'reverse'},42);
    expect(starts).toEqual(cellSchedule(s,42));expect(new Set(starts).size).toBe(64);
    starts.forEach((v,i)=>expect(v+reverse[i]).toBeCloseTo(63*s.motionDuration));
  });
  it('scatter order varies with seed',()=>expect(cellSchedule({...DEFAULTS,motionPattern:'scatter'},1)).not.toEqual(cellSchedule({...DEFAULTS,motionPattern:'scatter'},2)));
  it('preserves exact endpoint progress and seed range',()=>{
    expect(ease(0)).toBe(0);expect(ease(1)).toBe(1);expect(cellProgress(-1,0,1)).toBe(0);expect(cellProgress(2,0,1)).toBe(1);
    expect(variationSeed(2147483647,1,1)).toBe(0);expect(variationSeed(42,5,11)).toBe(97);
  });
});
describe('motion persistence and preview invalidation',()=>{
  it('migrates old recipes and round trips all motion settings',()=>{
    const old=Object.fromEntries(Object.entries(DEFAULTS).filter(([key])=>!key.startsWith('motion')));
    expect(normalizeSettings(old)).toEqual(DEFAULTS);
    const custom={...DEFAULTS,motionPattern:'flip',motionGrouping:'single',motionLoop:false,motionSeedStep:27};
    expect(normalizeSettings(JSON.parse(JSON.stringify(custom)))).toEqual(custom);
    expect(()=>normalizeSettings({...DEFAULTS,motionDuration:NaN})).toThrow();
    expect(()=>normalizeSettings({...DEFAULTS,motionPattern:'invalid'})).toThrow();
    expect(normalizeSettings({motionGroupSize:8.6}).motionGroupSize).toBe(9);
  });
  it('motion and DPI adjustments skip expensive still rendering',()=>{
    expect(artworkKey(DEFAULTS)).toBe(artworkKey({...DEFAULTS,dpi:600,motionPattern:'scatter',motionDuration:2}));
    expect(artworkKey(DEFAULTS)).not.toBe(artworkKey({...DEFAULTS,seed:999}));
    expect(artworkKey(DEFAULTS)).not.toBe(artworkKey({...DEFAULTS,halftone:true}));
  });
});

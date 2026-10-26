import { get, set } from 'idb-keyval';
import type { Settings, SourceImage, Preset } from './model';
export interface Session { settings: Settings; uploads: SourceImage[]; presets: Preset[]; activePreset: string | null; activeRevision: string | null }
// Retain the original storage key so the Print Shop rename preserves saved sessions and presets.
const KEY='fieldwork.session.v1';
export const readSession=()=>get<Session>(KEY);
export const writeSession=(session:Session)=>set(KEY,session);
export function download(data: BlobPart, name: string, type: string) {
  const url=URL.createObjectURL(new Blob([data],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
export const fileDataUrl=(file:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error(`Could not read ${file.name}`));r.readAsDataURL(file);});

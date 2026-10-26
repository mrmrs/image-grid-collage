/** Re-download the bundled Unsplash image library. Node 20+; no API key needed. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = JSON.parse(await readFile(path.join(root, 'public/image-library.json'), 'utf8'));
await mkdir(path.join(root, 'public/images'), { recursive: true });
for (const [index, image] of library.entries()) {
  const response = await fetch(image.downloadUrl);
  if (!response.ok) throw new Error(`${image.id}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`${image.id}: response is not a JPEG`);
  const output = path.join(root, 'public', image.src.replace(/^\//, ''));
  await writeFile(output, bytes);
  if(image.thumbnailUrl){
    const thumbnail=await fetch(image.thumbnailUrl);
    if(!thumbnail.ok)throw new Error(`${image.id} thumbnail: HTTP ${thumbnail.status}`);
    const target=path.join(root,'public',image.thumbnail.replace(/^\//,''));
    await mkdir(path.dirname(target),{recursive:true});await writeFile(target,Buffer.from(await thumbnail.arrayBuffer()));
  }
  console.log(`${index + 1}/${library.length} ${image.title} — ${image.author}`);
}

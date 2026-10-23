# Fieldwork

A local generative image and print studio. React + TypeScript + Vite, with Canvas rendering in web workers. Images, fonts, and application code are local; no accounts or API keys are needed.

[Open the app](https://image-grid-collage.adam-f8f.workers.dev) · [GitHub repository](https://github.com/mrmrs/image-grid-collage)

## Run

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173). Use a recent Chrome, Edge, Firefox, or Safari with OffscreenCanvas support. Keep using the same origin/port to access your browser's saved presets.

```sh
npm run build  # type-check and production build
npm test       # engine, screen coverage, recipe validation, independent TIFF decoding
npm run preview
```

`npm run test:browser` exercises the live UI, preset restoration, responsive layout, and downloads using installed Google Chrome. `npm run test:workflow` also checks every distribution and mask, uploads, backups, imports, custom inks, and full 3000 × 3000 TIFF/PSD decoding. Start the development server on port 5173 first. `npm run test:motion` checks animation endpoints, caching, looping, controls, persistence, exports, and reduced motion in Chrome. Test artifacts are saved under the system temporary directory.

## Hosting on Cloudflare

The repository is hosted at [mrmrs/image-grid-collage](https://github.com/mrmrs/image-grid-collage). The app deploys to **Cloudflare Workers Static Assets** as `image-grid-collage`; `wrangler.jsonc` serves the Vite `dist/` output with SPA navigation handling. No server code, database, or application secrets are needed.

Use Node 24 (see `.node-version`) and the repository's pinned Wrangler installation:

```sh
npm ci
npx wrangler login      # only when this machine is not already authenticated
npm run deploy:check   # build and validate without publishing
npm run deploy         # build and publish
```

Wrangler prints the public `workers.dev` URL after deployment. The developer's Cloudflare login is stored outside this repository. `.gitignore` excludes Wrangler state, environment files, local secrets, dependencies, and generated output; bundled test images and their credits are tracked.

Check the published UI, preset persistence, print export, and mobile layout with `APP_URL=https://image-grid-collage.adam-f8f.workers.dev npm run test:browser`.

### Automatic deployment from GitHub

The CLI deployment works independently of GitHub integration. To enable deployment on future pushes, connect the existing Worker once in Cloudflare:

1. Open **Workers & Pages → image-grid-collage → Settings → Builds → Connect**.
2. Connect GitHub and grant the Cloudflare GitHub app access to **mrmrs/image-grid-collage**, if prompted.
3. Select production branch **main** and repository root **/**.
4. Set build command **npm run build** and deploy command **npx wrangler deploy**. Use Node 24 if choosing a build-image version.
5. Save. Future pushes to `main` can build and deploy automatically.

The Worker name in the dashboard must match `image-grid-collage` in `wrangler.jsonc`. See [Cloudflare's existing-Worker Git integration instructions](https://developers.cloudflare.com/workers/ci-cd/builds/#connect-an-existing-worker).

Hosting shares the application and bundled image library. Uploaded images and presets remain in each visitor's browser; they are not uploaded to Cloudflare or synchronized between people. The hosted URL has separate browser storage from localhost. Use **Presets → Backup / Import** to move existing work or share recipes and images.

## Compose

- Select any number of the 25 local Unsplash photographs, or upload/drop JPEG, PNG, WebP, AVIF, or GIF images. Animated files use a still frame. Credits are linked beneath each thumbnail and in [SOURCES.md](SOURCES.md).
- **Source slicing**, beneath the image library, controls how many rows/columns each source image is cut into. This is independent of the output grid. Fragments cover their cells without distortion.
- Configure output rows/columns, cell gaps, paper margin/color, and image adjustments.
- Nine arrangements: random, linear gradient, radial gradient, smooth noise, color selection, luminance, checkerboard, stripes, and sequential. Color and luminance modes choose fragments by their sampled colors; other modes choose images first, then their fragments. Source ordering follows library order.
- Seven mask choices: square, circle, diamond, triangle, hexagon, arch, or a deterministic mixture.
- Scale cells uniformly, randomly, with coherent noise, or with a gradient. Add rotation, random rotation, and mirroring. Scale above 1 and rotation intentionally permit overlapping cells.
- The **seed** controls all randomness. Regenerate changes only the seed. Rendering is deterministic for the same recipe and source images (minor rasterization differences between browsers are possible).

## Presets and backups

The working session autosaves to IndexedDB after a short debounce; wait for **Saved locally** before closing/reloading. Presets contain immutable revisions of all composition/print settings, source IDs, and seed. Restoring a version does not overwrite it; **Save version** appends a revision, and **Save as new preset** branches into a separate preset.

Five starting points are included. **Presets → Backup** exports the current settings, every preset/revision, and uploaded images to JSON. Import merges presets and uploads and loads the supplied working settings. The 25 bundled source images are referenced by stable IDs. Backups are portable between copies of this project. Browser storage is local to the origin and can be cleared by the browser, so keep JSON backups of work you want to retain.

## Motion

Open **Motion** or press the play button beneath the artwork. Five movement studies transition the grid between deterministic seed variations of the current recipe:

- **Silk wave:** diagonal ordering with a horizontal curtain reveal in each cell.
- **Bloom:** circular reveals moving outward from the center.
- **Fireflies:** a seeded scatter of gentle zoom dissolves.
- **Turn the tiles:** alternating horizontal and vertical folds, ordered by checkerboard parity.
- **Tidal rows:** slides that alternate direction between rows.

The motion controls use **DialKit 2**, embedded as controlled React components. Choose **One at a time**, **Small groups**, or **All together**. Adjust cells per group, overlap, cell duration, rest, direction, seed increment, and continuous playback. Fireflies and Turn the tiles also offer zoom intensity and fold shading controls. The displayed transition length includes all staggered groups; one-at-a-time enforces zero overlap. Large grids with sequential playback can take a long time by design.

Pause/resume or scrub the progress bar to inspect any moment. **Animate one variation** finishes one transition and pauses. **Restart sequence** starts again at the recipe's seed. **Stop** returns to the still composition. **Keep destination as still** adopts the destination seed—even when paused midway—so it can be saved as a preset version or exported at print resolution. Opening Export returns to the still; it does not export an intermediate animation frame.

Motion settings travel with preset versions and JSON backups. Existing recipes receive defaults. Playback itself is temporary and never starts automatically on reload. Changes to source images, grid geometry, print appearance, seed increment, or the isolated plate stop/reset the animation. Timing and pattern edits reuse the prepared frames. Hidden tabs pause automatically; reduced-motion preferences replace the movement with a gentle full-frame dissolve.

Variation changes only the seed, so source selection, grid size, masks, distribution, and ink setup stay within the recipe. Fully deterministic arrangements without seed-dependent choices can repeat the same content. Transitions operate on rendered grid regions; shapes and halftones are preserved in each endpoint, while overlapping artwork inside the paper margins dissolves between endpoints.

Playback shares the still-preview worker and decoded image cache. It retains two preview bitmaps and composites them on Canvas with requestAnimationFrame; no per-frame halftoning, React state updates, or autosaves. DialKit is loaded when the Motion panel is first opened. Its external font import is removed by the build, so the app remains local.

## Halftones and separated layers

The **Print** tab offers round dots, lines, diamonds, and square screens. Frequency is specified in **lines per inch (LPI)**, separately from raster **DPI**. Screen geometry uses physical print width, so preview and export depict the same screen, although the reduced preview can alias fine patterns.

- **CMYK:** mathematical process-color separation with adjustable black generation. Ink colors affect proof appearance; they do not change the CMYK decomposition.
- **Custom ink palette:** one to six colors with soft color-distance assignment and luminance-based coverage. This is a creative spot-color approximation, not a calibrated spot-color matching system.
- Each ink has a name, color, screen angle, density, and visibility. Click a plate's color below the artboard or use **Isolate plate** to see it in black and white.
- Dot gain adjusts intermediate coverage. Plates use a binary screen (black or white) stored in an 8-bit grayscale TIFF for broad compatibility.
- Hidden inks are omitted from the composite but retained as hidden PSD layers and included in the TIFF plate package.

## Print export

Default: **10 × 10 inches at 300 DPI**, producing **3000 × 3000 pixels**. Width, height, and DPI are configurable. Export is currently capped at **20 megapixels** and 12,000 pixels per side to bound worker memory use. Exports are cancellable and run separately from the preview.

**Composite TIFF** exports an uncompressed, lossless, 8-bit RGB TIFF with real XResolution/YResolution rational tags and ResolutionUnit = inch. It exports the complete visible composition even while you are inspecting an isolated plate.

**Print package** is a ZIP containing:

- `composite.tif`: RGB composition, with or without halftoning according to the current toggle.
- `plates/01-*.tif`, etc.: aligned grayscale, screened TIFFs, one per ink; black means ink, white means no ink. All plates have identical dimensions and DPI. Plates are always halftoned, even when the composite halftone toggle is off.
- `layers.psd`: named transparent ink layers using Multiply blending, above white Paper. This is the editable layered file; TIFFs themselves are flattened. Its merged preview is the halftoned composite and its resolution is embedded.
- `recipe.json`: settings and source metadata. For portable copies of uploaded image data and all preset history, also use **Presets → Backup**.
- `README.txt`: dimensions and plate conventions.

The composite is an RGB proof, not a CMYK TIFF. There is no embedded ICC profile or press-specific ink compensation. Source slices may be upscaled at large print sizes; DPI metadata does not invent source detail. The bundled 2322–2400 px images are test material. Use high-resolution originals and printer-specific proofing for final production.

## Where to iterate

- `src/model.ts`: settings schema, bounds, defaults, and starter recipes.
- `src/engine/math.ts`: seeded randomness, continuous noise, CMYK math, and area-normalized screen shapes.
- `src/engine/render.ts`: source slicing, fragment selection, masks, composition, separation, and proof layers.
- `src/engine/worker.ts`: shared preview/export pipeline, TIFF plates, layered PSD, ZIP packaging.
- `src/engine/tiff.ts`: baseline TIFF encoder.
- `src/App.tsx` and `src/components/Controls.tsx`: controlled editor UI and version history.
- `src/storage.ts`: IndexedDB session persistence and downloads.
- `src/motion/`: seeded choreography, cached-frame compositor, playback lifecycle, and React integration.
- `src/components/MotionPanel.tsx`: pattern studies and embedded DialKit controls.

To add a distribution, extend the schema and `chooseTile`, then add it to the Arrange by selector. To add a mask, extend `maskPath`. To add a halftone, extend `screenThreshold` and add an area-coverage test. Keep sampling decisions independent of output pixel size so exports match previews.

Compose and Print use custom controls; Motion uses DialKit’s Slider, SelectControl, and Toggle. All controls write to the same serializable settings and immutable preset history. The render and animation engines are independent of React.

## Asset credits

Photography: [SOURCES.md](SOURCES.md), under the Unsplash license. Run `node scripts/download-images.mjs` to redownload the checked sources. Fonts: DM Sans and Space Grotesk, bundled under the SIL Open Font License; license texts are in `public/fonts/`.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PROJECT = 'C:\\Users\\helio\\.gemini\\antigravity\\scratch\\farol-que-esquece';
const DIST = path.join(PROJECT, 'dist');
const BRAIN = 'C:\\Users\\helio\\.gemini\\antigravity\\brain\\8986ad69-58a7-42c0-bd75-ba7b3a7dfad1';

async function buildBundle() {
  // 1. Read built JS and CSS
  const distAssetsDir = path.join(DIST, 'assets');
  const files = fs.readdirSync(distAssetsDir);
  const jsFile = files.find((f) => f.endsWith('.js'));
  const cssFile = files.find((f) => f.endsWith('.css'));

  let jsCode = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf-8');
  let cssCode = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf-8');

  // Remove external @font-face url(...) references from CSS so it works 100% standalone without external font requests
  cssCode = cssCode.replace(/@font-face\{[^}]+\}/g, '');

  // 2. Compress and encode all images in public/assets/{bg,cg,sprites} as data URIs
  const assetFolders = ['bg', 'cg', 'sprites'];
  const dataUriMap = {};

  for (const folder of assetFolders) {
    const dirPath = path.join(PROJECT, 'public', 'assets', folder);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.webp')) continue;
      const relKey = `./assets/${folder}/${file}`;
      const fullPath = path.join(dirPath, file);
      const isSprite = folder === 'sprites';
      const buf = await sharp(fullPath)
        .resize(isSprite ? { height: 720, withoutEnlargement: true } : { width: 1280, height: 720, fit: 'cover' })
        .webp({ quality: isSprite ? 80 : 76 })
        .toBuffer();
      dataUriMap[relKey] = `data:image/webp;base64,${buf.toString('base64')}`;
    }
  }

  // Replace all `./assets/...` strings in JS code with their inline base64 data URIs
  for (const [relKey, uri] of Object.entries(dataUriMap)) {
    jsCode = jsCode.split(relKey).join(uri);
  }

  // Also add dynamic lookup for sprite paths `./assets/sprites/${charId}_${info.expr}.webp`
  const lookupScript = `window.__ASSET_MAP__ = ${JSON.stringify(dataUriMap)};`;
  jsCode = jsCode.replace(
    '`./assets/sprites/${',
    '(window.__ASSET_MAP__[`./assets/sprites/${'
  );
  // Let's do a clean replacement of the sprite src assignment in source or in bundle:
  const html = `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>O Farol que Esquece — Jogar</title>
    <style>${cssCode}</style>
  </head>
  <body>
    <div id="app" aria-label="O Farol que Esquece"></div>
    <script>${lookupScript}</script>
    <script type="module">${jsCode}</script>
  </body>
</html>`;

  const outProject = path.join(PROJECT, 'jogar-o-farol-que-esquece.html');
  const outBrain = path.join(BRAIN, 'o-farol-que-esquece.html');
  fs.writeFileSync(outProject, html, 'utf-8');
  fs.writeFileSync(outBrain, html, 'utf-8');
  console.log('Standalone HTML written:', outBrain, (html.length / 1024).toFixed(1), 'KB');
}

buildBundle().catch((e) => {
  console.error(e);
  process.exit(1);
});

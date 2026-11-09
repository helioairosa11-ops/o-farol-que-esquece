import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BRAIN_DIR = 'C:\\Users\\helio\\.gemini\\antigravity\\brain\\8986ad69-58a7-42c0-bd75-ba7b3a7dfad1';
const OUT_BASE = 'C:\\Users\\helio\\.gemini\\antigravity\\scratch\\farol-que-esquece\\public\\assets';

fs.mkdirSync(path.join(OUT_BASE, 'bg'), { recursive: true });
fs.mkdirSync(path.join(OUT_BASE, 'cg'), { recursive: true });
fs.mkdirSync(path.join(OUT_BASE, 'sprites'), { recursive: true });

const BG_MAP = [
  { prefix: 'title_farol_png', out: 'bg/title_farol.webp' },
  { prefix: 'bg_comboio_png', out: 'bg/bg_comboio.webp' },
  { prefix: 'bg_estacao_png', out: 'bg/bg_estacao.webp' },
  { prefix: 'bg_rua_nevoa_png', out: 'bg/bg_rua_nevoa.webp' },
  { prefix: 'bg_cozinha_farol_png', out: 'bg/bg_cozinha_farol.webp' },
  { prefix: 'bg_quarto_infancia_png', out: 'bg/bg_quarto_infancia.webp' },
  { prefix: 'cap_prologo_png', out: 'bg/cap_prologo.webp' },
  { prefix: 'cg_primeiro_farol_png', out: 'cg/cg_primeiro_farol.webp' },
];

const SPRITE_MAP = [
  { prefix: 'celeste_neutra_png', out: 'sprites/celeste_neutra.webp' },
  { prefix: 'celeste_sorriso_png', out: 'sprites/celeste_sorriso.webp' },
  { prefix: 'celeste_triste_png', out: 'sprites/celeste_triste.webp' },
  { prefix: 'celeste_seria_png', out: 'sprites/celeste_seria.webp' },
];

function findFile(prefix) {
  const files = fs.readdirSync(BRAIN_DIR);
  const match = files.find((f) => f.startsWith(prefix));
  return match ? path.join(BRAIN_DIR, match) : null;
}

async function processBackground(src, dest) {
  await sharp(src)
    .resize(1920, 1080, { fit: 'cover' })
    .webp({ quality: 84 })
    .toFile(dest);
  console.log('Processed BG/CG:', dest);
}

async function removeWhiteBgAndSave(src, dest, transformFn = null) {
  let pipeline = sharp(src).resize({ height: 1200, withoutEnlargement: true }).ensureAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Flood fill from edges for white/near-white background removal
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function isBg(idx) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return r > 225 && g > 222 && b > 218 && (max - min) < 28;
  }

  function push(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const idx = p * channels;
    if (isBg(idx)) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  }

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Apply alpha=0 to visited, and feather 1px border
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const idx = p * channels;
      if (visited[p]) {
        data[idx + 3] = 0;
      } else {
        // Check neighbors for feathering
        let bgNeighbors = 0;
        if (x > 0 && visited[p - 1]) bgNeighbors++;
        if (x < width - 1 && visited[p + 1]) bgNeighbors++;
        if (y > 0 && visited[p - width]) bgNeighbors++;
        if (y < height - 1 && visited[p + width]) bgNeighbors++;
        if (bgNeighbors > 0) {
          data[idx + 3] = Math.round(255 * (1 - bgNeighbors * 0.2));
        }
      }
    }
  }

  if (transformFn) {
    transformFn(data, width, height, channels);
  }

  await sharp(data, { raw: { width, height, channels } })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(dest);
  console.log('Processed Sprite:', dest);
}

async function run() {
  for (const item of BG_MAP) {
    const src = findFile(item.prefix);
    if (src) {
      await processBackground(src, path.join(OUT_BASE, item.out));
    } else {
      console.warn('Missing:', item.prefix);
    }
  }

  for (const item of SPRITE_MAP) {
    const src = findFile(item.prefix);
    if (src) {
      await removeWhiteBgAndSave(src, path.join(OUT_BASE, item.out));
    }
  }

  // Create celeste_evasiva and celeste_surpresa from celeste_triste / celeste_neutra so all 6 expressions exist cleanly
  const tristeSrc = findFile('celeste_triste_png');
  const neutraSrc = findFile('celeste_neutra_png');
  if (tristeSrc) {
    await removeWhiteBgAndSave(tristeSrc, path.join(OUT_BASE, 'sprites/celeste_evasiva.webp'));
  }
  if (neutraSrc) {
    await removeWhiteBgAndSave(neutraSrc, path.join(OUT_BASE, 'sprites/celeste_surpresa.webp'));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

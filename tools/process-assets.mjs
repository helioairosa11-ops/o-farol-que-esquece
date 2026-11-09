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

/**
 * Crops away the 6% watercolor paper margin so every painting fills 100% of the 1920x1080 canvas edge-to-edge!
 */
async function processBackground(src, dest) {
  const meta = await sharp(src).metadata();
  const w = meta.width || 1920;
  const h = meta.height || 1080;
  const cropX = Math.round(w * 0.055);
  const cropY = Math.round(h * 0.065);
  const cropW = w - cropX * 2;
  const cropH = h - cropY * 2;

  await sharp(src)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize(1920, 1080, { fit: 'cover' })
    .webp({ quality: 88 })
    .toFile(dest);
  console.log('Processed cropped Full-Bleed BG/CG:', dest);
}

async function removeWhiteBgAndSave(src, dest) {
  const pipeline = sharp(src).resize({ height: 1100, withoutEnlargement: true }).ensureAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

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

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const idx = p * channels;
      if (visited[p]) {
        data[idx + 3] = 0;
      } else {
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

  await sharp(data, { raw: { width, height, channels } })
    .webp({ quality: 88, alphaQuality: 92 })
    .toFile(dest);
  console.log('Processed Sprite:', dest);
}

/**
 * Generates high-art gouache + ink SVG character portraits and converts them to 900x1200 transparent WebP sprites
 * for Inês (4 expressions), Chefe Joaquim (2 expressions), and Mara (1 silhouette/expression).
 */
async function buildCharacterGouacheSvgSprites() {
  const inesVariants = [
    { expr: 'neutra', mouth: 'M 438 386 Q 450 388 462 385', browL: 'M 402 302 Q 418 296 432 300', browR: 'M 468 300 Q 482 296 498 302', eyeOffset: 0 },
    { expr: 'ironica', mouth: 'M 436 387 Q 454 390 468 380', browL: 'M 402 304 Q 418 300 432 302', browR: 'M 468 295 Q 484 287 500 296', eyeOffset: 2 },
    { expr: 'triste', mouth: 'M 436 392 Q 450 383 464 392', browL: 'M 402 306 Q 418 296 432 294', browR: 'M 468 294 Q 482 296 498 306', eyeOffset: 1 },
    { expr: 'surpresa', mouth: 'M 443 386 A 8 9 0 1 0 457 386 A 8 9 0 1 0 443 386', browL: 'M 400 292 Q 418 282 433 290', browR: 'M 467 290 Q 482 282 500 292', eyeOffset: -1 },
  ];

  for (const v of inesVariants) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <defs>
        <radialGradient id="skin" cx="48%" cy="32%" r="55%">
          <stop offset="0%" stop-color="#f0dccb"/>
          <stop offset="68%" stop-color="#dfbfa6"/>
          <stop offset="100%" stop-color="#c39d82"/>
        </radialGradient>
        <linearGradient id="coat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1d2d3e"/>
          <stop offset="55%" stop-color="#152230"/>
          <stop offset="100%" stop-color="#0d1620"/>
        </linearGradient>
        <linearGradient id="scarf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#d89e3a"/>
          <stop offset="100%" stop-color="#a8701d"/>
        </linearGradient>
        <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2c221e"/>
          <stop offset="50%" stop-color="#1e1714"/>
          <stop offset="100%" stop-color="#140f0d"/>
        </linearGradient>
      </defs>

      <!-- Back Hair Silhouette -->
      <path d="M 340 245 C 310 320 302 430 315 510 C 335 525 565 525 585 510 C 598 430 590 320 560 245 Z"
            fill="url(#hair)" stroke="#110d0b" stroke-width="5" stroke-linejoin="round"/>

      <!-- Navy Wool Coat Body -->
      <path d="M 245 555 C 268 495 335 468 380 460 L 520 460 C 565 468 632 495 655 555 L 705 1195 L 195 1195 Z"
            fill="url(#coat)" stroke="#0d131a" stroke-width="6" stroke-linejoin="round"/>

      <!-- Coat Lapels & Ink Texture -->
      <path d="M 365 475 L 330 695 L 415 735 L 448 560" fill="#182636" stroke="#0b1118" stroke-width="4.5"/>
      <path d="M 535 475 L 570 695 L 485 735 L 452 560" fill="#182636" stroke="#0b1118" stroke-width="4.5"/>
      <path d="M 310 610 L 290 1180 M 590 610 L 610 1180" stroke="#0b1118" stroke-width="4" opacity="0.7"/>

      <!-- Grey Knit Sweater Underneath -->
      <path d="M 395 480 L 450 675 L 505 480 Z" fill="#6d767e" stroke="#22282e" stroke-width="4"/>

      <!-- Neck -->
      <path d="M 416 405 L 414 485 Q 450 505 486 485 L 484 405 Z" fill="url(#skin)" stroke="#231915" stroke-width="4.5"/>
      <path d="M 422 425 Q 450 442 478 422" fill="none" stroke="#b38c72" stroke-width="3" opacity="0.6"/>

      <!-- Mustard Scarf Wrapped Around Neck -->
      <path d="M 358 452 C 390 432 510 432 542 452 C 556 485 544 525 518 538 C 470 555 430 555 382 538 C 356 525 344 485 358 452 Z"
            fill="url(#scarf)" stroke="#1b140c" stroke-width="5"/>
      <path d="M 465 522 L 492 785 L 555 770 L 532 515 Z"
            fill="url(#scarf)" stroke="#1b140c" stroke-width="5"/>
      <path d="M 380 488 Q 450 512 520 488" fill="none" stroke="#855512" stroke-width="4"/>

      <!-- Head & Face -->
      <path d="M 374 265 C 372 345 392 402 450 416 C 508 402 528 345 526 265 C 524 205 492 178 450 178 C 408 178 376 205 374 265 Z"
            fill="url(#skin)" stroke="#1f1612" stroke-width="5"/>

      <!-- Subtle Gouache Cheek Blush & Shading -->
      <ellipse cx="406" cy="348" rx="22" ry="12" fill="#d49b84" opacity="0.45"/>
      <ellipse cx="494" cy="348" rx="22" ry="12" fill="#d49b84" opacity="0.45"/>

      <!-- Eyebrows -->
      <path d="${v.browL}" fill="none" stroke="#241a16" stroke-width="5" stroke-linecap="round"/>
      <path d="${v.browR}" fill="none" stroke="#241a16" stroke-width="5" stroke-linecap="round"/>

      <!-- Eyes -->
      <g transform="translate(0, ${v.eyeOffset})">
        <path d="M 402 320 Q 418 309 434 320 Q 418 329 402 320 Z" fill="#f7f3ed" stroke="#1b1310" stroke-width="3.5"/>
        <circle cx="418" cy="319" r="7.5" fill="#3a261c"/>
        <circle cx="418" cy="319" r="3.5" fill="#120c09"/>
        <circle cx="415" cy="316" r="2.2" fill="#ffffff"/>

        <path d="M 466 320 Q 482 309 498 320 Q 482 329 466 320 Z" fill="#f7f3ed" stroke="#1b1310" stroke-width="3.5"/>
        <circle cx="482" cy="319" r="7.5" fill="#3a261c"/>
        <circle cx="482" cy="319" r="3.5" fill="#120c09"/>
        <circle cx="479" cy="316" r="2.2" fill="#ffffff"/>
      </g>

      <!-- Tired Undereye Lines (Translator detail) -->
      <path d="M 405 331 Q 418 336 431 330" fill="none" stroke="#b58d75" stroke-width="2.2"/>
      <path d="M 469 330 Q 482 336 495 331" fill="none" stroke="#b58d75" stroke-width="2.2"/>

      <!-- Nose -->
      <path d="M 448 318 L 444 356 Q 450 362 458 357" fill="none" stroke="#261b16" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Mouth -->
      <path d="${v.mouth}" fill="none" stroke="#6e3b32" stroke-width="4.5" stroke-linecap="round"/>

      <!-- Front Wavy Hair Strands Framing Face -->
      <path d="M 450 172 C 385 168 345 215 342 295 C 340 365 352 435 372 485 C 378 420 374 340 385 275 C 398 235 426 212 452 208 C 482 214 505 242 516 285 C 526 345 522 425 528 485 C 548 435 560 365 558 295 C 555 215 515 168 450 172 Z"
            fill="url(#hair)" stroke="#110d0b" stroke-width="4.5" stroke-linejoin="round"/>

      <!-- Black Notebook Held Near Chest -->
      <path d="M 350 755 L 470 725 L 490 925 L 370 955 Z" fill="#1a1918" stroke="#090909" stroke-width="5"/>
      <path d="M 358 753 L 474 724 L 478 734 L 362 763 Z" fill="#e8dfd1"/>
      <line x1="448" y1="730" x2="468" y2="930" stroke="#c9963b" stroke-width="4"/>

      <!-- Hand Holding Notebook -->
      <path d="M 435 835 C 455 820 495 825 508 845 C 516 868 498 892 465 895 C 440 895 425 875 435 835 Z"
            fill="url(#skin)" stroke="#1f1612" stroke-width="4.5"/>
    </svg>`;

    await sharp(Buffer.from(svg))
      .webp({ quality: 90, alphaQuality: 95 })
      .toFile(path.join(OUT_BASE, `sprites/ines_${v.expr}.webp`));
    console.log('Generated Inês sprite:', v.expr);
  }

  // Chefe da Estação (Sr. Joaquim) — 70yo stationmaster with oversized cap & forced wide smile
  const joaquimVariants = [
    { expr: 'sorriso', mouth: 'M 418 388 Q 450 416 482 388 Z', eyes: 'wide' },
    { expr: 'neutra', mouth: 'M 424 394 Q 450 402 476 394', eyes: 'frozen' },
  ];

  for (const v of joaquimVariants) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <defs>
        <radialGradient id="jskin" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stop-color="#e8c8b0"/>
          <stop offset="100%" stop-color="#bf9678"/>
        </radialGradient>
        <linearGradient id="jcoat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#223142"/>
          <stop offset="100%" stop-color="#131c26"/>
        </linearGradient>
      </defs>

      <!-- Railway Uniform Jacket -->
      <path d="M 235 560 C 265 495 340 465 390 458 L 510 458 C 560 465 635 495 665 560 L 710 1195 L 190 1195 Z"
            fill="url(#jcoat)" stroke="#0d131a" stroke-width="6"/>
      <!-- Brass Buttons & Red Collar Piping -->
      <path d="M 385 462 L 450 585 L 515 462" fill="#e6dfd5" stroke="#18222c" stroke-width="4"/>
      <path d="M 442 510 L 458 510 L 464 620 L 436 620 Z" fill="#7a2822" stroke="#181110" stroke-width="3"/>
      <circle cx="450" cy="660" r="10" fill="#d9a441" stroke="#1a140b" stroke-width="3"/>
      <circle cx="450" cy="740" r="10" fill="#d9a441" stroke="#1a140b" stroke-width="3"/>
      <circle cx="450" cy="820" r="10" fill="#d9a441" stroke="#1a140b" stroke-width="3"/>

      <!-- Neck & Head -->
      <path d="M 412 405 L 410 480 Q 450 502 490 480 L 488 405 Z" fill="url(#jskin)" stroke="#231915" stroke-width="4.5"/>
      <path d="M 368 275 C 365 360 392 422 450 432 C 508 422 535 360 532 275 Z" fill="url(#jskin)" stroke="#231915" stroke-width="5"/>

      <!-- White Side Hair & Mustache -->
      <path d="M 360 270 Q 345 315 362 355" fill="none" stroke="#d9dfe4" stroke-width="16" stroke-linecap="round"/>
      <path d="M 540 270 Q 555 315 538 355" fill="none" stroke="#d9dfe4" stroke-width="16" stroke-linecap="round"/>

      <!-- Wrinkles -->
      <path d="M 395 345 Q 382 375 398 402 M 505 345 Q 518 375 502 402" fill="none" stroke="#9e7559" stroke-width="3"/>

      <!-- Very Open Pale Eyes -->
      <circle cx="415" cy="318" r="13" fill="#f7f4ee" stroke="#1f1713" stroke-width="3.5"/>
      <circle cx="415" cy="318" r="5.5" fill="#5b7b8c"/>
      <circle cx="415" cy="318" r="2.5" fill="#111"/>

      <circle cx="485" cy="318" r="13" fill="#f7f4ee" stroke="#1f1713" stroke-width="3.5"/>
      <circle cx="485" cy="318" r="5.5" fill="#5b7b8c"/>
      <circle cx="485" cy="318" r="2.5" fill="#111"/>

      <!-- Bushy White Eyebrows -->
      <path d="M 392 296 Q 415 284 435 296" fill="none" stroke="#e2e6ea" stroke-width="8" stroke-linecap="round"/>
      <path d="M 465 296 Q 485 284 508 296" fill="none" stroke="#e2e6ea" stroke-width="8" stroke-linecap="round"/>

      <!-- Nose & White Mustache -->
      <path d="M 450 315 L 443 358 Q 450 366 462 358" fill="none" stroke="#231915" stroke-width="4"/>
      <path d="M 408 376 Q 450 360 492 376 Q 475 390 450 384 Q 425 390 408 376 Z" fill="#e2e6ea" stroke="#2b2d2f" stroke-width="3.5"/>

      <!-- Smile / Frozen Mouth -->
      <path d="${v.mouth}" fill="#f7f3eb" stroke="#231915" stroke-width="4"/>

      <!-- Oversized Stationmaster Cap -->
      <path d="M 325 258 C 330 175 570 175 575 258 Z" fill="#1c2a38" stroke="#0d131a" stroke-width="5.5"/>
      <path d="M 332 248 L 568 248 L 564 272 L 336 272 Z" fill="#8c2d26" stroke="#0d131a" stroke-width="4.5"/>
      <path d="M 320 270 Q 450 296 580 270 Q 450 252 320 270 Z" fill="#11171d" stroke="#080b0e" stroke-width="5"/>
      <circle cx="450" cy="222" r="16" fill="#d9a441" stroke="#141008" stroke-width="3.5"/>
    </svg>`;

    await sharp(Buffer.from(svg))
      .webp({ quality: 90, alphaQuality: 95 })
      .toFile(path.join(OUT_BASE, `sprites/joaquim_${v.expr}.webp`));
    console.log('Generated Joaquim sprite:', v.expr);
  }
}

async function run() {
  for (const item of BG_MAP) {
    const src = findFile(item.prefix);
    if (src) {
      await processBackground(src, path.join(OUT_BASE, item.out));
    }
  }

  for (const item of SPRITE_MAP) {
    const src = findFile(item.prefix);
    if (src) {
      await removeWhiteBgAndSave(src, path.join(OUT_BASE, item.out));
    }
  }

  const tristeSrc = findFile('celeste_triste_png');
  const neutraSrc = findFile('celeste_neutra_png');
  if (tristeSrc) {
    await removeWhiteBgAndSave(tristeSrc, path.join(OUT_BASE, 'sprites/celeste_evasiva.webp'));
  }
  if (neutraSrc) {
    await removeWhiteBgAndSave(neutraSrc, path.join(OUT_BASE, 'sprites/celeste_surpresa.webp'));
  }

  await buildCharacterGouacheSvgSprites();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

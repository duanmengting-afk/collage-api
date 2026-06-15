import { createCanvas, loadImage } from '@napi-rs/canvas';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { images: urls, outputWidth } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0)
    return res.status(400).json({ error: 'images array required' });
  if (urls.length > 6)
    return res.status(400).json({ error: 'max 6 images' });

  const OUTPUT_W = outputWidth || 1080;
  const n = urls.length;

  let bitmaps;
  try {
    bitmaps = await Promise.all(urls.map((url) => loadImage(url)));
  } catch (e) {
    return res.status(502).json({ error: 'Image download failed: ' + e.message });
  }

  const layout = computeLayout(n, OUTPUT_W);
  const OUTPUT_H = layout.canvasH;
  const GAP = Math.round(OUTPUT_W * 0.006);

  const canvas = createCanvas(OUTPUT_W, OUTPUT_H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);

  for (let i = 0; i < bitmaps.length; i++) {
    const { x, y, w, h } = layout.cells[i];
    const dx = x + GAP, dy = y + GAP, dw = w - GAP * 2, dh = h - GAP * 2;
    const bm = bitmaps[i];
    const scale = Math.max(dw / bm.width, dh / bm.height);
    const sw = dw / scale, sh = dh / scale;
    const sx = (bm.width - sw) / 2, sy = (bm.height - sh) / 2;
    ctx.drawImage(bm, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  const base64 = canvas.toDataURL('image/png');
  return res.status(200).json({ base64 });
}

function computeLayout(n, W) {
  const RATIO = 4 / 3;
  if (n === 1) {
    const h = Math.round(W * RATIO);
    return { canvasH: h, cells: [{ x: 0, y: 0, w: W, h }] };
  }
  if (n === 2) {
    const cw = Math.round(W / 2), h = Math.round(cw * RATIO);
    return { canvasH: h, cells: [{ x: 0, y: 0, w: cw, h }, { x: cw, y: 0, w: W - cw, h }] };
  }
  if (n === 3) {
    const cw = Math.round(W / 3), h = Math.round(cw * RATIO);
    return { canvasH: h, cells: [{ x: 0, y: 0, w: cw, h }, { x: cw, y: 0, w: cw, h }, { x: cw * 2, y: 0, w: W - cw * 2, h }] };
  }
  if (n === 4) {
    const cw = Math.round(W / 2), ch = Math.round(cw * RATIO);
    return { canvasH: ch * 2, cells: [{ x: 0, y: 0, w: cw, h: ch }, { x: cw, y: 0, w: W - cw, h: ch }, { x: 0, y: ch, w: cw, h: ch }, { x: cw, y: ch, w: W - cw, h: ch }] };
  }
  if (n === 5) {
    const lw = Math.round(W * 0.5), rw = W - lw;
    const smallW = Math.round(rw / 2), smallH = Math.round(smallW * RATIO);
    const totalH = smallH * 2;
    return { canvasH: totalH, cells: [
      { x: 0, y: 0, w: lw, h: totalH },
      { x: lw, y: 0, w: smallW, h: smallH },
      { x: lw + smallW, y: 0, w: rw - smallW, h: smallH },
      { x: lw, y: smallH, w: smallW, h: smallH },
      { x: lw + smallW, y: smallH, w: rw - smallW, h: smallH },
    ]};
  }
  const cw = Math.round(W / 3), ch = Math.round(cw * RATIO);
  return { canvasH: ch * 2, cells: [
    { x: 0, y: 0, w: cw, h: ch }, { x: cw, y: 0, w: cw, h: ch }, { x: cw * 2, y: 0, w: W - cw * 2, h: ch },
    { x: 0, y: ch, w: cw, h: ch }, { x: cw, y: ch, w: cw, h: ch }, { x: cw * 2, y: ch, w: W - cw * 2, h: ch },
  ]};
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

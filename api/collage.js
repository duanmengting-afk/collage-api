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
  const H = Math.round(W * 4 / 3); // 固定画布 3:4

  if (n === 1) {
    return { canvasH: H, cells: [{ x: 0, y: 0, w: W, h: H }] };
  }

  if (n === 2) {
    const cw = Math.round(W / 2);
    return { canvasH: H, cells: [
      { x: 0, y: 0, w: cw, h: H },
      { x: cw, y: 0, w: W - cw, h: H },
    ]};
  }

  if (n === 3) {
    // 上1大图 + 下2小图
    const ch = Math.round(H / 2);
    const bw = Math.round(W / 2);
    return { canvasH: H, cells: [
      { x: 0, y: 0, w: W, h: ch },
      { x: 0, y: ch, w: bw, h: H - ch },
      { x: bw, y: ch, w: W - bw, h: H - ch },
    ]};
  }

  if (n === 4) {
    const cw = Math.round(W / 2);
    const ch = Math.round(H / 2);
    return { canvasH: H, cells: [
      { x: 0, y: 0, w: cw, h: ch },
      { x: cw, y: 0, w: W - cw, h: ch },
      { x: 0, y: ch, w: cw, h: H - ch },
      { x: cw, y: ch, w: W - cw, h: H - ch },
    ]};
  }

  if (n === 5) {
    // 左大图 + 右侧 2×2
    const lw = Math.round(W / 2);
    const rw = W - lw;
    const smallW = Math.round(rw / 2);
    const ch = Math.round(H / 2);
    return { canvasH: H, cells: [
      { x: 0, y: 0, w: lw, h: H },
      { x: lw, y: 0, w: smallW, h: ch },
      { x: lw + smallW, y: 0, w: rw - smallW, h: ch },
      { x: lw, y: ch, w: smallW, h: H - ch },
      { x: lw + smallW, y: ch, w: rw - smallW, h: H - ch },
    ]};
  }

  // 6张：3行 × 2列
  const cw = Math.round(W / 2);
  const ch = Math.round(H / 3);
  return { canvasH: H, cells: [
    { x: 0, y: 0, w: cw, h: ch },
    { x: cw, y: 0, w: W - cw, h: ch },
    { x: 0, y: ch, w: cw, h: ch },
    { x: cw, y: ch, w: W - cw, h: ch },
    { x: 0, y: ch * 2, w: cw, h: H - ch * 2 },
    { x: cw, y: ch * 2, w: W - cw, h: H - ch * 2 },
  ]};
}

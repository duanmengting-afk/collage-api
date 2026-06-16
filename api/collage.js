import { createCanvas, loadImage } from '@napi-rs/canvas';

const FONTS = {
  georgia: { family: 'DejaVu Serif, Liberation Serif, serif', style: 'bold' },
  times:   { family: 'DejaVu Serif, Liberation Serif, serif', style: 'bold' },
  serif:   { family: 'DejaVu Serif, Liberation Serif, serif', style: 'bold' },
  sans:    { family: 'DejaVu Sans, Liberation Sans, sans-serif', style: 'bold' },
};

function computeLayout(n, W) {
  const H = Math.round(W * 4 / 3);
  if (n === 1) return { cols: 1, rows: 1, W, H };
  if (n === 2) return { cols: 2, rows: 1, W, H };
  if (n === 3) return { cols: 3, rows: 1, W, H };
  if (n === 4) return { cols: 2, rows: 2, W, H };
  if (n === 5) return { cols: 3, rows: 2, W, H };
  if (n === 6) return { cols: 3, rows: 2, W, H };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows, W, H };
}

function drawName(ctx, name, x, y, cellW, cellH, fontFamily, fontStyle) {
  if (!name) return;
  const text = name.toUpperCase();
  const fontSize = Math.max(24, Math.round(cellW * 0.10));
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const textY = y + cellH - Math.round(cellH * 0.06);
  const textX = x + cellW / 2;
  // Shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  // Black stroke
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = Math.max(3, fontSize * 0.12);
  ctx.strokeText(text, textX, textY);
  // White fill
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, textX, textY);
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { images = [], names = [], font = 'georgia', outputWidth = 1080 } = req.body || {};

  if (!images.length) {
    return res.status(400).json({ error: 'No images provided' });
  }

  const fontCfg = FONTS[font] || FONTS.georgia;
  const { cols, rows, W, H } = computeLayout(images.length, outputWidth);
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / rows);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < images.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;

    try {
      const img = await loadImage(images[i]);
      // Cover-fit: fill cell, crop overflow
      const scaleX = cellW / img.width;
      const scaleY = cellH / img.height;
      const scale = Math.max(scaleX, scaleY);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = x + (cellW - dw) / 2;
      const dy = y + (cellH - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    } catch (e) {
      ctx.fillStyle = '#222222';
      ctx.fillRect(x, y, cellW, cellH);
    }

    // Draw name overlay
    drawName(ctx, names[i] || '', x, y, cellW, cellH, fontCfg.family, fontCfg.style);
  }

  const buffer = canvas.toBuffer('image/png');
  const base64 = buffer.toString('base64');
  res.status(200).json({ base64: 'data:image/png;base64,' + base64 });
}

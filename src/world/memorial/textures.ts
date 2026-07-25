import * as THREE from 'three';
import type { MemorialEntry } from '@/data/memorialData';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')!];
}

/** Draws wrapped, centred text; returns the Y below the last line. */
export function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;
  for (const word of words) {
    const candidate = line.length > 0 ? `${line} ${word}` : word;
    if (line.length > 0 && ctx.measureText(candidate).width > maxWidth) {
      ctx.fillText(line, centerX, y);
      line = word;
      y += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line.length > 0) {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  }
  return y;
}

/** Speckled granite-like tile for platform, stairs and wall. */
export function createStoneTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#575c64';
  ctx.fillRect(0, 0, size, size);

  // Broad tonal patches.
  for (let i = 0; i < 14; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 60 + Math.random() * 140;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const shade = Math.random() > 0.5 ? '255,255,255' : '0,0,0';
    gradient.addColorStop(0, `rgba(${shade},0.05)`);
    gradient.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  // Fine speckle.
  for (let i = 0; i < 9000; i += 1) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.02 + v * 0.05})` : `rgba(0,0,0,${0.03 + v * 0.06})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The Tricolour with a 24-spoke Ashoka Chakra, at the correct 3:2 ratio. */
export function createFlagTexture(): THREE.CanvasTexture {
  const width = 960;
  const height = 640;
  const [canvas, ctx] = makeCanvas(width, height);
  const band = height / 3;

  ctx.fillStyle = '#ff9933';
  ctx.fillRect(0, 0, width, band);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, band, width, band);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, band * 2, width, band);

  // Ashoka Chakra: diameter three-quarters of the white band.
  const cx = width / 2;
  const cy = height / 2;
  const radius = (band * 0.75) / 2 + band * 0.09;
  ctx.strokeStyle = '#000080';
  ctx.fillStyle = '#000080';

  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3.4;
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius * 0.94, cy + Math.sin(angle) * radius * 0.94);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** An engraved memorial stone face for one honoured soldier. */
export function createStoneFaceTexture(entry: MemorialEntry): THREE.CanvasTexture {
  const width = 512;
  const height = 768;
  const [canvas, ctx] = makeCanvas(width, height);
  const centerX = width / 2;
  const maxWidth = width - 88;

  ctx.fillStyle = '#383d45';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(217,196,137,0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(217,196,137,0.85)';
  ctx.font = '600 30px Georgia, serif';
  let y = drawWrapped(ctx, entry.rank.toUpperCase(), centerX, 92, maxWidth, 38);

  ctx.fillStyle = '#e5d6a3';
  ctx.font = '700 52px Georgia, serif';
  y = drawWrapped(ctx, entry.name, centerX, y + 30, maxWidth, 60);

  ctx.strokeStyle = 'rgba(217,196,137,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 90, y + 4);
  ctx.lineTo(centerX + 90, y + 4);
  ctx.stroke();

  ctx.fillStyle = '#e0b25a';
  ctx.font = '600 32px Georgia, serif';
  y = drawWrapped(ctx, entry.award, centerX, y + 48, maxWidth, 40);

  ctx.fillStyle = 'rgba(229,214,163,0.95)';
  ctx.font = 'italic 31px Georgia, serif';
  y = drawWrapped(ctx, `“${entry.quote}”`, centerX, y + 52, maxWidth, 42);

  ctx.fillStyle = 'rgba(206,199,178,0.8)';
  ctx.font = '25px Georgia, serif';
  drawWrapped(ctx, entry.summary, centerX, y + 40, maxWidth, 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** The dedication tablet behind the flag — for all who fell. */
export function createDedicationTexture(lines: readonly string[]): THREE.CanvasTexture {
  const width = 1024;
  const height = 560;
  const [canvas, ctx] = makeCanvas(width, height);
  const centerX = width / 2;
  const maxWidth = width - 120;

  ctx.fillStyle = '#3b4046';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(217,196,137,0.5)';
  ctx.lineWidth = 5;
  ctx.strokeRect(26, 26, width - 52, height - 52);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  let y = 96;
  lines.forEach((line, index) => {
    if (index === 0) {
      ctx.fillStyle = '#e0b25a';
      ctx.font = '600 46px Georgia, serif';
      y = drawWrapped(ctx, line, centerX, y, maxWidth, 54) + 26;
    } else {
      ctx.fillStyle = 'rgba(229,214,163,0.92)';
      ctx.font = 'italic 30px Georgia, serif';
      y = drawWrapped(ctx, line, centerX, y, maxWidth, 42) + 4;
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Engraved memorial plaque with bronze lettering. */
export function createPlaqueTexture(lines: readonly string[]): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const [canvas, ctx] = makeCanvas(width, height);

  ctx.fillStyle = '#3b4046';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(217,196,137,0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  ctx.fillStyle = '#d9c489';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const step = height / (lines.length + 1);
  lines.forEach((line, index) => {
    const size = index === 0 ? 88 : 54;
    ctx.font = `600 ${size}px Georgia, 'Times New Roman', serif`;
    ctx.fillText(line, width / 2, step * (index + 1) + (index === 0 ? 8 : 4));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

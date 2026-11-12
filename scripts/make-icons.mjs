import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const bg = [26, 18, 14];
const copper = [227, 154, 69];
const ember = [224, 104, 64];
const mouth = [20, 12, 10];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function cover(distance) {
  return Math.max(0, Math.min(1, 0.5 - distance));
}

function paint(x, y, size, scale) {
  const cx = size / 2;
  const cy = size * 0.64;
  const rad = size * 0.26 * scale;
  const stroke = Math.max(3, size * 0.058 * scale);
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const dist = Math.hypot(dx, dy);
  let color = bg;
  if (dy < stroke * 0.15 && dist < rad - stroke * 0.35) {
    const glow = 1 - dist / (rad - stroke * 0.35);
    color = mix(mouth, ember, glow * glow * 0.95);
  }
  if (dy < -stroke * 0.2) {
    color = mix(color, copper, cover(Math.abs(dist - rad) - stroke / 2));
  }
  const foot = rad + stroke / 2;
  if (Math.abs(dx) <= foot && Math.abs(dy) <= stroke / 2) {
    color = mix(color, copper, cover(Math.abs(dy) - stroke / 2));
    if (Math.abs(dx) <= foot - 1.5 && Math.abs(dy) <= stroke / 2 - 1.2) color = copper;
  }
  return [...color, 255];
}

function crc(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, checksum]);
}

function png(size, scale) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size, scale);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', png(192, 1));
writeFileSync('public/icon-512.png', png(512, 1));
writeFileSync('public/icon-maskable-512.png', png(512, 0.72));
writeFileSync('public/apple-touch-icon.png', png(180, 1));
console.log('icons written');

/* 앱 아이콘(PNG)을 외부 패키지 없이 그려 낸다.
   실행: node tools/make-icons.mjs
   결과: assets/icon-192.png, assets/icon-512.png, assets/icon-maskable-512.png
   (앱 자체는 빌드가 필요 없다. 이 스크립트는 아이콘을 다시 만들 때만 쓴다.) */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');

/* ---------- PNG 인코더 ---------- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;               // 8bit, RGBA
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;                  // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- 거리 함수 ---------- */
const sdRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

const PINK = [255, 77, 109];
const VIOLET = [124, 92, 255];
const WHITE = [255, 255, 255];
const GREY = [198, 204, 219];

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
];

/* ---------- 아이콘 한 장 ---------- */
function drawIcon(size, { maskable = false } = {}) {
  const S = size;
  const SS = 3;                            // 3x3 수퍼샘플링
  const px = Buffer.alloc(S * S * 4);
  const k = maskable ? 0.78 : 1;           // 마스커블은 안전영역 안으로 줄인다
  const bgR = maskable ? 0 : 0.225;

  // 티켓 좌표 (0~1 정규화, 중심 0.5/0.5)
  const T = { cx: 0.5, cy: 0.5, hw: 0.30 * k, hh: 0.205 * k, r: 0.05 * k };
  const notchR = 0.052 * k;
  const pad = 0.055 * k;
  const left = T.cx - T.hw + pad;

  const bars = [
    { y0: T.cy - 0.125 * k, y1: T.cy - 0.095 * k, x0: left, x1: left + 0.345 * k },
    { y0: T.cy - 0.062 * k, y1: T.cy - 0.032 * k, x0: left, x1: left + 0.245 * k }
  ];
  const band = { y0: T.cy + 0.045 * k, y1: T.cy + 0.135 * k };
  const dashes = [
    [T.cx - 0.255 * k, T.cx - 0.115 * k],
    [T.cx - 0.065 * k, T.cx + 0.075 * k],
    [T.cx + 0.125 * k, T.cx + 0.265 * k]
  ];
  const dashY = [T.cy + 0.073 * k, T.cy + 0.107 * k];

  const aa = d => Math.max(0, Math.min(1, 0.5 - d * S));   // d: 정규화 거리

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / S;
          const v = (y + (sy + 0.5) / SS) / S;

          // 1) 배경: 둥근 사각형 + 대각 그라디언트
          const dBg = maskable ? -1 : sdRect(u, v, 0.5, 0.5, 0.5, 0.5, bgR);
          let aBg = maskable ? 1 : aa(dBg);
          if (aBg <= 0) continue;
          let col = mix(PINK, VIOLET, Math.max(0, Math.min(1, u * 0.55 + v * 0.45)));
          let alpha = aBg;

          // 2) 티켓: 흰 둥근 사각형에서 좌우 반원을 파낸다
          let dTk = sdRect(u, v, T.cx, T.cy, T.hw, T.hh, T.r);
          dTk = Math.max(dTk, -sdCircle(u, v, T.cx - T.hw, T.cy, notchR));
          dTk = Math.max(dTk, -sdCircle(u, v, T.cx + T.hw, T.cy, notchR));
          const aTk = aa(dTk);
          if (aTk > 0) col = mix(col, WHITE, aTk);

          // 3) 티켓 속 정보 줄
          for (const ln of bars) {
            const d = sdRect(u, v, (ln.x0 + ln.x1) / 2, (ln.y0 + ln.y1) / 2,
                             (ln.x1 - ln.x0) / 2, (ln.y1 - ln.y0) / 2, (ln.y1 - ln.y0) / 2);
            const t = aa(d) * aTk;
            if (t > 0) col = mix(col, GREY, t);
          }

          // 4) 아래쪽 흐르는 글자 띠 (티켓 모양으로 잘라 낸다)
          const dBand = Math.max(
            sdRect(u, v, T.cx, (band.y0 + band.y1) / 2, T.hw, (band.y1 - band.y0) / 2, 0.004),
            dTk
          );
          const aBand = aa(dBand);
          if (aBand > 0) {
            col = mix(col, mix(PINK, VIOLET, Math.max(0, Math.min(1, u * 0.9))), aBand);
            // 5) 띠 안의 흰 글자 조각
            for (const [x0, x1] of dashes) {
              const d = sdRect(u, v, (x0 + x1) / 2, (dashY[0] + dashY[1]) / 2,
                               (x1 - x0) / 2, (dashY[1] - dashY[0]) / 2, (dashY[1] - dashY[0]) / 2);
              const t = aa(d) * aBand;
              if (t > 0) col = mix(col, WHITE, t);
            }
          }

          r += col[0] * alpha; g += col[1] * alpha; b += col[2] * alpha; a += alpha;
        }
      }

      const n = SS * SS;
      const i = (y * S + x) * 4;
      if (a > 0) {
        px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a);
        px[i + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return encodePng(S, S, px);
}

mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }]
];
for (const [name, size, opt] of jobs) {
  const buf = drawIcon(size, opt);
  writeFileSync(join(OUT, name), buf);
  console.log(`${name}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)}KB`);
}

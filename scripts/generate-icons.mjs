// Generates Langblock logo PNGs: light-blue rounded square with "Lb" in dark gray-blue.
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ── PNG helpers ─────────────────────────────────────────────── */

function crc32(buf) {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const tb = Buffer.from(type)
  const lb = Buffer.allocUnsafe(4); lb.writeUInt32BE(data.length)
  const cb = Buffer.allocUnsafe(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])))
  return Buffer.concat([lb, tb, data, cb])
}

function writePNG(filePath, size, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr.fill(0, 10, 13) // 8-bit RGBA

  const stride = 1 + size * 4
  const raw = Buffer.allocUnsafe(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4, d = y * stride + 1 + x * 4
      raw[d] = px[s]; raw[d + 1] = px[s + 1]; raw[d + 2] = px[s + 2]; raw[d + 3] = px[s + 3]
    }
  }

  writeFileSync(filePath, Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]))
}

/* ── SDF primitives (design space: 512 × 512) ───────────────── */

function sdfRoundedBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  return Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2)
       + Math.min(Math.max(qx, qy), 0) - r
}

function sdfBox(px, py, cx, cy, hw, hh) {
  const dx = Math.abs(px - cx) - hw
  const dy = Math.abs(py - cy) - hh
  return Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2)
       + Math.min(Math.max(dx, dy), 0)
}

function sdfEllipse(px, py, cx, cy, rx, ry) {
  const nx = (px - cx) / rx, ny = (py - cy) / ry
  const d = Math.sqrt(nx * nx + ny * ny)
  return d < 1e-6 ? -Math.min(rx, ry) : (d - 1) * Math.min(rx, ry)
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/* ── Design constants ────────────────────────────────────────── */

const DS = 512
const FILL = [219, 234, 254] // #dbeafe  – light blue (matches extension highlight)
const DARK = [71, 85, 105]   // #475569  – dark gray-blue (text + outline)

// Rounded rectangle
const RCX = 256, RCY = 256, RHW = 240, RHH = 240, RR = 80, RSW = 14

// Letter "L" — serif: thick stem (32), thin crossbar (18), top bilateral serif
const LV_CX = 150, LV_CY = 256, LV_HW = 16, LV_HH = 109   // vertical stem
const LS_CX = 150, LS_CY = 150.5, LS_HW = 30, LS_HH = 3.5  // top serif
const LH_CX = 202, LH_CY = 356, LH_HW = 68, LH_HH = 9     // horizontal bar (thin)

// Letter "b" — serif: thick stem (32), top serif, contrasted bowl
const BS_CX = 308, BS_CY = 256, BS_HW = 16, BS_HH = 109     // stem
const BSF_CX = 308, BSF_CY = 150.5, BSF_HW = 30, BSF_HH = 3.5 // top serif
const BB_CX = 324, BB_CY = 303
const BB_ORX = 68, BB_ORY = 62   // outer ellipse
const BB_IRX = 36, BB_IRY = 42   // inner ellipse — taller ry gives thin top/bottom walls (serif contrast)

/* ── Renderer ────────────────────────────────────────────────── */

function render(size) {
  const SS = 4 // 4×4 super-sampling
  const aa = DS / (size * SS) // anti-alias width in design units
  const out = new Uint8Array(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let accR = 0, accG = 0, accB = 0, accA = 0

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * DS
          const y = ((py + (sy + 0.5) / SS) / size) * DS

          // Shape (rounded rect)
          const sShape = sdfRoundedBox(x, y, RCX, RCY, RHW, RHH, RR)
          const shapeA = clamp(0.5 - sShape / aa, 0, 1)
          if (shapeA < 0.001) continue

          // Stroke (inside border)
          const sStroke = Math.max(sShape, -sShape - RSW)

          // Letter "L" (stem + top serif + thin crossbar)
          const sL = Math.min(
            sdfBox(x, y, LV_CX, LV_CY, LV_HW, LV_HH),
            sdfBox(x, y, LS_CX, LS_CY, LS_HW, LS_HH),
            sdfBox(x, y, LH_CX, LH_CY, LH_HW, LH_HH),
          )

          // Letter "b" (stem + top serif + contrasted bowl)
          const sStem = Math.min(
            sdfBox(x, y, BS_CX, BS_CY, BS_HW, BS_HH),
            sdfBox(x, y, BSF_CX, BSF_CY, BSF_HW, BSF_HH),
          )
          const sOuter = Math.max(sdfEllipse(x, y, BB_CX, BB_CY, BB_ORX, BB_ORY), BB_CX - x)
          const sInner = Math.max(sdfEllipse(x, y, BB_CX, BB_CY, BB_IRX, BB_IRY), BB_CX - x)
          const sBowl = Math.max(sOuter, -sInner)
          const sB = Math.min(sStem, sBowl)

          // All dark features (stroke + text)
          const sDark = Math.min(sStroke, Math.min(sL, sB))
          const darkA = clamp(0.5 - sDark / aa, 0, 1)

          // Blend fill ↔ dark
          const cr = FILL[0] * (1 - darkA) + DARK[0] * darkA
          const cg = FILL[1] * (1 - darkA) + DARK[1] * darkA
          const cb = FILL[2] * (1 - darkA) + DARK[2] * darkA

          // Accumulate pre-multiplied
          accR += cr * shapeA; accG += cg * shapeA; accB += cb * shapeA; accA += shapeA
        }
      }

      const i = (py * size + px) * 4
      const avgA = accA / (SS * SS)
      if (accA > 0.001) {
        out[i]     = Math.round(clamp(accR / accA, 0, 255))
        out[i + 1] = Math.round(clamp(accG / accA, 0, 255))
        out[i + 2] = Math.round(clamp(accB / accA, 0, 255))
      }
      out[i + 3] = Math.round(clamp(avgA * 255, 0, 255))
    }
  }
  return out
}

/* ── Generate ────────────────────────────────────────────────── */

const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

for (const sz of [16, 48, 128]) {
  writePNG(join(outDir, `icon${sz}.png`), sz, render(sz))
  console.log(`  icon${sz}.png`)
}

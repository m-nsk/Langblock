// Generates placeholder solid-color PNG icons using only Node.js built-ins.
import { deflateRawSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const lenBuf = Buffer.allocUnsafe(4)
  lenBuf.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.allocUnsafe(4)
  crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf])
}

function createPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const stride = 1 + size * 3
  const raw = Buffer.allocUnsafe(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const off = y * stride + 1 + x * 3
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateRawSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

// Placeholder color: indigo #6366F1
const [r, g, b] = [99, 102, 241]

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), createPNG(size, r, g, b))
  console.log(`  icon${size}.png`)
}

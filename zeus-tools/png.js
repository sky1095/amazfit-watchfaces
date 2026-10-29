// Minimal anti-aliased PNG rasterizer: shade(x, y) returns [r, g, b, a] with a in 0..1.
const zlib = require('zlib'), fs = require('fs')
const crcT = []
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0 }
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0 }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }

exports.writePng = (file, w, h, shade) => {
  const rows = []
  for (let y = 0; y < h; y++) {
    const r = [0]
    for (let x = 0; x < w; x++) {
      // 4x4 supersampling for smooth edges
      let R = 0, G = 0, B = 0, A = 0
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const [cr, cg, cb, ca] = shade(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)
        R += cr * ca; G += cg * ca; B += cb * ca; A += ca
      }
      r.push(A ? Math.round(R / A) : 0, A ? Math.round(G / A) : 0, A ? Math.round(B / A) : 0, Math.round((A / 16) * 255))
    }
    rows.push(Buffer.from(r))
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]))
}

// Distance from point to a vertical segment x=cx, y in [y0, y1], minus radius: < 0 means inside a capsule.
exports.capsule = (x, y, cx, y0, y1, r) => {
  const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0
  return Math.hypot(x - cx, dy) - r
}

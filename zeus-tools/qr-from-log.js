// Turns the half-block QR that `zeus preview` prints into a scannable SVG.
const fs = require('fs')
const [log, out] = process.argv.slice(2)
const lines = fs.readFileSync(log, 'utf8').split('\n').filter((l) => /^[▄▀█ ]{30,}$/.test(l))
let rows = []
for (const l of lines) {
  const top = [], bot = []
  for (const ch of l) {
    top.push(ch === '█' || ch === '▀')
    bot.push(ch === '█' || ch === '▄')
  }
  rows.push(top, bot)
}
rows = rows.filter((r) => r.some(Boolean))
const W = rows[0].length, H = rows.length, s = 8
let r = ''
rows.forEach((row, y) => row.forEach((on, x) => { if (!on) r += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}"/>` }))
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-3 * s} ${-3 * s} ${(W + 6) * s} ${(H + 6) * s}" width="520" height="520" shape-rendering="crispEdges"><rect x="${-3 * s}" y="${-3 * s}" width="${(W + 6) * s}" height="${(H + 6) * s}" fill="#fff"/><g fill="#000">${r}</g></svg>`)

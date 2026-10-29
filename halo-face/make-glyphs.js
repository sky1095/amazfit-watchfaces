// Renders Halo's text as image glyphs in Inter (SIL OFL 1.1), since the watch's TEXT widget
// can't load custom fonts. Writes assets/default/g/** and watchface/glyphs.js.
// Run with: node make-glyphs.js <dir containing Inter-Medium.ttf and Inter-SemiBold.ttf>
const fs = require('fs')
const path = require('path')
const tools = path.join(__dirname, '../zeus-tools/fontgen/node_modules')
const opentype = require(path.join(tools, 'opentype.js'))
const sharp = require(path.join(tools, 'sharp'))

const fontDir = process.argv[2]
const FONTS = {
  medium: opentype.parse(fs.readFileSync(path.join(fontDir, 'Inter-Medium.ttf'))),
  semibold: opentype.parse(fs.readFileSync(path.join(fontDir, 'Inter-SemiBold.ttf')))
}
const OUT = path.join(__dirname, 'assets/default/g')

// cap: cap height in px. track: extra letter spacing in px. Flat colours only.
const SETS = {
  date: { font: 'medium', cap: 16, track: 0.5, color: '#f5f5f5' },
  dateAod: { font: 'medium', cap: 16, track: 0.5, color: '#6b6b6b' },
  temp: { font: 'semibold', cap: 19, track: 0, color: '#f5f5f5' },
  tempSmall: { font: 'medium', cap: 9, track: 0.3, color: '#8c8c8c' },
  // Side stacks. Activity values take their ring's colour, which is their label.
  comp: { font: 'semibold', cap: 13, track: 0, color: '#f5f5f5' },
  compSteps: { font: 'semibold', cap: 13, track: 0, color: '#ffa62b' },
  compKcal: { font: 'semibold', cap: 13, track: 0, color: '#a78bfa' },
  compStand: { font: 'semibold', cap: 13, track: 0, color: '#2dd4bf' },
  // Units sit on their number's baseline at a smaller size, so they share its box height.
  compUnit: { font: 'medium', cap: 7, track: 0.6, color: '#8c8c8c', boxCap: 13, lead: 3 },
  smallUnit: { font: 'medium', cap: 7, track: 0.3, color: '#8c8c8c', boxCap: 9, lead: 1 }
}

function pathData(p) {
  const f = (n) => n.toFixed(2)
  return p.commands.map((c) => {
    if (c.type === 'M' || c.type === 'L') return c.type + f(c.x) + ' ' + f(c.y)
    if (c.type === 'Q') return 'Q' + f(c.x1) + ' ' + f(c.y1) + ' ' + f(c.x) + ' ' + f(c.y)
    if (c.type === 'C') return 'C' + f(c.x1) + ' ' + f(c.y1) + ' ' + f(c.x2) + ' ' + f(c.y2) + ' ' + f(c.x) + ' ' + f(c.y)
    return 'Z'
  }).join('')
}

// Box height fits caps and digits; the degree sign sits inside the cap height.
function render(text, set, fixedWidth, alignRight) {
  const font = FONTS[set.font]
  const capH = font.tables.os2.sCapHeight / font.unitsPerEm
  const size = set.cap / capH
  const scale = size / font.unitsPerEm
  const pad = 2
  const boxCap = set.boxCap || set.cap
  const h = Math.ceil(boxCap + pad * 2)
  let x = set.lead || 0
  let right = 0
  let d = ''
  for (const ch of text) {
    const g = font.charToGlyph(ch)
    const p = g.getPath(x, pad + boxCap, size)
    d += `<path d="${pathData(p)}"/>`
    right = Math.max(right, p.getBoundingBox().x2, x + g.advanceWidth * scale)
    x += g.advanceWidth * scale + set.track
  }
  const natural = Math.ceil(right) + 1
  const w = fixedWidth || natural
  const shift = fixedWidth ? (fixedWidth - natural) / (alignRight ? 1 : 2) : 0
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <g transform="translate(${shift},0)" fill="${set.color}">${d}</g></svg>`
  return { svg, w, h }
}

async function save(rel, r) {
  const file = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await sharp(Buffer.from(r.svg)).png().toFile(file)
  return { w: r.w, h: r.h }
}

// Tabular digits: every digit gets the widest digit's box so numbers don't jitter.
async function digitSet(name) {
  const set = SETS[name]
  const widest = Math.max(...'0123456789'.split('').map((c) => render(c, set).w))
  let meta
  for (const c of '0123456789') meta = await save(`${name}/${c}.png`, render(c, set, widest))
  meta.minus = await save(`${name}/minus.png`, render('-', set))
  meta.degree = await save(`${name}/deg.png`, render('°', set))
  meta.dot = await save(`${name}/dot.png`, render('.', set))
  return meta
}

async function main() {
  const meta = { digits: {}, week: {}, labels: {} }
  for (const name of ['date', 'dateAod', 'temp', 'tempSmall', 'comp', 'compSteps', 'compKcal', 'compStand']) meta.digits[name] = await digitSet(name)

  // Weekday names share one right-aligned box so the day number can sit at a fixed x.
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  for (const name of ['date', 'dateAod']) {
    const widest = Math.max(...DAYS.map((d) => render(d, SETS[name]).w))
    for (let i = 0; i < 7; i++) meta.week[name] = await save(`${name}/wk${i}.png`, render(DAYS[i], SETS[name], widest, true))
  }

  meta.labels.hi = await save('label/hi.png', render('H', SETS.tempSmall))
  meta.labels.lo = await save('label/lo.png', render('L', SETS.tempSmall))

  meta.units = {}
  for (const [key, text] of [['bpm', 'BPM'], ['pct', '%'], ['km', 'KM'], ['mi', 'MI']]) {
    meta.units[key] = await save(`unit/${key}.png`, render(text, SETS.compUnit))
  }
  meta.units.pctSmall = await save('unit/pctSmall.png', render('%', SETS.smallUnit))

  const js = '// Generated by make-glyphs.js. Image sizes in px for layout.\nexport const GLYPHS = ' + JSON.stringify(meta, null, 2) + '\n'
  fs.writeFileSync(path.join(__dirname, 'watchface/glyphs.js'), js)
  console.log(JSON.stringify(meta))
}

main()

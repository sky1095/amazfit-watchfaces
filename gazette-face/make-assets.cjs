// Generates every image the Gazette face uses, in 466px screen space (Active 2 Round).
// Usage: node make-assets.cjs [light|dark] [project dir]
//   light (default) writes into this project; dark writes into ../gazette-dark-face and copies
//   watchface/index.js there, so both faces share one source.
// Fonts are all SIL OFL: Unifraktur Maguntia (weekday masthead), DM Serif Display (time),
// Old Standard TT (everything else). The watch receives raster glyphs, never font files.
const fs = require('fs'), path = require('path')
const sharp = require('../zeus-tools/fontgen/node_modules/sharp')
const ot = require('../zeus-tools/fontgen/node_modules/opentype.js')

const THEME = process.argv[2] || 'light'
const PROJECT = path.resolve(process.argv[3] || (THEME === 'dark' ? path.join(__dirname, '../gazette-dark-face') : __dirname))
const OUT = path.join(PROJECT, 'assets/default')
const font = (f) => ot.parse(fs.readFileSync(path.join(__dirname, 'fonts', f)))
const FONTS = {
  gothic: font('UnifrakturMaguntia-Book.ttf'),
  display: font('DMSerifDisplay-Regular.ttf'),
  serif: font('OldStandard-Regular.ttf'),
  bold: font('OldStandard-Bold.ttf')
}

// light: white newsprint. dark: true-black AMOLED page (unlit pixels) with off-white ink.
const THEMES = {
  light: { paper: '#f6f6f4', grain: '#55524a', grainMax: 0.028, ink: '#1d1c1a', gray: '#4a4740' },
  dark: { paper: '#000000', grain: null, grainMax: 0, ink: '#ebe9e3', gray: '#9c9990' }
}
const T = THEMES[THEME]
if (!T) throw Error('unknown theme ' + THEME)
const PAPER = T.paper, INK = T.ink, GRAY = T.gray, AOD = '#8f8c84'
const meta = { digits: {}, images: {} }

const svgDoc = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`

function pathData(p) {
  const f = (n) => n.toFixed(2)
  return p.commands.map((c) => {
    if (c.type === 'M' || c.type === 'L') return c.type + f(c.x) + ' ' + f(c.y)
    if (c.type === 'Q') return 'Q' + [c.x1, c.y1, c.x, c.y].map(f).join(' ')
    if (c.type === 'C') return 'C' + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].map(f).join(' ')
    return 'Z'
  }).join('')
}

// Lays out text at a given cap height. Returns path markup, advance width and box height.
// box: { h, base } fixes the image height and baseline so glyphs from one set line up.
function shape(text, face, cap, track = 0) {
  const f = FONTS[face]
  const capUnits = f.tables.os2.sCapHeight || f.charToGlyph('H').getBoundingBox().y2
  const size = (cap * f.unitsPerEm) / capUnits
  return { f, size, track, text }
}

function render(text, face, cap, color, opts = {}) {
  const { f, size } = shape(text, face, cap)
  const track = opts.track || 0
  const base = opts.base || Math.ceil(cap + 4)
  const h = opts.h || Math.ceil(base + cap * 0.32 + 3)
  let x = 1, right = 0, body = ''
  for (const ch of text) {
    const g = f.charToGlyph(ch)
    const p = g.getPath(x, base, size)
    body += `<path d="${pathData(p)}"/>`
    const bb = p.getBoundingBox()
    right = Math.max(right, isFinite(bb.x2) ? bb.x2 : 0, x + (g.advanceWidth * size) / f.unitsPerEm)
    x += (g.advanceWidth * size) / f.unitsPerEm + track
  }
  // tight: crop to the ink plus opts.tight px each side (for digits, whose side bearings
  // in Old Standard read as letter-spacing once glyphs are set image by image).
  if (opts.tight !== undefined) {
    let x1 = Infinity, x2 = -Infinity
    for (const m of body.matchAll(/[ML](-?[\d.]+) /g)) { x1 = Math.min(x1, +m[1]); x2 = Math.max(x2, +m[1]) }
    for (const m of body.matchAll(/[QC]([^A-Z"]+)/g)) {
      const n = m[1].trim().split(/\s+/).map(Number)
      for (let i = 0; i < n.length; i += 2) { x1 = Math.min(x1, n[i]); x2 = Math.max(x2, n[i]) }
    }
    const w = Math.ceil(x2 - x1 + 2 * opts.tight)
    return { w, h, svg: svgDoc(w, h, `<g fill="${color}" transform="translate(${(opts.tight - x1).toFixed(2)},0)">${body}</g>`) }
  }
  const natural = Math.ceil(right) + 1
  const w = opts.w || natural
  const shift = opts.w ? (opts.align === 'right' ? opts.w - natural : (opts.w - natural) / 2) : 0
  return { w, h, svg: svgDoc(w, h, `<g fill="${color}" transform="translate(${shift.toFixed(2)},0)">${body}</g>`) }
}

async function save(name, img) {
  if (/NaN|undefined|Infinity/.test(img.svg)) throw Error('bad svg: ' + name)
  const file = path.join(OUT, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await sharp(Buffer.from(img.svg)).png().toFile(file)
  meta.images[name] = { w: img.w, h: img.h }
  return img
}

// Proportional (old-style newspaper) digits plus the separators TEXT_IMG can show:
// dot_image doubles as ':' or ','. Readings are centred, so varying widths never jump.
// tabular=true keeps one width per digit (needed where IMG_TIME places digits itself).
async function digitSet(name, face, cap, color, seps, tabular) {
  const base = Math.ceil(cap + 4)
  const h = Math.ceil(base + cap * 0.32 + 3)
  const tight = Math.max(1, cap * 0.06)
  const w = Math.max(...[...'0123456789'].map((c) => render(c, face, cap, color, { base, h, tight }).w))
  for (const c of '0123456789') await save(`g/${name}/${c}.png`, render(c, face, cap, color, tabular ? { base, h, w } : { base, h, tight }))
  await save(`g/${name}/minus.png`, render('-', face, cap, color, { base, h }))
  for (const [key, text, extra] of seps) await save(`g/${name}/${key}.png`, render(text, face, cap, color, { base, h, w: extra }))
  meta.digits[name] = { w, h }
}

// Authored icons, filled ink, 16px box.
const ICONS = {
  steps: `<path d="M5.2 1.2C3 1.6 2.3 4.6 2.6 7.2c.2 1.8 1 2.8 2.2 2.8s1.9-1.1 2-2.9c.1-2.7-.4-6.1-1.6-5.9z"/><ellipse cx="5.4" cy="12.6" rx="1.9" ry="2.2"/><path d="M11.4 3.2c-2.1.3-2.8 3.2-2.5 5.6.2 1.7.9 2.6 2.1 2.6s1.8-1 1.9-2.7c.1-2.6-.4-5.7-1.5-5.5z" opacity=".55"/>`,
  battery: `<rect x="1.5" y="4.5" width="11" height="7" rx="1.2" fill="none" stroke="${INK}" stroke-width="1.3"/><rect x="13" y="6.5" width="1.6" height="3" rx=".5"/><rect x="3" y="6" width="6.5" height="4" rx=".4"/>`,
  heart: `<path d="M8 14.2 2.4 8.7C.6 6.9.8 4.1 2.8 2.9c1.6-.9 3.6-.4 4.6 1.1l.6.8.6-.8c1-1.5 3-2 4.6-1.1 2 1.2 2.2 4 .4 5.8z"/>`
}

// Footprints for the masthead animation, drawn into a small strip (not full screen) so each
// frame is cheap to swap on the watch.
const WALK = { x: 150, y: 14, w: 170, h: 34, frames: 24, prints: 9 }
const footprint = (x, y, flip, o) =>
  `<g fill="${INK}" opacity="${o.toFixed(3)}" transform="translate(${x},${y}) rotate(78) scale(${flip ? -0.9 : 0.9},0.9)"><path d="M0-7C-3-6.6-3.6-2-3-.2-2.5 1.4-1.4 2 0 2s2.4-.8 2.6-2.3C3-2.4 2.4-7.3 0-7z"/><ellipse cy="5.6" rx="2" ry="2.4"/></g>`

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true })

  await digitSet('time', 'display', 66, INK, [['colon', ':', 22]])
  await digitSet('timeAod', 'display', 66, AOD, [['colon', ':', 22]], true)
  await digitSet('value', 'bold', 17, INK, [['comma', ',']])
  await digitSet('small', 'serif', 10, INK, [['deg', '°'], ['pct', '%']])
  await digitSet('date', 'bold', 17, INK, [['sep', ', ']])
  await digitSet('issue', 'bold', 10, INK, [])

  // Masthead weekday, centred in one fixed box so swapping days never moves it.
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  for (const [set, color] of [['week', INK], ['weekAod', AOD]]) {
    for (const [i, day] of DAYS.entries()) {
      const fit = Math.min(40, (40 * 300) / render(day, 'gothic', 40, color).w)
      await save(`${set}/${i}.png`, render(day, 'gothic', fit, color, { w: 320, h: 66, base: 52 }))
    }
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dateBox = meta.digits.date
  for (const [i, m] of MONTHS.entries()) await save(`month/${i}.png`, render(m + ' ', 'bold', 17, INK, { base: Math.ceil(17 + 4), h: dateBox.h }))

  // Forecast condition headline, right-aligned so it hugs the right end of the strip.
  // Zepp condition codes 0-28 (docs: Weather sensor); 25 is "unknown".
  const WEATHER = ['CLOUDY', 'SHOWERS', 'SNOW SHOWERS', 'SUNNY', 'OVERCAST', 'LIGHT RAIN', 'LIGHT SNOW', 'MODERATE RAIN',
    'MODERATE SNOW', 'HEAVY SNOW', 'HEAVY RAIN', 'SANDSTORM', 'RAIN & SNOW', 'FOG', 'HAZY', 'THUNDERSTORMS', 'SNOWSTORM',
    'DUST', 'HEAVY RAIN', 'RAIN & HAIL', 'STORMS & HAIL', 'HEAVY RAIN', 'DUST', 'SANDSTORM', 'RAINSTORM', 'WEATHER --',
    'CLOUDY', 'SHOWERS', 'CLEAR']
  for (const [i, w] of WEATHER.entries()) await save(`weather/${i}.png`, render(w, 'bold', 10, INK, { w: 150, align: 'right', track: 0.4 }))

  await save('dash.png', render('--', 'bold', 17, INK, { base: Math.ceil(17 + 4), h: meta.digits.value.h }))

  // Paper: tone, grain, a few ink specks, the printed rules, labels and icons.
  let seed = 37
  const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0), seed / 4294967296)
  let paper = `<rect width="466" height="466" fill="${PAPER}"/>`
  if (T.grain) for (let i = 0; i < 5000; i++) paper += `<circle cx="${(rnd() * 466).toFixed(1)}" cy="${(rnd() * 466).toFixed(1)}" r="${(rnd() * 0.45 + 0.1).toFixed(2)}" fill="${T.grain}" opacity="${(rnd() * T.grainMax).toFixed(3)}"/>`
  for (const [x, y, r] of [[178, 38, 1.7], [184, 33, 1.1], [190, 37, 2.1], [196, 31, 0.9], [187, 41, 0.7]]) paper += `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}" opacity="${THEME === 'dark' ? 0.35 : 0.55}"/>`
  // Printed labels. Each records where its text ends so the live value can start right after it.
  meta.labels = {}
  const label = (key, text, x, y, cap = 9, face = 'serif', color = GRAY) => {
    const g = render(text, face, cap, color, { track: 0.5 })
    meta.labels[key] = { x, y, end: Math.ceil(x + g.w) }
    return `<g transform="translate(${x},${y})">${g.svg.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`
  }
  paper += `<g stroke="${INK}" fill="none">
    <path d="M76 120H390" stroke-width="2.6"/><path d="M76 126H390" stroke-width="1"/>
    <path d="M72 154H394" stroke-width=".8"/><path d="M72 326H394" stroke-width=".8"/>
    <path d="M184 338V392M282 338V392" stroke-width=".6" opacity=".7"/></g>`
  paper += label('vol', 'VOL.', 82, 131, 10, 'bold', INK)
  paper += `<g fill="${INK}">${[0, 1, 2, 3].map((i) => `<circle cx="${148 + i * 6}" cy="${142}" r="1"/>`).join('')}</g>`
  paper += label('high', 'HIGH', 28, 199) + label('low', 'LOW', 28, 219)
  paper += label('now', 'NOW', 362, 241) + label('hum', 'HUM', 362, 261)
  for (const [name, cx] of [['steps', 135], ['battery', 233], ['heart', 331]]) paper += `<g fill="${INK}" transform="translate(${cx - 8},336)">${ICONS[name]}</g>`
  await save('paper.png', { w: 466, h: 466, svg: svgDoc(466, 466, paper) })

  // Footprint walk: prints appear left to right, then fade. Last frame is empty.
  for (let n = 0; n < WALK.frames; n++) {
    let s = ''
    for (let i = 0; i < WALK.prints; i++) {
      const age = n - i * 1.6
      if (age < 0) continue
      const o = Math.max(0, Math.min(1, age / 2) * (1 - Math.max(0, age - 6) / 8)) * 0.5
      if (o > 0.01) s += footprint(10 + i * 18, 17 + (i % 2 ? -5 : 5), i % 2 === 1, o)
    }
    await save(`walk/${n}.png`, { w: WALK.w, h: WALK.h, svg: svgDoc(WALK.w, WALK.h, s) })
  }
  meta.walk = WALK

  await sharp(path.join(OUT, 'paper.png')).resize(96, 96).toFile(path.join(OUT, 'icon.png'))
  meta.images['icon.png'] = { w: 96, h: 96 }
  fs.mkdirSync(path.join(PROJECT, 'watchface'), { recursive: true })
  fs.writeFileSync(path.join(PROJECT, 'watchface/assets.js'), '// Generated by make-assets.cjs.\nexport const ASSETS = ' + JSON.stringify(meta) + '\n')
  if (PROJECT !== __dirname) {
    fs.copyFileSync(path.join(__dirname, 'watchface/index.js'), path.join(PROJECT, 'watchface/index.js'))
    fs.copyFileSync(path.join(__dirname, 'app.js'), path.join(PROJECT, 'app.js'))
  }
  console.log(`Generated ${Object.keys(meta.images).length} ${THEME} images in ${PROJECT}`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 })

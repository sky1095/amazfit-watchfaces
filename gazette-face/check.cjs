// Runs watchface/index.js in a mocked Zepp runtime, asserts behaviour, and renders previews
// from the real assets: preview.png (normal), preview-aod.png, preview-limits.png (widest readings).
// Usage: node check.cjs [project dir]   (defaults to this project; pass ../gazette-dark-face for dark)
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict')
const sharp = require('../zeus-tools/fontgen/node_modules/sharp')

const root = path.resolve(process.argv[2] || __dirname)
const asset = (f) => path.join(root, 'assets/default', f)
const ASSETS = JSON.parse(fs.readFileSync(path.join(root, 'watchface/assets.js'), 'utf8').replace(/^[\s\S]*?=\s*/, ''))
const code = fs.readFileSync(path.join(root, 'watchface/index.js'), 'utf8').replace("import { ASSETS } from './assets'", '')

const bound = { WEATHER_HIGH: '8', WEATHER_LOW: '7', WEATHER_CURRENT: '7', HUMIDITY: '93', BATTERY: '96', HEART: '' }
let widgets = []
const timers = new Map()
let nextTimer = 0, face
const clock = { year: 2026, month: 10, day: 24, week: 6, hour: 19, format_hour: 7, minute: 40, addEventListener(e, cb) { this.cb = cb } }
const steps = { current: 5945, addEventListener() {} }
let forecast = { forecastData: { data: [{ index: 5 }] } }
const weather = { getForecastWeather() { if (!forecast) throw Error('no weather'); return forecast } }

vm.runInNewContext(code, {
  ASSETS,
  WatchFace: (f) => { face = f },
  hmUI: {
    show_level: { ONLY_NORMAL: 'normal', ONAL_AOD: 'aod' },
    widget: { IMG: 'IMG', TEXT_IMG: 'TEXT_IMG', IMG_TIME: 'IMG_TIME', WIDGET_DELEGATE: 'WIDGET_DELEGATE' },
    align: { CENTER_H: 'center', LEFT: 'left', RIGHT: 'right' },
    data_type: Object.fromEntries(Object.keys(bound).map((k) => [k, k])),
    prop: { SRC: 'src', TEXT: 'text', MORE: 'more' },
    createWidget(kind, o) {
      const w = { kind, ...o, setProperty(k, v) { if (k === 'more') Object.assign(this, v); else this[k] = v } }
      widgets.push(w)
      return w
    },
    deleteWidget(w) { widgets = widgets.filter((x) => x !== w) }
  },
  hmSensor: {
    id: { TIME: 'time', STEP: 'step', WEATHER: 'weather' },
    event: { MINUTEEND: 'minute', CHANGE: 'change' },
    createSensor: (id) => ({ time: clock, step: steps, weather }[id])
  },
  timer: { createTimer(d, p, cb) { timers.set(++nextTimer, cb); return nextTimer }, stopTimer: (id) => timers.delete(id) },
  Date
})

// Every image reference must exist.
const srcOf = (w) => [w.src, ...(w.font_array || []), w.dot_image, w.unit_en, w.negative_image, w.invalid_image].filter(Boolean)
const checkRefs = () => widgets.forEach((w) => srcOf(w).forEach((s) => assert.ok(ASSETS.images[s], 'missing asset ' + s)))

face.build()
checkRefs()
assert.equal(face.time.text, '7.40', '12-hour time without leading zero')
assert.equal(face.steps.text, '5.945', 'thousands separator')
assert.equal(face.issue.text, '43', 'ISO week')
assert.equal(face.week.src, 'week/5.png')
assert.equal(face.weatherLine.src, 'weather/5.png')
assert.equal(timers.size, 2, 'walk + poll timers while awake')

// Walk animation is finite and ends on the empty frame; sleep stops every timer.
for (let i = 0; i < 40; i++) for (const cb of [...timers.values()]) cb()
assert.equal(face.walk.src, 'walk/' + (ASSETS.walk.frames - 1) + '.png')
face.sleep(); assert.equal(timers.size, 0)
face.wake(); face.onDestroy(); assert.equal(timers.size, 0)

// Weather fallbacks.
for (const f of [null, { forecastData: { data: [] } }, { forecastData: { data: [{ index: 40 }] } }]) { forecast = f; face.refreshWeather(); assert.equal(face.weatherLine.src, 'weather/25.png') }
forecast = { forecastData: { data: [{ index: 5 }] } }; face.refreshWeather()

// Date row rebuilds once per day, stays centred and inside the round screen for every month.
for (let month = 1; month <= 12; month++) for (const day of [1, 28]) {
  Object.assign(clock, { month, day, week: (month % 7) + 1 }); clock.cb()
  const [m, n] = face.dateWidgets
  const right = n.x + [...n.text].reduce((s, c) => s + ASSETS.images['g/date/' + (c === '.' ? 'sep' : c) + '.png'].w, 0)
  const left = m.x
  assert.ok(Math.abs((left + right) / 2 - 233) <= 1, 'date centred')
  assert.ok(left > 40 && right < 426, 'date inside screen')
}
assert.equal(widgets.filter((w) => w.kind === 'TEXT_IMG' && w.y === 290).length, 1, 'old date widgets deleted')
Object.assign(clock, { year: 2027, month: 1, day: 1, week: 5 }); clock.cb(); assert.equal(face.issue.text, '53')
Object.assign(clock, { year: 2026, month: 10, day: 24, week: 6 }); clock.cb()
assert.equal(face.steps.text, '5.945')
steps.current = 123456; face.refreshSteps(); assert.equal(face.steps.text, '123.456'); steps.current = 5945; face.refreshSteps()

// Rendering.
const img = (file, x, y) => `<image href="data:image/png;base64,${fs.readFileSync(asset(file)).toString('base64')}" x="${x}" y="${y}" width="${ASSETS.images[file].w}" height="${ASSETS.images[file].h}"/>`
function textImg(w, text) {
  if (text === '' && w.invalid_image) return img(w.invalid_image, w.x + (w.w - ASSETS.images[w.invalid_image].w) / 2, w.y)
  const files = [...text].map((c) => (c === '-' ? w.negative_image : c === '.' ? w.dot_image : w.font_array[+c]))
  if (w.unit_en) files.push(w.unit_en)
  const total = files.reduce((s, f) => s + ASSETS.images[f].w, 0)
  assert.ok(total < w.w, `"${text}" is ${total}px in a ${w.w}px box (would clip)`)
  let x = w.x + (w.align_h === 'center' ? (w.w - total) / 2 : w.align_h === 'right' ? w.w - total : 0)
  return files.map((f) => { const s = img(f, Math.round(x), w.y); x += ASSETS.images[f].w; return s }).join('')
}
async function render(level, file) {
  let s = `<rect width="466" height="466" fill="#000"/>`
  for (const w of widgets.filter((w) => w.show_level === level)) {
    if (w.kind === 'IMG') s += img(w.src, w.x, w.y)
    if (w.kind === 'TEXT_IMG') s += textImg(w, w.type ? bound[w.type] : w.text)
    if (w.kind === 'IMG_TIME') s += textImg({ x: w.hour_startX, y: w.hour_startY, w: 200, align_h: 'left', font_array: w.hour_array }, '19') + textImg({ x: w.minute_startX, y: w.minute_startY, w: 200, align_h: 'left', font_array: w.minute_array }, '40')
  }
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="466" height="466"><defs><clipPath id="c"><circle cx="233" cy="233" r="233"/></clipPath></defs><g clip-path="url(#c)">${s}</g></svg>`)).png().toFile(path.join(root, file))
}

async function main() {
  // Show the walk mid-stride in the normal preview.
  face.walk.src = 'walk/9.png'
  await render('normal', 'preview.png')
  await render('aod', 'preview-aod.png')
  Object.assign(bound, { WEATHER_HIGH: '-24', WEATHER_LOW: '-24', WEATHER_CURRENT: '-24', HUMIDITY: '100', BATTERY: '100', HEART: '220' })
  Object.assign(clock, { format_hour: 12, minute: 59, month: 9, day: 30, week: 3 }); clock.cb()
  steps.current = 99999; face.refreshSteps()
  await render('normal', 'preview-limits.png')
  console.log('PASS: time format, steps grouping, ISO issue, weather fallbacks, date centring per month, widget cleanup, timers, asset refs, no clipping at limits')
}
main().catch((e) => { console.error(e); process.exitCode = 1 })

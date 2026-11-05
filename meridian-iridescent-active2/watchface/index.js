// Meridian (by aditya3524), ported to the Amazfit Active 2 (466x466).
// Reconstructed from the store build's bytecode, with three changes:
//   - the second hand sweeps like Halo's (redrawn every 33 ms from the clock while the screen is
//     on) instead of ticking once a second;
//   - four more complications to pick per slot: calories, PAI, distance, sunrise/sunset;
//   - layout and art rescaled from 480px to 466px.
// The four slots are WATCHFACE_EDIT_GROUPs: long-press the face, then Edit, to choose per slot.

import * as hmUI from '@zos/ui'
import * as app from '@zos/app'
import * as sensors from '@zos/sensor'
import * as router from '@zos/router'
import * as settings from '@zos/settings'
import { M } from './layout'
import { createSheen, dialFrame } from './iridescence'

const RT = M.runtime
const CENTER = RT.dial / 2
const IS_AOD = app.getScene() === app.SCENE_AOD
const ROOT = RT.app_dir + (IS_AOD ? '/aod/' : '/')
let LEVEL = IS_AOD
  ? hmUI.show_level.ONAL_AOD
  : hmUI.show_level.ONLY_EDIT !== undefined
    ? hmUI.show_level.ONLY_NORMAL | hmUI.show_level.ONLY_EDIT
    : hmUI.show_level.ONLY_NORMAL
const NORMAL_ONLY = IS_AOD ? LEVEL : hmUI.show_level.ONLY_NORMAL
const REFRESH_MS = RT.refresh_ms
const COMPASS_SCREEN = RT.compass_screen

let ui = {}
let sensorsLive = {}
let refreshTimer = null
let sweepTimer = null
let visible = false
let taps = []
let sheen = null
let tiltFrame = 0
let shownFrame = -1

function updateDial() {
  if (IS_AOD || !ui.background) return
  const frame = dialFrame(new Date(), tiltFrame)
  if (frame === shownFrame) return
  setSrc(ui.background, 'iridescent/' + pad2(frame) + '.png')
  shownFrame = frame
}

function startSheen() {
  if (IS_AOD || !ui.background) return
  safe('iridescence', () => {
    if (!sheen) {
      const sensor = new sensors.Accelerometer()
      sensor.setFreqMode(sensors.FREQ_MODE_NORMAL)
      sheen = createSheen(sensor, (frame) => { tiltFrame = frame; updateDial() })
    }
    sheen.start()
  })
}

function stopSheen() {
  if (sheen) safe('iridescence-stop', () => sheen.stop())
}

function withLevel(level, fn) {
  const prev = LEVEL
  LEVEL = level
  try { fn() } finally { LEVEL = prev }
}

function safe(name, fn) {
  try { return fn() } catch (e) {
    console.log('MERIDIAN widget failed: ' + name + ' ' + e)
    return null
  }
}

function img(x, y, w, h, src, extra) {
  const o = { x, y, w, h, src: ROOT + src, show_level: LEVEL }
  if (extra) for (const k in extra) o[k] = extra[k]
  return hmUI.createWidget(hmUI.widget.IMG, o)
}

function setSrc(w, src) {
  if (!w) return
  try {
    if (hmUI.prop.SRC !== undefined) { w.setProperty(hmUI.prop.SRC, ROOT + src); return }
  } catch (e) {}
  try { w.setProperty(hmUI.prop.MORE, { src: ROOT + src }) } catch (e) {}
}

function setBox(w, x, y, wd, h) {
  if (!w) return
  try { w.setProperty(hmUI.prop.MORE, { x: Math.round(x), y: Math.round(y), w: wd, h }) } catch (e) {}
}

function setVisible(w, v) {
  if (!w) return
  try { w.setProperty(hmUI.prop.VISIBLE, v) } catch (e) {}
}

const pad2 = (n) => (n < 10 ? '0' + n : '' + n)
const pad3 = (n) => (n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n)

function digitArray(font) {
  const a = []
  for (let i = 0; i < 10; i++) a.push(ROOT + 'fonts/' + font + '/' + i + '.png')
  return a
}

function glyphFile(c) {
  if (c === '%') return 'pct'
  if (c === '-') return 'minus'
  if (c === '.') return 'dot'
  if (c === ':') return 'colon'
  return c
}

function dataType(name) {
  if (hmUI.data_type === undefined) return undefined
  return hmUI.data_type[name]
}

// top-left of a complication box centred on (cx, cy)
function origin(cx, cy) {
  return [Math.round(cx - M.box / 2), Math.round(cy - M.box / 2)]
}

function readNumber(obj, getter, field) {
  if (!obj) return NaN
  let v = NaN
  try { if (typeof obj[getter] == 'function') v = Number(obj[getter]()) } catch (e) { v = NaN }
  if (isFinite(v)) return v
  try { if (obj[field] !== undefined) v = Number(obj[field]) } catch (e) { v = NaN }
  return v
}

// A row of image glyphs for values the face computes itself; setRow positions them.
function makeRow(font, count) {
  const f = M.fonts[font]
  const first = Object.keys(f.w)[0]
  const row = { font, widgets: [], text: null }
  for (let i = 0; i < count; i++) {
    const w = safe('row-' + font + '-' + i, () => img(0, 0, f.w[first], f.h, 'fonts/' + font + '/' + glyphFile(first) + '.png'))
    setVisible(w, false)
    row.widgets.push(w)
  }
  return row
}

function setRow(row, text, x, cy, align) {
  if (!row) return
  const key = text + '|' + x + '|' + cy + '|' + align
  if (row.text === key) return
  const f = M.fonts[row.font]
  const track = f.track || 0
  let width = 0
  for (let i = 0; i < text.length; i++) width += f.w[text.charAt(i)]
  width += track * Math.max(0, text.length - 1)
  let gx = align === 'left' ? x : align === 'right' ? x - width : x - width / 2
  const gy = cy - f.h / 2
  for (let i = 0; i < row.widgets.length; i++) {
    const w = row.widgets[i]
    if (i < text.length) {
      const c = text.charAt(i)
      setBox(w, gx, gy, f.w[c], f.h)
      setSrc(w, 'fonts/' + row.font + '/' + glyphFile(c) + '.png')
      setVisible(w, true)
      gx += f.w[c] + track
    } else setVisible(w, false)
  }
  row.text = key
}

// Firmware-filled number (TEXT_IMG bound to a data type), centred at (x, y).
function nativeNumber(name, font, type, x, y, w, negative, pct, align, extra) {
  if (type === undefined) return null
  const f = M.fonts[font]
  return safe(name, () => {
    const o = {
      x: Math.round(x - w / 2), y: Math.round(y - f.h / 2), w, h: f.h,
      type, font_array: digitArray(font), h_space: f.track || 0,
      align_h: align === 'right' ? hmUI.align.RIGHT : align === 'left' ? hmUI.align.LEFT : hmUI.align.CENTER_H,
      show_level: LEVEL
    }
    if (negative) o.negative_image = ROOT + 'fonts/' + font + '/minus.png'
    if (pct) o.unit_en = o.unit_sc = o.unit_tc = ROOT + 'fonts/' + font + '/pct.png'
    if (extra) for (const k in extra) o[k] = extra[k]
    return hmUI.createWidget(hmUI.widget.TEXT_IMG, o)
  })
}

function numberAt(name, font, type, cx, cy, negative, numKey, extra) {
  const p = M.num[numKey || font]
  let x = cx + p.dx
  if (p.align === 'right') x -= p.w / 2
  else if (p.align === 'left') x += p.w / 2
  return nativeNumber(name, font, type, x, cy + p.dy, p.w, negative, false, p.align, extra)
}

// Tap target that opens the system app for a data type.
function hotZone(name, x, y, w, h, type) {
  if (IS_AOD || type === undefined || hmUI.widget.IMG_CLICK === undefined) return null
  return safe('hot-' + name, () => hmUI.createWidget(hmUI.widget.IMG_CLICK, {
    x, y, w, h, src: ROOT + 'hot_72.png', type, show_level: hmUI.show_level.ONLY_NORMAL
  }))
}

function launchNative(url) {
  const o = { url, native: true }
  try {
    if (typeof hmApp != 'undefined' && hmApp.startApp) { hmApp.startApp(o); return true }
  } catch (e) { console.log('hmApp.startApp failed: ' + e) }
  try {
    if (router.launchApp) { router.launchApp(o); return true }
  } catch (e) { console.log('launchApp failed: ' + e) }
  return false
}

function tapZone(name, x, y, w, h, onTap) {
  if (IS_AOD || hmUI.event === undefined) return null
  return safe('tap-' + name, () => {
    const t = hmUI.createWidget(hmUI.widget.IMG, { x, y, w, h, src: ROOT + 'hot_72.png', show_level: hmUI.show_level.ONLY_NORMAL })
    t.addEventListener(hmUI.event.CLICK_UP, onTap)
    return t
  })
}

// Sensors are created on first use, so unused complications cost nothing.
function lazySensor(key, Ctor) {
  if (sensorsLive[key] !== undefined) return sensorsLive[key]
  let s = null
  try { if (typeof Ctor == 'function') s = new Ctor() } catch (e) { s = null }
  sensorsLive[key] = s
  return s
}
const heartSensor = () => lazySensor('heart', sensors.HeartRate)
const batterySensor = () => lazySensor('battery', sensors.Battery)
const stepSensor = () => lazySensor('step', sensors.Step)
const calorieSensor = () => lazySensor('calorie', sensors.Calorie)
const timeSensor = () => lazySensor('time', sensors.Time)
const weatherSensor = () => lazySensor('weather', sensors.Weather)

function frames(dir, n) {
  const a = []
  for (let i = 0; i < n; i++) a.push(ROOT + dir + '/' + pad2(i) + '.png')
  return a
}

// Gauge art: firmware-driven IMG_LEVEL when the data type exists, else its first frame.
function levelImage(name, pos, dir, count, type) {
  return safe(name, () => {
    if (type === undefined) return img(pos[0], pos[1], M.box, M.box, dir + '/00.png')
    return hmUI.createWidget(hmUI.widget.IMG_LEVEL, {
      x: pos[0], y: pos[1], w: M.box, h: M.box,
      image_array: frames(dir, count), image_length: count, type, show_level: LEVEL
    })
  })
}

// ---- complications: each builds its widgets and returns a hot-zone creator (or null) ----

const hotAt = (name, cx, cy, type) => () =>
  hotZone(name, cx - RT.hot_zone / 2, cy - RT.hot_zone / 2, RT.hot_zone, RT.hot_zone, type)
const base = (name, cx, cy, src) => {
  const p = origin(cx, cy)
  return safe(name, () => img(p[0], p[1], M.box, M.box, src))
}
const gauge = (key, cx, cy, frameCount, type) => {
  levelImage(key, origin(cx, cy), key, frameCount, type)
  numberAt(key + '-value', 'value', type, cx, cy, false)
}

const BUILDERS = {
  date(cx, cy) {
    base('date', cx, cy, 'date/base.png')
    ;(ui.dateViews = ui.dateViews || []).push({
      cx, cy, wd: makeRow('date_wd', RT.row_glyphs.date_wd), day: makeRow('date_day', RT.row_glyphs.date_day)
    })
    return null
  },
  hr(cx, cy) {
    const v = { cx, cy, frame: -1 }
    v.img = base('hr', cx, cy, 'hr/00.png')
    v.row = makeRow('value', RT.row_glyphs.value)
    ;(ui.hrViews = ui.hrViews || []).push(v)
    return hotAt('heart', cx, cy, dataType('HEART'))
  },
  rings(cx, cy) {
    const p = origin(cx, cy)
    base('rings', cx, cy, 'rings/base.png')
    const v = { moveFrame: -1, stepsFrame: -1 }
    v.move = safe('ring-move', () => img(p[0], p[1], M.box, M.box, 'rings/move/00.png'))
    v.steps = safe('ring-steps', () => img(p[0], p[1], M.box, M.box, 'rings/steps/00.png'))
    safe('ring-stand-idle', () => img(p[0], p[1], M.box, M.box, 'rings/stand_idle.png'))
    levelImage('ring-stand', p, 'rings/stand', RT.stand_levels, dataType('STAND'))
    ;(ui.ringViews = ui.ringViews || []).push(v)
    return hotAt('activity', cx, cy, dataType('STEP'))
  },
  batt(cx, cy) {
    const v = { cx, cy, frame: -1 }
    v.img = base('batt', cx, cy, 'batt/00.png')
    v.row = makeRow('batt_value', RT.row_glyphs.batt_value)
    ;(ui.battViews = ui.battViews || []).push(v)
    return hotAt('battery', cx, cy, dataType('BATTERY'))
  },
  spo2(cx, cy) {
    base('spo2', cx, cy, 'spo2/base.png')
    numberAt('spo2-value', 'spo2_value', dataType('SPO2'), cx, cy, false, 'spo2')
    return hotAt('spo2', cx, cy, dataType('SPO2'))
  },
  uvi(cx, cy) {
    levelImage('uvi', origin(cx, cy), 'uvi', M.uvi_fractions.length, dataType('UVI'))
    numberAt('uvi-value', 'value', dataType('UVI'), cx, cy, false)
    return hotAt('uvi', cx, cy, dataType('UVI'))
  },
  temp(cx, cy) {
    base('temp', cx, cy, 'temp/base.png')
    numberAt('temp-current', M.num.temp_value ? 'temp_value' : 'value', dataType('WEATHER_CURRENT'), cx, cy, true)
    numberAt('temp-low', 'temp_lo', dataType('WEATHER_LOW'), cx, cy, true)
    numberAt('temp-high', 'temp_hi', dataType('WEATHER_HIGH'), cx, cy, true)
    return hotAt('temperature', cx, cy, dataType('WEATHER_CURRENT'))
  },
  stress(cx, cy) {
    gauge('stress', cx, cy, RT.stress_frames, dataType('STRESS'))
    return hotAt('stress', cx, cy, dataType('STRESS'))
  },
  hum(cx, cy) {
    gauge('hum', cx, cy, RT.hum_frames, dataType('HUMIDITY'))
    return hotAt('humidity', cx, cy, dataType('HUMIDITY'))
  },
  compass(cx, cy) {
    base('compass', cx, cy, 'compass/base.png')
    return () => tapZone('compass', cx - RT.hot_zone / 2, cy - RT.hot_zone / 2, RT.hot_zone, RT.hot_zone, () => launchNative(COMPASS_SCREEN))
  },
  alt(cx, cy) {
    base('altitude', cx, cy, 'alt/base.png')
    return hotAt('altitude', cx, cy, dataType('ALTITUDE'))
  },

  // Added in this port.
  kcal(cx, cy) {
    gauge('kcal', cx, cy, 10, dataType('CAL'))
    return hotAt('calories', cx, cy, dataType('CAL'))
  },
  pai(cx, cy) {
    gauge('pai', cx, cy, 10, dataType('PAI_WEEKLY'))
    return hotAt('pai', cx, cy, dataType('PAI_WEEKLY'))
  },
  dist(cx, cy) {
    base('dist', cx, cy, 'dist/base.png')
    numberAt('dist-value', 'spo2_value', dataType('DISTANCE'), cx, cy, false, 'spo2', {
      dot_image: ROOT + 'fonts/spo2_value/dot.png'
    })
    return hotAt('distance', cx, cy, dataType('DISTANCE'))
  },
  sun(cx, cy) {
    const v = { cx, cy, rise: null }
    v.img = base('sun', cx, cy, 'sun/rise.png')
    v.row = makeRow('spo2_value', RT.row_glyphs.sun)
    ;(ui.sunViews = ui.sunViews || []).push(v)
    return hotAt('weather', cx, cy, dataType('WEATHER_CURRENT'))
  }
}

function designNamed(key) {
  for (let i = 0; i < M.designs.length; i++) if (M.designs[i].key === key) return M.designs[i]
  return null
}

function designByType(type) {
  if (type === undefined) return null
  for (let i = 0; i < M.designs.length; i++) if (M.designs[i].type === type) return M.designs[i]
  return null
}

function buildSlot(slot) {
  const fallback = designNamed(slot.default)
  let design = fallback
  if (hmUI.widget.WATCHFACE_EDIT_GROUP !== undefined) {
    const options = M.designs.map((d) => {
      const o = { type: d.type, preview: ROOT + d.preview }
      o.title_en = o.title_sc = o.title_tc = d.title
      return o
    })
    const p = slot.origin
    const tip = slot.tip
    const group = safe('edit-' + slot.id, () => hmUI.createWidget(hmUI.widget.WATCHFACE_EDIT_GROUP, {
      edit_id: slot.id, x: p[0], y: p[1], w: M.box, h: M.box,
      select_image: ROOT + 'edit/select.png', un_select_image: ROOT + 'edit/unselect.png',
      default_type: fallback.type, optional_types: options, count: options.length,
      tips_BG: ROOT + 'edit/tip.png', tips_x: tip[0] - p[0], tips_y: tip[1] - p[1], tips_width: tip[2],
      tips_margin: RT.edit_tip.margin
    }))
    try {
      const d = group ? designByType(group.getProperty(hmUI.prop.CURRENT_TYPE)) : null
      if (d) design = d
    } catch (e) { console.log('MERIDIAN edit type unavailable: ' + e) }
  }
  try {
    taps.push(BUILDERS[design.key](slot.cx, slot.cy))
  } catch (e) {
    console.log('MERIDIAN design failed: ' + design.key + ' ' + e)
    if (design !== fallback) {
      try { taps.push(BUILDERS[fallback.key](slot.cx, slot.cy)) } catch (e2) {}
    }
  }
}

function buildComplications() {
  withLevel(NORMAL_ONLY, () => M.slots.forEach(buildSlot))
}

// ---- outer arcs: heart rate, UV, steps, battery on the bezel ----

// Digits placed one by one along the arc, each from a pre-rotated glyph set.
function makeTurnedRow(arc) {
  const gv = arc.gv
  const row = { arc, widgets: [], text: null }
  const first = Object.keys(gv.size[0])[0]
  for (let i = 0; i < RT.outer_value_slots; i++) {
    const sz = gv.size[0][first]
    const w = safe('turned-' + arc.key + '-' + i, () => img(0, 0, sz[0], sz[1], 'fonts/gv_' + arc.key + '_0/' + glyphFile(first) + '.png'))
    setVisible(w, false)
    row.widgets.push(w)
  }
  return row
}

function setTurnedRow(row, text) {
  if (!row || row.text === text) return
  const gv = row.arc.gv
  const chars = text.split('')
  if (gv.c !== gv.dir) chars.reverse()
  let along = 0
  for (let i = 0; i < row.widgets.length; i++) {
    const w = row.widgets[i]
    if (i < chars.length) {
      const c = chars[i]
      const deg = gv.near + (gv.c * (along + gv.adv[c] / 2) / gv.r) * 180 / Math.PI
      const rad = (deg * Math.PI) / 180
      along += gv.adv[c]
      const sz = gv.size[String(i)][c]
      setBox(w, gv.centre[0] + gv.r * Math.sin(rad) - sz[0] / 2, gv.centre[1] - gv.r * Math.cos(rad) - sz[1] / 2, sz[0], sz[1])
      setSrc(w, 'fonts/gv_' + row.arc.key + '_' + i + '/' + glyphFile(c) + '.png')
      setVisible(w, true)
    } else setVisible(w, false)
  }
  row.text = text
}

function buildOuter() {
  if (!(M.outer && M.outer.length)) return
  ui.outer = {}
  withLevel(NORMAL_ONLY, () => M.outer.forEach((arc) => {
    const box = arc.box
    if (arc.key === 'uv') {
      safe('outer-uv', () => {
        const type = dataType('UVI')
        if (type === undefined) return img(box[0], box[1], box[2], box[3], 'outer/uv/00.png')
        return hmUI.createWidget(hmUI.widget.IMG_LEVEL, {
          x: box[0], y: box[1], w: box[2], h: box[3],
          image_array: frames('outer/uv', arc.frames), image_length: arc.frames, type, show_level: LEVEL
        })
      })
      nativeNumber('outer-uv-value', 'uv_value', dataType('UVI'), arc.value_pos[0], arc.value_pos[1], 39, false, false, 'center')
      arc.hot.forEach((h) => taps.push(() => hotZone('outer-uv', h[0], h[1], h[2], h[3], dataType('UVI'))))
      return
    }
    const v = { arc, frame: -1 }
    v.img = safe('outer-' + arc.key, () => img(box[0], box[1], box[2], box[3], 'outer/' + arc.key + '/00.png'))
    v.row = makeTurnedRow(arc)
    ui.outer[arc.key] = v
    const type = { hr: 'HEART', batt: 'BATTERY', steps: 'STEP' }[arc.key]
    arc.hot.forEach((h) => taps.push(() => hotZone('outer-' + arc.key, h[0], h[1], h[2], h[3], dataType(type))))
  }))
}

function setOuter(v, text, frame) {
  if (!v) return
  setTurnedRow(v.row, text)
  if (v.frame !== frame) {
    v.frame = frame
    setSrc(v.img, 'outer/' + v.arc.key + '/' + pad2(frame) + '.png')
  }
}

// ---- live values ----

function heartRate() {
  const s = heartSensor()
  const [lo, hi] = RT.bpm_valid
  let bpm = readNumber(s, 'getCurrent', 'current')
  if (!isFinite(bpm) || bpm < lo || bpm > hi) bpm = readNumber(s, 'getLast', 'last')
  const ok = isFinite(bpm) && bpm >= lo && bpm <= hi
  const t = ok ? Math.max(0, Math.min(1, (bpm - RT.hr_range[0]) / (RT.hr_range[1] - RT.hr_range[0]))) : 0
  return { ok, bpm, t }
}

function updateOuter() {
  if (!ui.outer) return
  if (ui.outer.hr) {
    const h = heartRate()
    setOuter(ui.outer.hr, h.ok ? pad3(Math.round(h.bpm)) : '---', Math.round(h.t * (ui.outer.hr.arc.frames - 1)))
  }
  if (ui.outer.batt) {
    const pct = Math.round(readNumber(batterySensor(), 'getCurrent', 'current'))
    if (isFinite(pct) && pct >= 0 && pct <= 100) {
      setOuter(ui.outer.batt, pct + '%', Math.round((pct * (ui.outer.batt.arc.frames - 1)) / 100))
    }
  }
  if (ui.outer.steps) {
    const s = stepSensor()
    const cur = readNumber(s, 'getCurrent', 'current')
    const goal = readNumber(s, 'getTarget', 'target')
    const t = isFinite(cur) && isFinite(goal) && goal > 0 ? Math.max(0, Math.min(1, cur / goal)) : 0
    setOuter(ui.outer.steps, Math.round(100 * t) + '%', Math.round(t * (ui.outer.steps.arc.frames - 1)))
  }
}

function updateDate() {
  if (!ui.dateViews) return
  const d = new Date()
  const wd = RT.weekdays[d.getDay()]
  const day = String(d.getDate())
  ui.dateViews.forEach((v) => {
    setRow(v.wd, wd, v.cx, v.cy + M.date.wd_dy, 'center')
    setRow(v.day, day, v.cx, v.cy + M.date.day_dy, 'center')
  })
}

function updateHeart() {
  if (!ui.hrViews) return
  const h = heartRate()
  const text = h.ok ? String(Math.round(h.bpm)) : '--'
  const frame = Math.round(h.t * (RT.hr_frames - 1))
  ui.hrViews.forEach((v) => {
    setRow(v.row, text, v.cx, v.cy + M.num.value.dy, 'center')
    if (v.frame !== frame) { v.frame = frame; setSrc(v.img, 'hr/' + pad2(frame) + '.png') }
  })
}

function updateBattery() {
  if (!ui.battViews) return
  const pct = Math.round(readNumber(batterySensor(), 'getCurrent', 'current'))
  if (!isFinite(pct) || pct < 0 || pct > 100) return
  const frame = Math.round((pct * (RT.batt_frames - 1)) / 100)
  ui.battViews.forEach((v) => {
    setRow(v.row, String(pct), v.cx, v.cy, 'center')
    if (v.frame !== frame) { v.frame = frame; setSrc(v.img, 'batt/' + pad2(frame) + '.png') }
  })
}

function ringFrame(cur, target) {
  if (!isFinite(cur) || !isFinite(target) || target <= 0) return 0
  const pct = Math.max(0, Math.min(100, (100 * cur) / target))
  return Math.round((pct * (RT.ring_levels - 1)) / 100)
}

function updateActivity() {
  if (!ui.ringViews) return
  const cal = calorieSensor()
  const step = stepSensor()
  const move = ringFrame(readNumber(cal, 'getCurrent', 'current'), readNumber(cal, 'getTarget', 'target'))
  const steps = ringFrame(readNumber(step, 'getCurrent', 'current'), readNumber(step, 'getTarget', 'target'))
  ui.ringViews.forEach((v) => {
    if (v.moveFrame !== move) { v.moveFrame = move; setSrc(v.move, 'rings/move/' + pad2(move) + '.png') }
    if (v.stepsFrame !== steps) { v.stepsFrame = steps; setSrc(v.steps, 'rings/steps/' + pad2(steps) + '.png') }
  })
}

// Today's and tomorrow's sunrise/sunset from the weather forecast (tideData).
function sunTimes() {
  const w = weatherSensor()
  if (!w) return null
  let f = null
  try { f = typeof w.getForecast == 'function' ? w.getForecast() : w.getForecastWeather() } catch (e) { f = null }
  const days = f && f.tideData && f.tideData.data
  return days && days.length ? days : null
}

function clockText(h, m) {
  let twelve = false
  try { twelve = settings.getTimeFormat() === settings.TIME_FORMAT_12 } catch (e) {}
  if (twelve) h = h % 12 || 12
  return h + ':' + pad2(m)
}

function updateSun() {
  if (!ui.sunViews) return
  const days = sunTimes()
  let text = '--:--'
  let rise = true
  if (days) {
    const now = new Date()
    const mins = now.getHours() * 60 + now.getMinutes()
    const at = (t) => (t ? t.hour * 60 + t.minute : NaN)
    const today = days[0]
    let next = null
    if (mins < at(today.sunrise)) next = today.sunrise
    else if (mins < at(today.sunset)) { next = today.sunset; rise = false }
    else next = (days[1] || today).sunrise
    if (next && isFinite(at(next))) text = clockText(next.hour, next.minute)
  }
  ui.sunViews.forEach((v) => {
    setRow(v.row, text, v.cx, v.cy + M.num.spo2.dy, 'center')
    if (v.rise !== rise) { v.rise = rise; setSrc(v.img, rise ? 'sun/rise.png' : 'sun/set.png') }
  })
}

function refresh() {
  updateDial()
  updateOuter()
  updateDate()
  updateBattery()
  updateActivity()
  updateHeart()
  updateSun()
}

// ---- hands: hour and minute from the firmware, second hand sweeps like Halo's ----

function buildHands() {
  const h = M.hands
  const handRoot = ROOT + (IS_AOD ? 'minimal/' : 'hands/')
  safe('hands', () => hmUI.createWidget(hmUI.widget.TIME_POINTER, {
    hour_centerX: CENTER, hour_centerY: CENTER, hour_posX: h.hour.px, hour_posY: h.hour.py,
    hour_path: handRoot + 'hour.png',
    minute_centerX: CENTER, minute_centerY: CENTER, minute_posX: h.minute.px, minute_posY: h.minute.py,
    minute_path: handRoot + 'minute.png',
    show_level: LEVEL
  }))
  if (!IS_AOD) {
    ui.second = safe('second', () => hmUI.createWidget(hmUI.widget.IMG, {
      x: 0, y: 0, w: RT.dial, h: RT.dial, src: ROOT + 'hands/second.png',
      pos_x: CENTER - h.second.px, pos_y: CENTER - h.second.py, center_x: CENTER, center_y: CENTER, angle: 0,
      show_level: hmUI.show_level.ONLY_NORMAL
    }))
  }
  safe('hub', () => img(CENTER - h.hub.w / 2, CENTER - h.hub.h / 2, h.hub.w, h.hub.h, (IS_AOD ? 'minimal/' : 'hands/') + 'hub.png'))
}

// Same clock and timer as Halo: the legacy TIME sensor's utc and timer.createTimer. The @zos
// equivalents only advanced once a second on the Active 2, which made the hand tick.
let legacyTime
function clockMs() {
  if (legacyTime === undefined) {
    legacyTime = null
    try {
      if (typeof hmSensor != 'undefined') legacyTime = hmSensor.createSensor(hmSensor.id.TIME)
    } catch (e) { legacyTime = null }
  }
  let ms = legacyTime ? Number(legacyTime.utc) : NaN
  if (!isFinite(ms)) ms = readNumber(timeSensor(), 'getTime', 'utc')
  if (!isFinite(ms)) ms = Date.now()
  return ms
}

function every(ms, fn) {
  if (typeof timer != 'undefined' && timer.createTimer) return { legacy: timer.createTimer(ms, ms, fn) }
  return { id: setInterval(fn, ms) }
}

function cancel(t) {
  if (!t) return
  if (t.legacy !== undefined) timer.stopTimer(t.legacy)
  else clearInterval(t.id)
}

// Angle comes from the clock every frame, so the hand never drifts. If a clock only changes once a
// second, the frames in between advance by the frame interval so the sweep stays smooth.
const sweep = { last: NaN, extra: 0 }
function sweepFrame() {
  if (!ui.second) return
  const ms = clockMs()
  if (!isFinite(ms)) return
  if (ms === sweep.last) sweep.extra = Math.min(sweep.extra + RT.sweep_ms, 999)
  else { sweep.last = ms; sweep.extra = 0 }
  ui.second.setProperty(hmUI.prop.ANGLE, (((ms + sweep.extra) % 60000) / 60000) * 360)
}

function startSweep() {
  stopSweep()
  if (!ui.second) return
  sweep.last = NaN
  sweepFrame()
  sweepTimer = every(RT.sweep_ms, sweepFrame)
}

function stopSweep() {
  cancel(sweepTimer)
  sweepTimer = null
}

function resume() {
  if (IS_AOD) return
  visible = true
  refresh()
  if (refreshTimer === null) refreshTimer = every(REFRESH_MS, refresh)
  startSweep()
  startSheen()
}

function pause() {
  visible = false
  stopSheen()
  cancel(refreshTimer)
  refreshTimer = null
  stopSweep()
}

function bindSensors() {
  const onChange = () => { if (visible) refresh() }
  const listen = (s, method) => { try { if (s && s[method]) s[method](onChange) } catch (e) {} }
  if (ui.battViews || (ui.outer && ui.outer.batt)) listen(batterySensor(), 'onChange')
  if (ui.ringViews || (ui.outer && ui.outer.steps)) {
    listen(stepSensor(), 'onChange')
    listen(calorieSensor(), 'onChange')
  }
  if (ui.hrViews || (ui.outer && ui.outer.hr)) listen(heartSensor(), 'onCurrentChange')
}

function unbindSensors() {
  const off = (s, method) => { try { if (s && s[method]) s[method]() } catch (e) {} }
  off(sensorsLive.battery, 'offChange')
  off(sensorsLive.step, 'offChange')
  off(sensorsLive.calorie, 'offChange')
  off(sensorsLive.heart, 'offCurrentChange')
}

function buildHotZones() {
  taps.forEach((make) => { if (make) make() })
}

WatchFace({
  onInit() {},

  build() {
    if (IS_AOD) {
      safe('aod-dial', () => img(0, 0, RT.dial, RT.dial, 'minimal/dial.png'))
      buildHands()
      return
    }
    ui.background = safe('background', () => img(0, 0, RT.dial, RT.dial, IS_AOD ? 'bg.png' : 'iridescent/00.png'))
    buildComplications()
    buildOuter()
    buildHands()
    bindSensors()
    resume()
    safe('lifecycle', () => hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, { resume_call: resume, pause_call: pause }))
    buildHotZones()
  },

  onDestroy() {
    pause()
    unbindSensors()
    ui = {}
    sensorsLive = {}
    sheen = null
    tiltFrame = 0
    shownFrame = -1
    taps = []
  }
})

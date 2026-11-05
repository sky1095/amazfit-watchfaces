const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

async function main() {
  const source = fs.readFileSync(path.join(__dirname, 'watchface/iridescence.js'), 'utf8')
  const { createSheen, dialFrame, FRAME_COUNT } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
  const localTime = (hour, minute = 0, second = 0) => new Date(2026, 10, 6, hour, minute, second)
  for (const [hour, frame] of [[0, 0], [6, 8], [12, 16], [18, 24], [22, 29]]) {
    assert.equal(dialFrame(localTime(hour)), frame, 'local-time anchor ' + hour)
    assert.equal(dialFrame(localTime(hour), 7), (frame + 7) % FRAME_COUNT, 'combine time and tilt')
  }
  assert.equal(dialFrame(localTime(3)), 4, 'interpolate between day periods')
  assert.equal(dialFrame(localTime(23, 59, 59)), dialFrame(localTime(0)), 'continuous midnight wrap')
  for (let minute = 0; minute < 1440; minute++) {
    const frame = dialFrame(localTime(0, minute), -31)
    assert.ok(Number.isInteger(frame) && frame >= 0 && frame < FRAME_COUNT)
  }
  let callback, savedCallback, time = 0, starts = 0, stops = 0
  let sample = { x: 0, y: 0, z: 981 }
  const frames = []
  const sensor = {
    onChange(fn) { callback = savedCallback = fn },
    offChange(fn) { assert.equal(fn, callback); callback = null },
    getCurrent() { return sample },
    start() { starts++ },
    stop() { stops++ }
  }
  const sheen = createSheen(sensor, frame => frames.push(frame), () => time)
  sheen.start()
  sheen.start()
  assert.equal(starts, 1)
  callback()
  assert.deepEqual(frames, [0])
  sample = { x: 981, y: 0, z: 0 }
  time = 20; callback()
  assert.equal(frames.length, 1, 'throttle rapid samples')
  time = 100; callback()
  assert.notEqual(frames.at(-1), 0, 'tilt changes colour')
  assert.ok(frames.at(-1) < 14, 'smooth the transition')
  const count = frames.length
  for (const invalid of [{ x: NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 9999, y: 0, z: 0 }, null]) {
    sample = invalid; time += 100; callback()
  }
  assert.equal(frames.length, count, 'ignore invalid/freefall/impact samples')
  sheen.stop()
  sheen.stop()
  assert.equal(stops, 1)
  sample = { x: -981, y: 0, z: 0 }; time += 100; savedCallback()
  assert.equal(frames.length, count, 'late events after pause must do nothing')
  sheen.start(); callback()
  assert.equal(frames.at(-1), 5, 'wake starts from the current orientation')
  sheen.stop()
  for (const frame of frames) assert.ok(Number.isInteger(frame) && frame >= 0 && frame < FRAME_COUNT)
  for (let i = 0; i < FRAME_COUNT; i++) {
    assert.ok(fs.existsSync(path.join(__dirname, 'assets/default/analog_face/iridescent', String(i).padStart(2, '0') + '.png')))
  }
  const originalArt = path.join(__dirname, '../meridian-active2/assets')
  for (const file of fs.readdirSync(originalArt, { recursive: true })) {
    const original = path.join(originalArt, file)
    if (fs.statSync(original).isFile()) {
      assert.deepEqual(fs.readFileSync(path.join(__dirname, 'assets', file)), fs.readFileSync(original), 'preserve original art: ' + file)
    }
  }
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json')))
  assert.ok(config.permissions.includes('device:os.accelerometer'))
  assert.notEqual(config.app.appId, JSON.parse(fs.readFileSync(path.join(__dirname, '../meridian-active2/app.json'))).app.appId)
  let detached = false, stopped = false
  const broken = createSheen({ onChange() {}, start() { throw Error('denied') }, offChange() { detached = true }, stop() { stopped = true } }, () => {})
  assert.throws(() => broken.start(), /denied/)
  assert.ok(detached && stopped, 'clean up after a failed sensor start')
  let face
  const widgets = [], errors = []
  const forbidden = () => { throw Error('AOD must not create timers or read sensors') }
  const context = {
    M: JSON.parse(fs.readFileSync(path.join(__dirname, 'watchface/layout.js'), 'utf8').split('export const M = ')[1]),
    hmUI: {
      show_level: { ONAL_AOD: 1 }, widget: { IMG: 'IMG', TIME_POINTER: 'TIME_POINTER' },
      createWidget(type, props) { widgets.push({ type, props }); return {} }
    },
    app: { SCENE_AOD: 1, getScene: () => 1 },
    sensors: new Proxy({}, { get: forbidden }),
    WatchFace(value) { face = value },
    console: { log: value => errors.push(value) },
    setInterval: forbidden, setTimeout: forbidden,
    timer: { createTimer: forbidden }
  }
  const runtime = fs.readFileSync(path.join(__dirname, 'watchface/index.js'), 'utf8').replace(/^import .*$/gm, '')
  vm.runInNewContext(runtime, context)
  face.build()
  face.onDestroy()
  assert.deepEqual(errors, [])
  assert.deepEqual(widgets.map(w => w.type), ['IMG', 'TIME_POINTER', 'IMG'], 'AOD draws only dial, native hands and hub')
  assert.ok(widgets[0].props.src.endsWith('/aod/minimal/dial.png'))
  assert.ok(widgets[1].props.hour_path.endsWith('/aod/minimal/hour.png'))
  assert.ok(widgets[1].props.minute_path.endsWith('/aod/minimal/minute.png'))
  assert.equal(widgets[1].props.second_path, undefined)
  for (const widget of widgets) assert.equal(widget.props.show_level, 1)
  console.log('PASS: local-time phases, interpolation, midnight wrap, tilt mapping, smoothing, throttle, sensor lifecycle, fallback cleanup, assets and identity')
  console.log('PASS: AOD runtime has no sensor access, JS timers, complications or second hand')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

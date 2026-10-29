// Draws Halo's hands, centre cap and icon. Geometry is in 466px screen space (Active 2 Round).
const path = require('path')
const { writePng, capsule } = require('../zeus-tools/png.js')
const out = (f) => path.join(__dirname, 'assets/default', f)
const WHITE = [245, 245, 245], ACCENT = [255, 196, 87], DARK = [20, 20, 20]

// Hour hand: thin neck from the pivot, then a wide rounded blade. Pivot at (8, 112).
writePng(out('hour.png'), 16, 120, (x, y) => {
  const neck = capsule(x, y, 8, 86, 112, 2.5)
  const blade = capsule(x, y, 8, 8, 82, 7)
  return [...WHITE, Math.min(neck, blade) <= 0 ? 1 : 0]
})

// Minute hand: same build, longer. Pivot at (7, 176).
writePng(out('minute.png'), 14, 184, (x, y) => {
  const neck = capsule(x, y, 7, 146, 176, 2.5)
  const blade = capsule(x, y, 7, 7, 142, 6)
  return [...WHITE, Math.min(neck, blade) <= 0 ? 1 : 0]
})

// Second hand: thin accent needle with a short counterweight tail. Pivot at (4, 186).
writePng(out('second.png'), 8, 218, (x, y) => {
  const needle = capsule(x, y, 4, 4, 210, 1.5)
  const weight = capsule(x, y, 4, 194, 210, 3)
  return [...ACCENT, Math.min(needle, weight) <= 0 ? 1 : 0]
})

// Centre cap drawn over all hands.
writePng(out('cap.png'), 20, 20, (x, y) => {
  const d = Math.hypot(x - 10, y - 10)
  if (d <= 3) return [...DARK, 1]
  return [...ACCENT, d <= 9 ? 1 : 0]
})

// App icon: the three rings.
writePng(out('icon.png'), 96, 96, (x, y) => {
  const d = Math.hypot(x - 48, y - 48)
  if (Math.abs(d - 40) < 5) return [255, 166, 43, 1]
  if (Math.abs(d - 29) < 5) return [167, 139, 250, 1]
  if (Math.abs(d - 18) < 5) return [45, 212, 191, 1]
  return [0, 0, 0, d < 47 ? 1 : 0]
})

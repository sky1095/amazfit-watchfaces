"""Generate a 32-phase metallic dial from Meridian's existing background. Requires Pillow."""
import colorsys
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'assets/default/analog_face'


def generate():
    source = Image.open(ART / 'bg.png').convert('RGBA')
    pixels = list(source.getdata())
    width, height = source.size
    field = []
    for y in range(height):
        for x in range(width):
            dx, dy = (x - width / 2) / (width / 2), (y - height / 2) / (height / 2)
            radius = math.hypot(dx, dy)
            field.append((radius, dx * 0.48 + dy * 0.27 + radius * 0.22))
    output = ART / 'iridescent'
    output.mkdir(exist_ok=True)
    for frame in range(32):
        result = []
        for (r, g, b, a), (radius, position) in zip(pixels, field):
            if radius > 0.99:
                result.append((r, g, b, a))
                continue
            phase = position + frame / 32
            hue = (phase + 0.48) % 1
            metal = colorsys.hsv_to_rgb(hue, 0.46, 1)
            # A narrow reflection over dark metal; original markings stay bright.
            reflection = max(0, math.cos(phase * math.tau)) ** 12
            base = (5 + 12 * reflection) * max(0, 1 - radius ** 6)
            ink = max(r, g, b)
            result.append(tuple(round(min(255, base * c + ink * (0.60 + 0.40 * c))) for c in metal) + (a,))
        image = Image.new('RGBA', source.size)
        image.putdata(result)
        image.save(output / f'{frame:02d}.png', optimize=True)
    print('Generated 32 iridescent dial phases')


if __name__ == '__main__':
    generate()

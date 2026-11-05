"""Sparse monochrome AOD using Meridian's original hand silhouettes. Requires Pillow."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ART = Path(__file__).resolve().parents[1] / 'assets/default/analog_face'
OUT = ART / 'aod/minimal'


def generate():
    OUT.mkdir(parents=True, exist_ok=True)
    dial = Image.new('RGB', (466, 466), 'black')
    draw = ImageDraw.Draw(dial)
    for hour in range(12):
        angle = hour * math.tau / 12
        cardinal = hour % 3 == 0
        for offset in ([-3, 3] if cardinal else [0]):
            dx, dy = math.sin(angle), -math.cos(angle)
            tx, ty = math.cos(angle), math.sin(angle)
            inner, outer = (185, 198) if cardinal else (191, 198)
            draw.line([(233 + dx * r + tx * offset, 233 + dy * r + ty * offset)
                       for r in (inner, outer)], fill=(135, 135, 135), width=2)
    # Four short arcs echo Meridian's inner track without illuminating a full ring.
    for start in (28, 118, 208, 298):
        draw.arc((94, 94, 372, 372), start, start + 34, fill=(62, 62, 62), width=1)
    dial.save(OUT / 'dial.png')
    for name in ('hour', 'minute'):
        original = Image.open(ART / f'hands/{name}.png').convert('RGBA')
        mask = original.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
        outline = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(5)))
        hand = Image.new('RGBA', original.size, (255, 255, 255, 0))
        hand.putalpha(outline)
        hand.save(OUT / f'{name}.png')
    hub = Image.new('RGBA', (23, 23))
    ImageDraw.Draw(hub).ellipse((8, 8, 14, 14), outline=(255, 255, 255, 255), width=1)
    hub.save(OUT / 'hub.png')
    total = 0
    for name in ('dial', 'hour', 'minute', 'hub'):
        im = Image.open(OUT / f'{name}.png').convert('RGBA')
        total += sum(1 for r, g, b, a in im.getdata() if a and max(r, g, b))
        assert all(r == g == b for r, g, b, a in im.getdata() if a), name
    fraction = total / (math.pi * 233 ** 2)
    assert fraction < 0.03, fraction
    print(f'AOD illuminated-pixel upper bound: {100 * fraction:.2f}% of circular display')


if __name__ == '__main__':
    generate()

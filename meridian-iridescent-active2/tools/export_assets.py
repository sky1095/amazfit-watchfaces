"""Decode Meridian's 480px store assets, scale them to 466px and write plain PNGs for Zeus.

usage: export_assets.py <unpacked Active Max build>/assets <project>/assets/default
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
import zimg

SRC, OUT = sys.argv[1], sys.argv[2]
S = 466 / 480
R = lambda v: int(math.floor(v * S + 0.5))

n = 0
for root, _, files in os.walk(SRC):
    for fn in files:
        if not fn.endswith('.png'):
            continue
        im = zimg.decode(open(os.path.join(root, fn), 'rb').read())
        im = im.convert('RGBa').resize((R(im.size[0]), R(im.size[1])), Image.LANCZOS).convert('RGBA')
        dst = os.path.join(OUT, os.path.relpath(os.path.join(root, fn), SRC))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst)
        n += 1
print('exported', n)

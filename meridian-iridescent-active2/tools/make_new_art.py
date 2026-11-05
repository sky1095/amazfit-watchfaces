"""Art for the complications added in this port (calories, PAI, distance, sunrise/sunset).

Built from Meridian's own 466px art so arcs and rings match: the gauge frames are the heart-rate
frames with the "BPM" label swapped, the plain ones reuse the date ring. Labels are Inter SemiBold
sized to Meridian's label cap height. Always-on copies are the normal art at Meridian's AOD
brightness (about 90%).

usage: make_new_art.py <project>/assets/default/analog_face <Inter-SemiBold.ttf>
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

A, FONT = sys.argv[1], sys.argv[2]
AOD = 0.9
LABEL_GREY = 122
SS = 4  # supersampling for text


def load(rel):
    return Image.open(os.path.join(A, rel)).convert('RGBA')


def save(im, rel):
    p = os.path.join(A, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)


def dim(im, k=AOD):
    r, g, b, a = im.split()
    f = lambda v: int(v * k + 0.5)
    return Image.merge('RGBA', (r.point(f), g.point(f), b.point(f), a))


def label(text, cap=9, tracking=0.7, grey=LABEL_GREY):
    """Grey caps text, cropped to ink, cap height `cap` px."""
    size = cap / 0.727 * SS
    font = ImageFont.truetype(FONT, int(round(size)))
    widths = [font.getlength(c) for c in text]
    W = int(sum(widths) + tracking * SS * (len(text) - 1)) + 8 * SS
    H = int(size * 1.6)
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    x = 4 * SS
    for c, w in zip(text, widths):
        d.text((x, 0), c, fill=255, font=font)
        x += w + tracking * SS
    im = im.crop(im.getbbox())
    im = im.resize((max(1, round(im.size[0] / SS)), cap), Image.LANCZOS)
    out = Image.new('RGBA', im.size, (grey, grey, grey, 0))
    out.putalpha(im)
    return out


def put_label(base, text, top):
    im = base.copy()
    lab = label(text)
    im.alpha_composite(lab, ((im.size[0] - lab.size[0]) // 2, top))
    return im


def erase(im, box):
    im = im.copy()
    ImageDraw.Draw(im).rectangle(box, fill=(0, 0, 0, 0))
    return im


GAUGE_LABEL = (28, 64, 64, 79)  # around "BPM" (ink 33..59 x 67..75)
GAUGE_TOP = 67
RING_TOP = 57                   # where SpO2 prints "O2"


def gauge(key, text):
    # the AOD heart-rate frames are already dimmed, so only the new label is
    for sub, k in (('', 1), ('aod/', AOD)):
        lab = dim(label(text), k)
        for i in range(10):
            im = erase(load(f'{sub}hr/{i:02d}.png'), GAUGE_LABEL)
            im.alpha_composite(lab, ((im.size[0] - lab.size[0]) // 2, GAUGE_TOP))
            save(im, f'{sub}{key}/{i:02d}.png')


def ring(rel, text):
    base = load('date/base.png')
    im = put_label(base, text, RING_TOP)
    save(im, rel)
    save(dim(im), 'aod/' + rel)
    return im


def glyph(font, name, dots):
    """Round dots in the digit colour; `dots` are row ranges (top, bottom) inclusive."""
    h = Image.open(os.path.join(A, f'fonts/{font}/0.png')).size[1]
    w = 7
    im = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(im)
    for t, b in dots:
        d.rounded_rectangle((1.5 * SS, t * SS, 5.5 * SS - 1, (b + 1) * SS - 1), radius=1.6 * SS, fill=255)
    im = im.resize((w, h), Image.LANCZOS)
    for sub, k in (('', 1), ('aod/', AOD)):
        g = int(232 * k)
        out = Image.new('RGBA', (w, h), (g, g, g, 0))
        out.putalpha(im)
        save(out, f'{sub}fonts/{font}/{name}.png')


def text_row(font, s):
    ims = []
    for c in s:
        n = {'.': 'dot', ':': 'colon', '-': 'minus', '%': 'pct'}.get(c, c)
        ims.append(load(f'fonts/{font}/{n}.png'))
    w = sum(i.size[0] for i in ims)
    out = Image.new('RGBA', (w, ims[0].size[1]), (0, 0, 0, 0))
    x = 0
    for i in ims:
        out.alpha_composite(i, (x, 0))
        x += i.size[0]
    return out


def preview(rel, base, font, sample, dy):
    im = base.copy()
    row = text_row(font, sample)
    cx = cy = im.size[0] / 2
    im.alpha_composite(row, (round(cx - row.size[0] / 2), round(cy + dy - row.size[1] / 2)))
    save(im, 'preview/' + rel)
    save(dim(im), 'aod/preview/' + rel)


# glyphs for distance (decimal point) and sunrise/sunset (colon), digits span rows 1..17
glyph('spo2_value', 'dot', [(14, 17)])
glyph('spo2_value', 'colon', [(5, 8), (14, 17)])

gauge('kcal', 'KCAL')
gauge('pai', 'PAI')
dist = ring('dist/base.png', 'DIST')
rise = ring('sun/rise.png', 'SUNRISE')
ring('sun/set.png', 'SUNSET')

# edit-list previews with sample values (value font dy -3, small font dy -12 as in Meridian)
preview('kcal.png', load('kcal/06.png'), 'value', '320', -3)
preview('pai.png', load('pai/04.png'), 'value', '42', -3)
preview('dist.png', dist, 'spo2_value', '5.2', -12)
preview('sun.png', rise, 'spo2_value', '6:12', -12)
print('ok')

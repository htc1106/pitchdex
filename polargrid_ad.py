from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, os

W, H = 1080, 1080
img = Image.new("RGB", (W, H), (0, 0, 0))
draw = ImageDraw.Draw(img)

# --- Background glows (matching TokenRouter style: dark bg + coloured light blobs) ---
def radial_glow(base, cx, cy, r, color, alpha=180):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    steps = 60
    for i in range(steps, 0, -1):
        ratio = i / steps
        a = int(alpha * (ratio ** 2.2))
        cr = int(color[0] * ratio)
        cg = int(color[1] * ratio)
        cb = int(color[2] * ratio)
        rr = int(r * ratio)
        ld.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(cr, cg, cb, a))
    base.paste(Image.alpha_composite(Image.new("RGBA", base.size, (0,0,0,0)), layer), mask=layer.split()[3])

img_rgba = img.convert("RGBA")

# PolarGrid pink/magenta glow — top left
radial_glow(img_rgba, 180, 160, 520, (220, 20, 120), alpha=160)
# Cooler blue-purple glow — bottom right
radial_glow(img_rgba, 880, 920, 480, (60, 20, 180), alpha=130)
# Subtle teal accent — top right
radial_glow(img_rgba, 900, 80, 320, (0, 160, 180), alpha=80)

img = img_rgba.convert("RGB")
# Blur for softness
img = img.filter(ImageFilter.GaussianBlur(radius=2))
draw = ImageDraw.Draw(img)

# --- Logo image ---
logo_path = "/Users/henrychen/.openclaw/media/inbound/131866ed-5eb8-4d67-a216-45bda1c2f2bb.png"
logo = Image.open(logo_path).convert("RGBA")
# Scale logo to width ~280px
logo_w = 280
ratio = logo_w / logo.width
logo_h = int(logo.height * ratio)
logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
logo_x = (W - logo_w) // 2
logo_y = 72
img.paste(logo, (logo_x, logo_y), logo.split()[3])

# --- Fonts ---
def best_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/SFNSDisplay.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except:
                pass
    return ImageFont.load_default()

font_headline = best_font(94)
font_sub = best_font(44)
font_tag = best_font(34)
font_cta = best_font(30)

def draw_text_centered(draw, y, text, font, fill, img_w=W):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (img_w - tw) // 2
    draw.text((x, y), text, font=font, fill=fill)
    return bbox[3] - bbox[1]

# --- Headline ---
# "Your voice agent's" — line 1
# "1.2-second pause" — line 2, pink highlight
# "is killing conversions." — line 3

line1 = "Your voice agent's"
line2 = "1.2-second pause"
line3 = "is killing conversions."

y = 310
h1 = draw_text_centered(draw, y, line1, font_headline, (255, 255, 255))
y += h1 + 12

# Pink highlight box behind line 2
bbox2 = draw.textbbox((0, 0), line2, font=font_headline)
tw2 = bbox2[2] - bbox2[0]
x2 = (W - tw2) // 2
pad = 14
draw.rectangle([x2 - pad, y - 6, x2 + tw2 + pad, y + (bbox2[3] - bbox2[1]) + 6], fill=(220, 20, 120))
draw.text((x2, y), line2, font=font_headline, fill=(255, 255, 255))
y += (bbox2[3] - bbox2[1]) + 12

h3 = draw_text_centered(draw, y, line3, font_headline, (255, 255, 255))
y += h3 + 52

# --- Subline ---
sub = "Sub-100ms inference. Edge-native. No cloud lag."
draw_text_centered(draw, y, sub, font_sub, (200, 200, 200))
y += 52 + 52

# --- CTA button ---
cta_text = "polargrid.ai"
cta_bbox = draw.textbbox((0, 0), cta_text, font=font_cta)
cta_w = cta_bbox[2] - cta_bbox[0]
cta_h = cta_bbox[3] - cta_bbox[1]
btn_pad_x, btn_pad_y = 38, 18
btn_x = (W - cta_w - btn_pad_x * 2) // 2
btn_y = y
draw.rounded_rectangle(
    [btn_x, btn_y, btn_x + cta_w + btn_pad_x * 2, btn_y + cta_h + btn_pad_y * 2],
    radius=40, outline=(255, 255, 255), width=2
)
draw.text((btn_x + btn_pad_x, btn_y + btn_pad_y), cta_text, font=font_cta, fill=(255, 255, 255))

# --- Save ---
out = "/Users/henrychen/openclaw-workspace/polargrid_booth_ad.png"
img.save(out, "PNG")
print(f"Saved: {out}")

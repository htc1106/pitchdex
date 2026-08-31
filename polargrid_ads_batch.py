from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os, math

W, H = 1080, 1080
LOGO_PATH = "/Users/henrychen/.openclaw/media/inbound/131866ed-5eb8-4d67-a216-45bda1c2f2bb.png"
OUT_DIR = "/Users/henrychen/openclaw-workspace/polargrid_ads"
os.makedirs(OUT_DIR, exist_ok=True)

PINK = (220, 20, 120)
WHITE = (255, 255, 255)
GRAY = (190, 190, 200)
DARK = (0, 0, 0)


def best_font(size):
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except:
                pass
    return ImageFont.load_default()


def radial_glow(base, cx, cy, r, color, alpha=180):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for i in range(60, 0, -1):
        ratio = i / 60
        a = int(alpha * (ratio ** 2.2))
        rr = int(r * ratio)
        ld.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                   fill=(int(color[0]*ratio), int(color[1]*ratio), int(color[2]*ratio), a))
    base.paste(Image.alpha_composite(Image.new("RGBA", base.size, (0,0,0,0)), layer), mask=layer.split()[3])


def make_base(glow1_pos, glow1_color, glow2_pos, glow2_color, glow3_pos=None, glow3_color=None):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    radial_glow(img, *glow1_pos, 520, glow1_color, alpha=160)
    radial_glow(img, *glow2_pos, 480, glow2_color, alpha=130)
    if glow3_pos:
        radial_glow(img, *glow3_pos, 300, glow3_color, alpha=80)
    img = img.convert("RGB").filter(ImageFilter.GaussianBlur(radius=2))
    return img


def paste_logo(img, y=72, width=260):
    logo = Image.open(LOGO_PATH).convert("RGBA")
    ratio = width / logo.width
    logo = logo.resize((width, int(logo.height * ratio)), Image.LANCZOS)
    x = (W - logo.width) // 2
    img.paste(logo, (x, y), logo.split()[3])
    return y + logo.height


def draw_centered(draw, y, text, font, fill=WHITE, max_width=None):
    if max_width is None:
        max_width = W - 80
    # Word wrap
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        bb = draw.textbbox((0,0), test, font=font)
        if bb[2] - bb[0] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    
    total_h = 0
    for line in lines:
        bb = draw.textbbox((0,0), line, font=font)
        lh = bb[3] - bb[1]
        tw = bb[2] - bb[0]
        x = (W - tw) // 2
        draw.text((x, y + total_h), line, font=font, fill=fill)
        total_h += lh + 8
    return y + total_h


def draw_highlight_line(img, draw, y, text, font):
    bb = draw.textbbox((0,0), text, font=font)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    x = (W - tw) // 2
    pad = 14
    draw.rectangle([x - pad, y - 6, x + tw + pad, y + th + 6], fill=PINK)
    draw.text((x, y), text, font=font, fill=WHITE)
    return y + th + 8


def draw_pill_button(draw, y, text, font, outline=WHITE):
    bb = draw.textbbox((0,0), text, font=font)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    px, py = 40, 16
    bx = (W - tw - px*2) // 2
    draw.rounded_rectangle([bx, y, bx + tw + px*2, y + th + py*2], radius=40, outline=outline, width=2)
    draw.text((bx + px, y + py), text, font=font, fill=WHITE)
    return y + th + py*2 + 10


def draw_tag_badge(draw, y, text, font_sm, color=PINK):
    bb = draw.textbbox((0,0), text, font=font_sm)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    x = (W - tw - 28) // 2
    draw.rounded_rectangle([x, y, x + tw + 28, y + th + 14], radius=20, fill=color)
    draw.text((x + 14, y + 7), text, font=font_sm, fill=WHITE)
    return y + th + 14 + 16


# ── Asset 1: ElevenLabs Alternative ──────────────────────────────────────────
def asset_elevenlabs():
    img = make_base((200, 180), (220, 20, 120), (860, 900), (60, 20, 180), (920, 100), (0, 140, 200))
    draw = ImageDraw.Draw(img)
    f_big = best_font(88)
    f_mid = best_font(46)
    f_sm = best_font(30)
    f_tag = best_font(26)

    y = paste_logo(img, y=68, width=250)
    y += 38

    y = draw_tag_badge(draw, y, "ElevenLabs Alternative", f_tag)
    y += 10

    y = draw_centered(draw, y, "Same voice quality.", f_big)
    y += 4
    y = draw_highlight_line(img, draw, y, "Zero cloud latency.", f_big)
    y += 36

    y = draw_centered(draw, y, "Edge-native inference. Start with $500 free credits.", f_mid, fill=GRAY)
    y += 52

    draw_pill_button(draw, y, "polargrid.ai", f_sm)
    img.save(f"{OUT_DIR}/01_elevenlabs_alternative.png")
    print("✓ 01_elevenlabs_alternative.png")


# ── Asset 2: VAPI / Voice Agent Platform Alternative ─────────────────────────
def asset_vapi():
    img = make_base((900, 200), (60, 20, 180), (180, 880), (220, 20, 120), (500, 100), (0, 180, 160))
    draw = ImageDraw.Draw(img)
    f_big = best_font(80)
    f_mid = best_font(44)
    f_sm = best_font(30)
    f_tag = best_font(26)

    y = paste_logo(img, y=68, width=250)
    y += 38

    y = draw_tag_badge(draw, y, "VAPI Alternative", f_tag)
    y += 10

    y = draw_centered(draw, y, "Your voice agent deserves", f_big)
    y += 4
    y = draw_highlight_line(img, draw, y, "sub-100ms inference.", f_big)
    y += 12
    y = draw_centered(draw, y, "Not another cloud hop.", f_big)
    y += 40

    y = draw_centered(draw, y, "PolarGrid runs at the edge — your latency is the node's latency.", f_mid, fill=GRAY)
    y += 52

    draw_pill_button(draw, y, "polargrid.ai  →  $500 free credits", f_sm)
    img.save(f"{OUT_DIR}/02_vapi_alternative.png")
    print("✓ 02_vapi_alternative.png")


# ── Asset 3: Latency / Problem (the 1.2s pause) ───────────────────────────────
def asset_latency():
    img = make_base((180, 160), (220, 20, 120), (880, 920), (60, 20, 180), (900, 80), (0, 160, 180))
    draw = ImageDraw.Draw(img)
    f_big = best_font(94)
    f_mid = best_font(44)
    f_sm = best_font(30)

    y = paste_logo(img, y=68, width=250)
    y += 52

    y = draw_centered(draw, y, "Your voice agent's", f_big)
    y += 4
    y = draw_highlight_line(img, draw, y, "1.2-second pause", f_big)
    y += 4
    y = draw_centered(draw, y, "is killing conversions.", f_big)
    y += 48

    y = draw_centered(draw, y, "Sub-100ms inference. Edge-native. No cloud lag.", f_mid, fill=GRAY)
    y += 52

    draw_pill_button(draw, y, "polargrid.ai", f_sm)
    img.save(f"{OUT_DIR}/03_latency_problem.png")
    print("✓ 03_latency_problem.png")


# ── Asset 4: LLM / Inference API Developer ────────────────────────────────────
def asset_inference_api():
    img = make_base((500, 100), (0, 160, 200), (500, 980), (180, 10, 100), (100, 500), (40, 10, 140))
    draw = ImageDraw.Draw(img)
    f_big = best_font(82)
    f_code = best_font(38)
    f_mid = best_font(40)
    f_sm = best_font(28)
    f_tag = best_font(24)

    y = paste_logo(img, y=60, width=230)
    y += 40

    y = draw_tag_badge(draw, y, "Inference API", f_tag, color=(30, 100, 200))
    y += 14

    y = draw_centered(draw, y, "OpenAI-compatible.", f_big)
    y += 4
    y = draw_highlight_line(img, draw, y, "Edge-native.", f_big)
    y += 4
    y = draw_centered(draw, y, "One endpoint.", f_big)
    y += 36

    # Code-style line
    code_text = "POST /v1/chat/completions"
    bb = draw.textbbox((0,0), code_text, font=f_code)
    tw = bb[2]-bb[0]; th = bb[3]-bb[1]
    cx = (W - tw - 40) // 2
    draw.rounded_rectangle([cx, y, cx+tw+40, y+th+20], radius=10, fill=(20,20,40))
    draw.text((cx+20, y+10), code_text, font=f_code, fill=(100, 220, 255))
    y += th + 20 + 36

    y = draw_centered(draw, y, "Plug in. Ship faster. $500 free credits.", f_mid, fill=GRAY)
    y += 44

    draw_pill_button(draw, y, "polargrid.ai", f_sm)
    img.save(f"{OUT_DIR}/04_inference_api.png")
    print("✓ 04_inference_api.png")


# ── Asset 5: Reddit/Community — Casual tone ───────────────────────────────────
def asset_reddit():
    img = make_base((200, 900), (220, 20, 120), (880, 200), (60, 20, 160), (540, 500), (0, 100, 160))
    draw = ImageDraw.Draw(img)
    f_big = best_font(76)
    f_mid = best_font(42)
    f_sm = best_font(30)
    f_tag = best_font(24)

    y = paste_logo(img, y=68, width=230)
    y += 44

    y = draw_tag_badge(draw, y, "Built for voice AI devs", f_tag, color=(100, 30, 180))
    y += 14

    y = draw_centered(draw, y, "We ran the benchmarks.", f_big)
    y += 4
    y = draw_highlight_line(img, draw, y, "Cloud adds 800ms+.", f_big)
    y += 4
    y = draw_centered(draw, y, "Every. Single. Call.", f_big)
    y += 42

    y = draw_centered(draw, y, "PolarGrid runs inference at the edge.\nLatency is the node's. Not the cloud's.", f_mid, fill=GRAY)
    y += 50

    y = draw_centered(draw, y, "Open source friendly · OpenAI-compatible · $500 to start", f_sm, fill=(160, 160, 170))
    y += 40

    draw_pill_button(draw, y, "polargrid.ai", f_sm)
    img.save(f"{OUT_DIR}/05_reddit_community.png")
    print("✓ 05_reddit_community.png")


# ── Asset 6: LinkedIn Banner (1200×627) ───────────────────────────────────────
def asset_linkedin_banner():
    LW, LH = 1200, 627
    img = Image.new("RGBA", (LW, LH), (0,0,0,255))
    radial_glow(img, 200, 200, 500, (220, 20, 120), alpha=150)
    radial_glow(img, 1000, 500, 450, (60, 20, 180), alpha=120)
    radial_glow(img, 1100, 80, 280, (0, 160, 200), alpha=80)
    img = img.convert("RGB").filter(ImageFilter.GaussianBlur(radius=2))
    draw = ImageDraw.Draw(img)

    # Logo left
    logo = Image.open(LOGO_PATH).convert("RGBA")
    lw = 200
    lr = lw / logo.width
    logo = logo.resize((lw, int(logo.height*lr)), Image.LANCZOS)
    img.paste(logo, (60, 50), logo.split()[3])

    f_big = best_font(72)
    f_mid = best_font(34)
    f_sm = best_font(26)

    y = 150
    # Line 1
    t1 = "Edge inference."
    bb = draw.textbbox((0,0), t1, font=f_big)
    draw.text((60, y), t1, font=f_big, fill=WHITE)
    y += bb[3]-bb[1]+8

    # Highlight line 2
    t2 = "Zero cloud lag."
    bb2 = draw.textbbox((0,0), t2, font=f_big)
    tw2, th2 = bb2[2]-bb2[0], bb2[3]-bb2[1]
    draw.rectangle([60-8, y-4, 60+tw2+8, y+th2+4], fill=PINK)
    draw.text((60, y), t2, font=f_big, fill=WHITE)
    y += th2 + 16

    # Sub
    draw.text((60, y), "OpenAI-compatible · $500 free credits", font=f_mid, fill=GRAY)
    y += 50

    # CTA
    cta = "polargrid.ai"
    bb3 = draw.textbbox((0,0), cta, font=f_sm)
    tw3, th3 = bb3[2]-bb3[0], bb3[3]-bb3[1]
    draw.rounded_rectangle([60, y, 60+tw3+60, y+th3+28], radius=30, outline=WHITE, width=2)
    draw.text((60+30, y+14), cta, font=f_sm, fill=WHITE)

    img.save(f"{OUT_DIR}/06_linkedin_banner_1200x627.png")
    print("✓ 06_linkedin_banner_1200x627.png")


if __name__ == "__main__":
    asset_elevenlabs()
    asset_vapi()
    asset_latency()
    asset_inference_api()
    asset_reddit()
    asset_linkedin_banner()
    print("\nAll assets saved to:", OUT_DIR)

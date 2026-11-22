
from pathlib import Path
from PIL import Image, ImageDraw

# SplitMate PWA icon generator
# Requires Pillow only — no CairoSVG

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

BLUE = "#0077B6"
CYAN = "#90E0EF"
WHITE = "#FFFFFF"


def create_icon(size, maskable=False):
    # Draw at high resolution for smooth edges
    canvas_size = 1024

    image = Image.new(
        "RGB",
        (canvas_size, canvas_size),
        BLUE
    )

    draw = ImageDraw.Draw(image)

    # Keep maskable icon content inside safe zone
    scale = 0.72 if maskable else 1.0

    def point(x, y):
        return (
            int(512 + (x - 512) * scale),
            int(512 + (y - 512) * scale)
        )

    def rectangle(box, fill, radius=0):
        x1, y1 = point(box[0], box[1])
        x2, y2 = point(box[2], box[3])

        draw.rounded_rectangle(
            (x1, y1, x2, y2),
            radius=int(radius * scale),
            fill=fill
        )

    # White receipt
    receipt_points = [
        (300, 220),
        (724, 220),
        (724, 790),
        (650, 750),
        (580, 790),
        (512, 750),
        (444, 790),
        (374, 750),
        (300, 790),
    ]

    draw.polygon(
        [point(x, y) for x, y in receipt_points],
        fill=WHITE
    )

    # Receipt heading
    rectangle(
        (365, 305, 659, 340),
        BLUE,
        14
    )

    # Receipt line
    rectangle(
        (365, 385, 565, 412),
        CYAN,
        12
    )

    # Split symbol
    cx, cy = point(512, 585)

    line_width = int(38 * scale)

    draw.line(
        [point(512, 490), point(512, 680)],
        fill=BLUE,
        width=line_width
    )

    draw.line(
        [point(425, 585), point(599, 585)],
        fill=BLUE,
        width=line_width
    )

    # Smooth downscaling
    image = image.resize(
        (size, size),
        Image.Resampling.LANCZOS
    )

    return image


def save_icon(filename, size, maskable=False):
    icon = create_icon(
        size=size,
        maskable=maskable
    )

    output_path = PUBLIC_DIR / filename

    icon.save(output_path, "PNG")

    print(f"Created: {output_path}")


# Android / Chrome icons
save_icon("pwa-192x192.png", 192)
save_icon("pwa-512x512.png", 512)

# Android maskable icon
save_icon(
    "pwa-maskable-512x512.png",
    512,
    maskable=True
)

# Apple touch icon
save_icon("apple-touch-icon.png", 180)

# Browser favicon
favicon = create_icon(64)
favicon.save(
    PUBLIC_DIR / "favicon.ico",
    format="ICO",
    sizes=[
        (16, 16),
        (32, 32),
        (48, 48),
        (64, 64)
    ]
)

print("\nSplitMate PWA icons generated successfully!")

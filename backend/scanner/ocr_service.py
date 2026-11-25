
# scanner/ocr_service.py

from io import BytesIO
from decimal import Decimal, InvalidOperation
from statistics import median
import re

import cv2
import numpy as np
import pytesseract

from PIL import Image, ImageOps
from pytesseract import Output

from .receipt_parser import parse_receipt
from .receipt_validator import validate_receipt


import os
import platform
import pytesseract

if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = r"D:\Tools\tesseract.exe"
else:
    pytesseract.pytesseract.tesseract_cmd = os.getenv(
        "TESSERACT_CMD", "/usr/bin/tesseract"
    )

# The parser remains responsible for deciding
# whether an amount is valid.
NUMBER_RE = re.compile(r"\d")

SUMMARY_RE = re.compile(
    r"^(?:sub[\s-]*total|grand\s*total|"
    r"net\s*total|total|cgst|sgst|igst|"
    r"discount|less|service\s*charge)\b",
    re.IGNORECASE,
)

TABLE_HEADER_RE = re.compile(
    r"\b(?:item|description|particulars)\b"
    r".*\b(?:price|qty|quantity|amount|total)\b",
    re.IGNORECASE,
)


def prepare_image(image_file):
    image = Image.open(BytesIO(image_file.read()))
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")

    if image.width < 1200:
        scale = 1200 / image.width

        image = image.resize(
            (
                1200,
                max(1, round(image.height * scale))
            ),
            Image.Resampling.LANCZOS,
        )

    if max(image.size) > 4000:
        scale = 4000 / max(image.size)

        image = image.resize(
            (
                max(1, round(image.width * scale)),
                max(1, round(image.height * scale)),
            ),
            Image.Resampling.LANCZOS,
        )

    return np.array(image)


def create_variants(rgb_image):
    gray = cv2.cvtColor(
        rgb_image,
        cv2.COLOR_RGB2GRAY,
    )

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8),
    )

    enhanced = clahe.apply(gray)

    blurred = cv2.GaussianBlur(
        enhanced,
        (3, 3),
        0,
    )

    adaptive = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    _, otsu = cv2.threshold(
        enhanced,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    return {
        "grayscale": gray,
        "enhanced": enhanced,
        "adaptive": adaptive,
        "otsu": otsu,
    }


def extract_words(data):
    words = []

    for index, raw_text in enumerate(data["text"]):
        word = str(raw_text).strip()

        if not word:
            continue

        try:
            confidence = float(
                data["conf"][index]
            )
        except (ValueError, TypeError):
            confidence = -1

        left = int(data["left"][index])
        top = int(data["top"][index])
        width = int(data["width"][index])
        height = int(data["height"][index])

        if width <= 0 or height <= 0:
            continue

        words.append({
            "text": word,
            "left": left,
            "top": top,
            "right": left + width,
            "bottom": top + height,
            "center_y": top + height / 2,
            "height": height,
            "confidence": confidence,
        })

    return words


def reconstruct_lines(data):
    """
    Group OCR words by their vertical positions.

    This helps when Tesseract places the name,
    quantity and price in separate text blocks
    even though they belong to the same row.
    """

    words = extract_words(data)

    if not words:
        return []

    heights = [
        word["height"]
        for word in words
    ]

    typical_height = median(heights)

    # Keep the threshold proportional to the
    # actual text size rather than the receipt size.
    tolerance = max(
        4,
        min(18, typical_height * 0.45),
    )

    words.sort(
        key=lambda word: (
            word["center_y"],
            word["left"],
        )
    )

    groups = []

    for word in words:
        best_group = None
        best_distance = float("inf")

        for group in groups:
            distance = abs(
                word["center_y"] -
                group["center_y"]
            )

            if (
                distance <= tolerance
                and distance < best_distance
            ):
                best_group = group
                best_distance = distance

        if best_group is None:
            groups.append({
                "center_y": word["center_y"],
                "words": [word],
            })
        else:
            best_group["words"].append(word)

            centers = [
                entry["center_y"]
                for entry in best_group["words"]
            ]

            best_group["center_y"] = (
                sum(centers) / len(centers)
            )

    lines = []

    for group in groups:
        row_words = sorted(
            group["words"],
            key=lambda word: word["left"],
        )

        text = " ".join(
            word["text"]
            for word in row_words
        )

        valid_confidences = [
            word["confidence"]
            for word in row_words
            if word["confidence"] >= 0
        ]

        confidence = (
            sum(valid_confidences)
            / len(valid_confidences)
            if valid_confidences
            else 0.0
        )

        lines.append({
            "text": text,
            "top": min(
                word["top"]
                for word in row_words
            ),
            "bottom": max(
                word["bottom"]
                for word in row_words
            ),
            "left": min(
                word["left"]
                for word in row_words
            ),
            "right": max(
                word["right"]
                for word in row_words
            ),
            "confidence": round(
                confidence, 2
            ),
            "words": row_words,
        })

    lines.sort(
        key=lambda line: (
            line["top"],
            line["left"],
        )
    )

    return lines


def get_confidence(data):
    values = []

    for raw in data["conf"]:
        try:
            value = float(raw)
        except (TypeError, ValueError):
            continue

        if value >= 0:
            values.append(value)

    if not values:
        return 0.0

    return round(
        sum(values) / len(values),
        2,
    )


def numeric_ocr(crop, psm=7):
    if crop.size == 0:
        return ""

    if len(crop.shape) == 3:
        crop = cv2.cvtColor(
            crop,
            cv2.COLOR_RGB2GRAY,
        )

    crop = cv2.copyMakeBorder(
        crop,
        10,
        10,
        10,
        10,
        cv2.BORDER_CONSTANT,
        value=255,
    )

    crop = cv2.resize(
        crop,
        None,
        fx=3,
        fy=3,
        interpolation=cv2.INTER_CUBIC,
    )

    return pytesseract.image_to_string(
        crop,
        config=(
            f"--psm {psm} "
            "-c tessedit_char_whitelist=0123456789.,"
        ),
    ).strip()


def get_price_candidates(image, line):
    """
    Scan the rightmost amount-like word separately.

    Return alternatives for review, not automatic
    replacements.
    """

    words = line["words"]

    numeric_words = [
        word
        for word in words
        if NUMBER_RE.search(word["text"])
    ]

    if not numeric_words:
        return []

    # The rightmost numeric token is often the
    # line total, but not always.
    target = max(
        numeric_words,
        key=lambda word: word["right"],
    )

    image_height, image_width = image.shape[:2]

    x1 = max(
        0,
        target["left"] - 5,
    )
    x2 = min(
        image_width,
        target["right"] + 5,
    )
    y1 = max(
        0,
        target["top"] - 5,
    )
    y2 = min(
        image_height,
        target["bottom"] + 5,
    )

    crop = image[y1:y2, x1:x2]

    if crop.size == 0:
        return []

    candidates = [
        target["text"],
    ]

    for psm in (7, 8):
        reading = numeric_ocr(
            crop,
            psm=psm,
        )

        if reading:
            candidates.append(reading)

    return list(
        dict.fromkeys(candidates)
    )


def to_decimal(value):
    if value is None:
        return None

    try:
        result = Decimal(str(value))

        if not result.is_finite():
            return None

        return result
    except (InvalidOperation, TypeError, ValueError):
        return None


def score_result(parsed, validation, confidence):
    """
    Score a complete OCR pass.

    A consistent subtotal is useful evidence,
    but it does not guarantee every item is correct.
    """

    items = parsed["items"]

    score = min(len(items), 40) * 12

    score += confidence * 0.15

    missing = len(
        validation.get(
            "missing_price_indices", []
        )
    )

    score -= missing * 12

    if validation["subtotal_matches"] is True:
        score += 100

    elif validation["subtotal_matches"] is False:
        score -= 70

    if parsed["summary"].get("subtotal"):
        score += 15

    if parsed["summary"].get("total"):
        score += 10

    for item in items:
        price = to_decimal(
            item.get("total_price")
        )

        if price is None:
            continue

        if price <= 0:
            score -= 20

        if item.get("needs_review"):
            score -= 3

    return score


def normalize_name(name):
    return re.sub(
        r"\s+",
        " ",
        str(name).lower().strip(),
    )


def find_item_line(item, lines):
    """
    Match an extracted item to an OCR row.

    This is a best-effort match. Duplicate food
    names may appear more than once on a receipt.
    """

    name = normalize_name(
        item.get("name", "")
    )

    if not name:
        return None

    for line in lines:
        line_text = normalize_name(
            line["text"]
        )

        if name in line_text:
            return line

    # Wrapped names may span multiple rows.
    name_words = name.split()

    if not name_words:
        return None

    for line in lines:
        line_text = normalize_name(
            line["text"]
        )

        if name_words[0] in line_text:
            return line

    return None


def collect_price_candidates(
    image,
    lines,
    items,
):
    """
    Attach numeric OCR alternatives to items.

    These are diagnostics, not verified prices.
    """

    candidates = []

    used_lines = set()

    for index, item in enumerate(items):
        matched = None
        matched_index = None

        name = normalize_name(
            item.get("name", "")
        )

        for line_index, line in enumerate(lines):
            if line_index in used_lines:
                continue

            text = normalize_name(
                line["text"]
            )

            if name and name in text:
                matched = line
                matched_index = line_index
                break

        if matched is None:
            matched = find_item_line(
                item,
                [
                    line
                    for line_index, line
                    in enumerate(lines)
                    if line_index not in used_lines
                ],
            )

            if matched is not None:
                matched_index = next(
                    (
                        i
                        for i, line
                        in enumerate(lines)
                        if line is matched
                    ),
                    None,
                )

        if matched is None:
            continue

        if matched_index is not None:
            used_lines.add(matched_index)

        alternatives = get_price_candidates(
            image,
            matched,
        )

        candidates.append({
            "item_index": index,
            "item_name": item["name"],
            "line": matched["text"],
            "alternatives": alternatives,
        })

    return candidates


def read_receipt(image_file):
    rgb_image = prepare_image(image_file)

    variants = create_variants(
        rgb_image
    )

    results = []

    # Keep the existing eight-pass approach.
    for variant_name, image in variants.items():
        for psm in (4, 6):
            data = pytesseract.image_to_data(
                image,
                config=f"--psm {psm}",
                output_type=Output.DICT,
            )

            lines = reconstruct_lines(
                data
            )

            raw_text = "\n".join(
                line["text"]
                for line in lines
            )

            parsed = parse_receipt(
                raw_text
            )

            validation = validate_receipt(
                parsed["items"],
                parsed["summary"],
            )

            confidence = get_confidence(
                data
            )

            score = score_result(
                parsed,
                validation,
                confidence,
            )

            results.append({
                "variant": variant_name,
                "psm": psm,
                "raw_text": raw_text,
                "lines": lines,
                "image": image,
                "parsed": parsed,
                "validation": validation,
                "confidence": confidence,
                "score": score,
            })

    best = max(
        results,
        key=lambda result: result["score"],
    )

    items = [
        dict(item)
        for item in best["parsed"]["items"]
    ]

    price_candidates = collect_price_candidates(
        best["image"],
        best["lines"],
        items,
    )

    # Compare numeric alternatives with the
    # selected OCR value. A disagreement indicates
    # uncertainty; do not overwrite the amount.
    for candidate in price_candidates:
        index = candidate["item_index"]

        if index >= len(items):
            continue

        current_price = to_decimal(
            items[index].get("total_price")
        )

        if current_price is None:
            items[index]["needs_review"] = True
            continue

        # Keep alternatives available to the
        # frontend without treating them as facts.
        items[index]["ocr_alternatives"] = (
            candidate["alternatives"]
        )

    # Revalidate after preparing the final items.
    validation = validate_receipt(
        items,
        best["parsed"]["summary"],
    )

    return {
        "raw_text": best["raw_text"],
        "items": items,
        "summary": best["parsed"]["summary"],
        "validation": validation,
        "price_candidates": price_candidates,
        "ocr_details": {
            "variant": best["variant"],
            "psm": best["psm"],
            "confidence": best["confidence"],
            "passes_tested": len(results),
            "reconstruction": "position_based",
            "item_count": len(items),
        },
    }

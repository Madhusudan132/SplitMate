
import re
from decimal import Decimal, InvalidOperation


# --------------------------------------------------
# MONEY PATTERNS
# --------------------------------------------------

MONEY = re.compile(
    r"^(?:₹|rs\.?|inr|\$|%|=)?\s*"
    r"(\d[\d,]*(?:\.\d{1,3})?)$",
    re.IGNORECASE
)

QTY = re.compile(
    r"^(\d{1,3})\s*[x×]\s*(.*)$",
    re.IGNORECASE
)


# --------------------------------------------------
# SUMMARY FIELDS
# --------------------------------------------------

SUMMARY = [
    (
        "subtotal",
        re.compile(r"^sub[\s-]*total\b", re.I)
    ),
    ("cgst", re.compile(r"^cgst\b", re.I)),
    ("sgst", re.compile(r"^sgst\b", re.I)),
    ("igst", re.compile(r"^igst\b", re.I)),
    (
        "discount",
        re.compile(r"^(discount|less)\b", re.I)
    ),
    (
        "service_charge",
        re.compile(r"^service\s*charge\b", re.I)
    ),
    (
        "total",
        re.compile(
            r"^(grand\s*total|net\s*total|total)\b",
            re.I
        )
    ),
]


# --------------------------------------------------
# RECEIPT METADATA
# --------------------------------------------------

IGNORE = re.compile(
    r"^(receipt|invoice|customer|payment|contact|"
    r"phone|mobile|date|time|table|thank|address|"
    r"gstin|gst\s*no|fssai|bill\s*no|order\s*no|"
    r"cashier|mode|upi|transaction|name\s*:|"
    r"item\s+price\s+qty|item\s+qty|"
    r"save\s+paper|[-_=]{3,})\b",
    re.I
)

# Address and contact information indicators.
ADDRESS_WORDS = re.compile(
    r"\b("
    r"road|rd|street|st|avenue|lane|cross|main|"
    r"layout|nagar|colony|sector|block|"
    r"district|state|karnataka|bengaluru|"
    r"bangalore|hubli|dharwad|mumbai|delhi|"
    r"chennai|hyderabad|pune|india|"
    r"pin|pincode|postal|near|opposite|"
    r"building|floor|landmark"
    r")\b",
    re.I
)

CONTACT_WORDS = re.compile(
    r"\b("
    r"mobile|phone|telephone|contact|"
    r"website|email|www|gstin|fssai"
    r")\b",
    re.I
)

# Indian PIN code: six digits, starting from 1-9.
PIN_CODE = re.compile(
    r"(?<!\d)[1-9]\d{5}(?!\d)"
)

# Typical 10-digit Indian mobile numbers.
PHONE_NUMBER = re.compile(
    r"(?<!\d)[6-9]\d{9}(?!\d)"
)


# --------------------------------------------------
# MONEY UTILITIES
# --------------------------------------------------

def amount(token):
    token = token.strip()

    match = MONEY.fullmatch(token)

    if not match:
        return None

    value = match.group(1).replace(",", "")

    # OCR values with three decimal digits are
    # ambiguous and must be reviewed manually.
    if "." in value and len(value.split(".")[-1]) == 3:
        return None

    try:
        number = Decimal(value)

        if number.is_finite() and number >= 0:
            return number

    except InvalidOperation:
        pass

    return None


def fmt(number):
    return str(number.quantize(Decimal("0.01")))


def parse_price_token(token):
    token = token.strip()

    value = amount(token)

    if value is not None:
        return value, False

    if re.search(r"\d", token) and (
        "." in token
        or "," in token
        or token.startswith(("₹", "%", "$"))
    ):
        return None, True

    return None, False


# --------------------------------------------------
# DETECT ADDRESS / CONTACT LINES
# --------------------------------------------------

def is_metadata_line(text):
    text = text.strip()

    if not text:
        return True

    if IGNORE.search(text):
        return True

    if CONTACT_WORDS.search(text):
        return True

    if PHONE_NUMBER.search(text):
        return True

    if PIN_CODE.search(text):
        return True

    # Comma-separated text containing place names
    # is very likely a restaurant address.
    if "," in text and ADDRESS_WORDS.search(text):
        return True

    # Street/address indicators with numbers.
    if ADDRESS_WORDS.search(text) and re.search(
        r"\d", text
    ):
        return True

    return False


# --------------------------------------------------
# PARSE FOOD ITEM
# --------------------------------------------------

def parse_line(text, table=False):
    if is_metadata_line(text):
        return None

    tokens = text.split()

    if len(tokens) < 2:
        return None

    raw_price = tokens[-1]

    # A bare six-digit number is usually a PIN code,
    # not a food price.
    if PIN_CODE.fullmatch(raw_price):
        return None

    # A bare 10-digit number is usually a phone.
    if PHONE_NUMBER.fullmatch(raw_price):
        return None

    value, bad_price = parse_price_token(raw_price)

    if value is None and not bad_price:
        return None

    left = tokens[:-1]

    if not left:
        return None

    quantity = 1
    unit_price = None
    needs_review = False

    # Layout A:
    # Food name | Unit price | Qty | Line total
    #
    # Example:
    # Mutton biriyani 400 4 1600
    if (
        len(left) >= 3
        and re.fullmatch(r"\d{1,3}", left[-1])
    ):
        possible_unit = amount(
            left[-2].lstrip("Xx")
        )

        if (
            possible_unit is not None
            and len(left[:-2]) > 0
        ):
            quantity = int(left[-1])
            unit_price = possible_unit
            left = left[:-2]

            if value is not None:
                calculated = unit_price * quantity

                if abs(calculated - value) > Decimal("0.01"):
                    needs_review = True

    if unit_price is None:
        joined = " ".join(left)

        # Layout B:
        # 2x Masala Dosa 538.00
        qty_match = QTY.match(joined)

        if qty_match and qty_match.group(2):
            quantity = int(qty_match.group(1))
            left = qty_match.group(2).split()

        # Layout C:
        # 2 Masala Dosa 538.00
        elif (
            len(left) > 1
            and re.fullmatch(r"\d{1,3}", left[0])
        ):
            quantity = int(left[0])
            left = left[1:]

        # Layout D:
        # Food name | Qty | Total
        elif (
            table
            and len(left) > 1
            and re.fullmatch(r"\d{1,3}", left[-1])
        ):
            quantity = int(left[-1])
            left = left[:-1]

    name = " ".join(left).strip(" -:|.")

    if (
        not name
        or not re.search(r"[A-Za-z]", name)
        or quantity < 1
    ):
        return None

    if is_metadata_line(name):
        return None

    # Reject obvious summary and payment labels.
    if re.search(
        r"\b(invoice|gst|tax|date|phone|receipt|"
        r"total|subtotal|cash|amount|payment|balance)\b",
        name,
        re.I
    ):
        return None

    item = {
        "name": name,
        "quantity": quantity,
        "total_price": (
            fmt(value) if value is not None else None
        ),
        "needs_review": bad_price or needs_review,
        "raw_price": raw_price,
    }

    if unit_price is not None:
        item["unit_price"] = fmt(unit_price)

    return item


# --------------------------------------------------
# PARSE COMPLETE RECEIPT
# --------------------------------------------------

def parse_receipt(raw_text):
    lines = [
        " ".join(line.split())
        for line in raw_text.splitlines()
        if line.strip()
    ]

    items = []
    summary = {}

    started = False
    table = False
    finished = False

    for line in lines:
        lower = line.lower()

        # Detect item table headers.
        if (
            re.search(r"\bitem\b", lower)
            and re.search(
                r"\b(price|qty|quantity|amount|total)\b",
                lower
            )
        ):
            table = True
            started = True
            continue

        # Example: Mode: Cash Total: = 3150
        summary_line = re.sub(
            r"^mode\s*:\s*\w+\s+",
            "",
            line,
            flags=re.I
        )

        summary_key = None

        for key, pattern in SUMMARY:
            if pattern.search(summary_line):
                summary_key = key
                break

        if summary_key:
            finished = True

            raw_amount = summary_line.split()[-1]
            value = amount(raw_amount)

            if value is not None:
                summary[summary_key] = fmt(value)
            else:
                summary[
                    f"{summary_key}_raw"
                ] = line

                summary[
                    f"{summary_key}_needs_review"
                ] = True

            continue

        if finished:
            continue

        # Reject restaurant addresses and metadata
        # before attempting food-item parsing.
        if is_metadata_line(line):
            continue

        item = parse_line(line, table=table)

        if item:
            items.append(item)
            started = True
            continue

        # Handle wrapped food names.
        if (
            started
            and items
            and len(line.split()) <= 3
            and not re.search(r"\d", line)
            and not is_metadata_line(line)
            and not re.search(
                r"^(mode|thank|save|cash|receipt|"
                r"item|total)",
                line,
                re.I
            )
        ):
            items[-1]["name"] += " " + line
            items[-1]["needs_review"] = True

    return {
        "items": items,
        "summary": summary,
    }

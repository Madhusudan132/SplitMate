
# scanner/receipt_validator.py

from decimal import Decimal, InvalidOperation


CENT = Decimal("0.01")


def to_amount(value):
    if value is None or isinstance(value, bool):
        return None

    try:
        amount = Decimal(str(value).replace(",", "").strip())

        if not amount.is_finite():
            return None

        return amount.quantize(CENT)

    except (InvalidOperation, TypeError, ValueError):
        return None


def money(value):
    return str(value.quantize(CENT))


def validate_receipt(items, summary):
    detected_total = Decimal("0.00")
    missing_prices = []
    review_items = []

    for index, item in enumerate(items):
        amount = to_amount(item.get("total_price"))

        if amount is None or amount < 0:
            missing_prices.append(index)
        else:
            detected_total += amount

        if item.get("needs_review", False):
            review_items.append(index)

    subtotal = to_amount(summary.get("subtotal"))
    grand_total = to_amount(summary.get("total"))

    # Calculate printed adjustments only when all
    # detected adjustment fields contain valid amounts.
    adjustment_keys = (
        "cgst", "sgst", "igst",
        "service_charge", "discount"
    )

    adjustments = Decimal("0.00")
    adjustments_valid = True

    for key in adjustment_keys:
        if key not in summary:
            continue

        amount = to_amount(summary[key])

        if amount is None:
            adjustments_valid = False
            break

        if key == "discount":
            adjustments -= amount
        else:
            adjustments += amount

    # Find a comparable printed amount.
    expected = None
    compared_with = None

    if subtotal is not None:
        expected = subtotal
        compared_with = "subtotal"

    elif (
        grand_total is not None
        and adjustments_valid
        and any(key in summary for key in adjustment_keys)
    ):
        expected = grand_total - adjustments
        compared_with = "total_minus_adjustments"

    elif (
        grand_total is not None
        and adjustments_valid
        and not any(key in summary for key in adjustment_keys)
    ):
        expected = grand_total
        compared_with = "total"

    # Missing prices make the sum incomplete.
    if missing_prices:
        difference = None
        matches = None

    elif expected is not None:
        difference = detected_total - expected
        matches = abs(difference) <= CENT

    else:
        difference = None
        matches = None

    # Even matching arithmetic does not resolve
    # OCR uncertainty or unreadable summary fields.
    summary_needs_review = any(
        key.endswith("_needs_review") and value
        for key, value in summary.items()
    )

    needs_review = bool(
        missing_prices
        or review_items
        or summary_needs_review
        or matches is not True
    )

    if missing_prices:
        message = (
            "Some item prices are missing. "
            "Review them before splitting."
        )
    elif matches is False:
        message = (
            "Extracted item prices do not match "
            "the printed receipt amount."
        )
    elif matches is None:
        message = (
            "Could not verify the receipt total. "
            "Review the extracted amounts."
        )
    elif needs_review:
        message = (
            "Amounts are consistent, but some "
            "OCR results still need review."
        )
    else:
        message = (
            "Amounts are consistent with the "
            "printed receipt."
        )

    return {
        "detected_total": money(detected_total),
        "subtotal_matches": matches,
        "difference": (
            money(difference)
            if difference is not None
            else None
        ),
        "compared_with": compared_with,
        "expected_amount": (
            money(expected)
            if expected is not None
            else None
        ),
        "missing_price_indices": missing_prices,
        "review_item_indices": review_items,
        "needs_review": needs_review,
        "ready_to_split": not needs_review,
        "message": message
    }

from django.shortcuts import render

# Create your views here.

import hashlib
import hmac
import json
import re
from datetime import datetime

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Guest, SavedBill


TOKEN_PATTERN = re.compile(r"^[a-f0-9]{64}$")
MAX_AMOUNT = 10**12  # Paise
MAX_FRIENDS = 100
MAX_TRANSFERS = 1000


def error(message, status=400):
    return JsonResponse(
        {"error": message},
        status=status,
    )


def is_amount(value):
    return (
        type(value) is int
        and 0 <= value <= MAX_AMOUNT
    )


def get_guest(request, create=False):
    token = request.headers.get(
        "X-Guest-Token", ""
    )

    if not TOKEN_PATTERN.fullmatch(token):
        return None

    digest = hashlib.sha256(
        bytes.fromhex(token)
    ).hexdigest()

    if create:
        guest, _ = Guest.objects.get_or_create(
            token_hash=digest
        )
        return guest

    # Compare hashed identifiers through the
    # database's exact-match lookup.
    return Guest.objects.filter(
        token_hash=digest
    ).first()


def read_json(request):
    try:
        body = json.loads(
            request.body.decode("utf-8")
        )
        return body if isinstance(body, dict) else None
    except (ValueError, UnicodeDecodeError):
        return None


def validate_bill(payload):
    title = payload.get("title")
    grand_total = payload.get("grandTotal")
    friends = payload.get("friends")
    payments = payload.get("payments")
    transfers = payload.get("transfers")

    if (
        not isinstance(title, str)
        or not title.strip()
        or len(title.strip()) > 120
    ):
        return None, "Enter a valid bill title."

    if not is_amount(grand_total):
        return None, "Invalid grand total."

    if (
        not isinstance(friends, list)
        or not 1 <= len(friends) <= MAX_FRIENDS
    ):
        return None, "Invalid friends list."

    if not isinstance(payments, dict):
        return None, "Invalid restaurant payments."

    if (
        not isinstance(transfers, list)
        or len(transfers) > MAX_TRANSFERS
    ):
        return None, "Invalid transfers list."

    ids = set()
    cleaned_friends = []
    total_shares = 0

    for friend in friends:
        if not isinstance(friend, dict):
            return None, "Invalid friend."

        friend_id = friend.get("id")
        name = friend.get("name")
        share = friend.get("share")

        if (
            not isinstance(friend_id, str)
            or not 1 <= len(friend_id) <= 120
            or friend_id in ids
            or not isinstance(name, str)
            or not 1 <= len(name.strip()) <= 100
            or not is_amount(share)
        ):
            return None, "Invalid friend details."

        ids.add(friend_id)
        total_shares += share

        cleaned_friends.append({
            "id": friend_id,
            "name": name.strip(),
            "share": share,
        })

    if total_shares != grand_total:
        return None, "Shares do not match bill total."

    if set(payments.keys()) != ids:
        return None, "Payment participants do not match."

    cleaned_payments = {}
    total_paid = 0

    for friend_id in ids:
        amount = payments[friend_id]

        if not is_amount(amount):
            return None, "Invalid payment amount."

        cleaned_payments[friend_id] = amount
        total_paid += amount

    if total_paid != grand_total:
        return None, "Restaurant payments do not match total."

    # Recalculate the expected settlement on
    # the server. Do not trust client transfers.
    creditors = []
    debtors = []

    for friend in cleaned_friends:
        friend_id = friend["id"]
        balance = (
            cleaned_payments[friend_id]
            - friend["share"]
        )

        if balance > 0:
            creditors.append({
                "id": friend_id,
                "remaining": balance,
            })
        elif balance < 0:
            debtors.append({
                "id": friend_id,
                "remaining": -balance,
            })

    expected = []
    i = 0
    j = 0

    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]

        amount = min(
            debtor["remaining"],
            creditor["remaining"],
        )

        expected.append({
            "fromId": debtor["id"],
            "toId": creditor["id"],
            "amount": amount,
        })

        debtor["remaining"] -= amount
        creditor["remaining"] -= amount

        if debtor["remaining"] == 0:
            i += 1
        if creditor["remaining"] == 0:
            j += 1

    if len(expected) != len(transfers):
        return None, "Transfer calculations do not match."

    cleaned_transfers = []

    for index, transfer in enumerate(transfers):
        if not isinstance(transfer, dict):
            return None, "Invalid transfer."

        calculated = expected[index]

        if any(
            transfer.get(key) != calculated[key]
            for key in ("fromId", "toId", "amount")
        ):
            return None, "Transfer calculations do not match."

        if type(transfer.get("paid")) is not bool:
            return None, "Invalid payment status."

        cleaned_transfers.append({
            **calculated,
            "paid": transfer["paid"],
        })

    return {
        "title": title.strip(),
        "grand_total": grand_total,
        "friends": cleaned_friends,
        "payments": cleaned_payments,
        "transfers": cleaned_transfers,
    }, None


def serialize_bill(bill, detail=False):
    result = {
        "id": str(bill.id),
        "title": bill.title,
        "grandTotal": bill.grand_total,
        "friendCount": len(bill.friends),
        "isSettled": bill.is_settled,
        "createdAt": bill.created_at.isoformat(),
        "updatedAt": bill.updated_at.isoformat(),
    }

    if detail:
        result.update({
            "friends": bill.friends,
            "payments": bill.payments,
            "transfers": bill.transfers,
        })

    return result


@csrf_exempt
def bill_collection(request):
    if request.method not in ("GET", "POST"):
        return error("Method not allowed.", 405)

    guest = get_guest(
        request,
        create=request.method == "POST",
    )

    if not guest:
        if request.method == "GET":
            # A valid new guest has no saved bills.
            token = request.headers.get(
                "X-Guest-Token", ""
            )
            if TOKEN_PATTERN.fullmatch(token):
                return JsonResponse({"bills": []})

        return error("Invalid guest token.", 401)

    if request.method == "GET":
        bills = SavedBill.objects.filter(
            guest=guest
        )[:200]

        return JsonResponse({
            "bills": [
                serialize_bill(bill)
                for bill in bills
            ]
        })

    payload = read_json(request)

    if payload is None:
        return error("Invalid JSON.")

    cleaned, validation_error = validate_bill(
        payload
    )

    if validation_error:
        return error(validation_error)

    bill = SavedBill.objects.create(
        guest=guest,
        **cleaned,
    )

    return JsonResponse(
        serialize_bill(bill, detail=True),
        status=201,
    )


@csrf_exempt
def bill_detail(request, bill_id):
    if request.method not in (
        "GET", "PATCH", "DELETE"
    ):
        return error("Method not allowed.", 405)

    guest = get_guest(request)

    if not guest:
        return error("Bill not found.", 404)

    bill = SavedBill.objects.filter(
        id=bill_id,
        guest=guest,
    ).first()

    if not bill:
        return error("Bill not found.", 404)

    if request.method == "GET":
        return JsonResponse(
            serialize_bill(bill, detail=True)
        )

    if request.method == "DELETE":
        bill.delete()
        return JsonResponse({"success": True})

    payload = read_json(request)

    if payload is None:
        return error("Invalid JSON.")

    # Only payment status may be edited.
    if set(payload.keys()) != {
        "transferIndex", "paid"
    }:
        return error("Invalid update fields.")

    index = payload.get("transferIndex")
    paid = payload.get("paid")

    if (
        type(index) is not int
        or type(paid) is not bool
        or not 0 <= index < len(bill.transfers)
    ):
        return error("Invalid transfer update.")

    with transaction.atomic():
        bill = SavedBill.objects.select_for_update().get(
            id=bill_id,
            guest=guest,
        )

        transfers = [
            dict(item)
            for item in bill.transfers
        ]

        transfers[index]["paid"] = paid
        bill.transfers = transfers

        bill.save(
            update_fields=[
                "transfers",
                "updated_at",
            ]
        )

    return JsonResponse(
        serialize_bill(bill, detail=True)
    )

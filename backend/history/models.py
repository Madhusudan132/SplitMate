
from django.db import models
import uuid


class Guest(models.Model):
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"Guest {self.pk}"


class SavedBill(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    guest = models.ForeignKey(
        Guest,
        on_delete=models.CASCADE,
        related_name="bills",
    )

    title = models.CharField(
        max_length=120
    )

    # All monetary amounts are stored in paise.
    grand_total = models.BigIntegerField()

    # Friends and their individual shares.
    friends = models.JSONField(
        default=list
    )

    # Amount each friend paid to the restaurant.
    payments = models.JSONField(
        default=dict
    )

    # Settlement transfers and payment statuses.
    transfers = models.JSONField(
        default=list
    )

    # Original scanned receipt and assignments.
    receipt_data = models.JSONField(
        default=dict,
        blank=True,
    )

    # Recipient friend ID -> UPI ID.
    # Example:
    # {
    #     "friend_1": "rahul@upi",
    #     "friend_2": "madhusudan@oksbi"
    # }
    upi_ids = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_settled(self):
        return all(
            (
                transfer.get("status") == "confirmed"
                if transfer.get("status") in {
                    "pending",
                    "awaiting",
                    "confirmed",
                }
                else transfer.get("paid") is True
            )
            for transfer in self.transfers
        )

    def __str__(self):
        return self.title

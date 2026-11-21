
from django.core.exceptions import ValidationError
from PIL import UnidentifiedImageError
from pytesseract import TesseractError, TesseractNotFoundError

from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from .ocr_service import read_receipt


# Check backend status
@api_view(["GET"])
def api_status(request):
    return Response({
        "success": True,
        "application": "SplitMate",
        "message": "SplitMate Django Backend is Running!",
        "ocr_status": "Ready for testing"
    })


# Scan uploaded restaurant receipt
@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def scan_receipt(request):

    image = request.FILES.get("image")

    # Check whether image was uploaded
    if not image:
        return Response(
            {
                "success": False,
                "error": "Please upload a receipt image."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Maximum image size: 10 MB
    if image.size > 10 * 1024 * 1024:
        return Response(
            {
                "success": False,
                "error": "Image must be smaller than 10 MB."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Process image with OCR
        result = read_receipt(image)

        return Response({
            "success": True,
            "message": "Receipt processed successfully!",

            # Extracted food items
            "items": result["items"],

            # Original OCR text
            "raw_text": result["raw_text"],

            # Subtotal, GST, discounts and total
            "summary": result["summary"],

            # Check whether extracted amounts match
            "validation": result["validation"],

            "price_candidates": result.get("price_candidates", []),

            "ocr_details": result["ocr_details"],

  


        })

    except (
        UnidentifiedImageError,
        ValidationError,
        ValueError
    ):
        return Response(
            {
                "success": False,
                "error": "Invalid or unreadable image."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    except (TesseractError, TesseractNotFoundError):
        return Response(
            {
                "success": False,
                "error": (
                    "OCR engine failed. "
                    "Check Tesseract installation."
                )
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

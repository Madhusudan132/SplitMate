
from django.urls import path
from . import views

urlpatterns = [
    path("status/", views.api_status, name="api-status"),
    path("scan-receipt/", views.scan_receipt, name="scan-receipt"),
]

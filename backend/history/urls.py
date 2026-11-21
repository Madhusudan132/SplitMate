
from django.urls import path
from . import views

urlpatterns = [
    path(
        "bills/",
        views.bill_collection,
        name="bill-collection",
    ),
    path(
        "bills/<uuid:bill_id>/",
        views.bill_detail,
        name="bill-detail",
    ),
]

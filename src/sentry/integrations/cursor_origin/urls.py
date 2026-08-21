from django.urls import re_path

from .webhook import CursorOriginWebhookEndpoint

urlpatterns = [
    re_path(
        r"^webhook/$",
        CursorOriginWebhookEndpoint.as_view(),
        name="sentry-integration-cursor-origin-webhook",
    ),
]

from typing import int
from django.urls import re_path

from .webhooks.handler import CursorWebhookEndpoint

urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_id>[^/]+)/webhook/$",
        CursorWebhookEndpoint.as_view(),
        name="sentry-extensions-cursor-webhook",
    ),
]

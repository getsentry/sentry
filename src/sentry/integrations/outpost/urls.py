from django.urls import re_path

from .webhooks.handler import OutpostWebhookEndpoint

urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_id>[^/]+)/webhook/$",
        OutpostWebhookEndpoint.as_view(),
        name="sentry-extensions-outpost-webhook",
    ),
]

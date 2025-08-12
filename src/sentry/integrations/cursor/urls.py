from django.urls import path

from .webhooks.handler import CursorWebhookEndpoint

urlpatterns = [
    path("webhook/", CursorWebhookEndpoint.as_view(), name="sentry-extensions-cursor-webhook"),
]

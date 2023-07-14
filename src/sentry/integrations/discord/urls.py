from django.urls import re_path

from .webhooks.base import DiscordInteractionsEndpoint

urlpatterns = [
    re_path(
        r"^interactions/$",
        DiscordInteractionsEndpoint.as_view(),
        name="sentry-integration-discord-interactions",
    )
]

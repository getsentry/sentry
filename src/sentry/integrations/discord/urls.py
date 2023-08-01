from django.urls import re_path

from .views.link_identity import DiscordLinkIdentityView
from .views.unlink_identity import DiscordUnlinkIdentityView
from .webhooks.base import DiscordInteractionsEndpoint

urlpatterns = [
    re_path(
        r"^interactions/$",
        DiscordInteractionsEndpoint.as_view(),
        name="sentry-integration-discord-interactions",
    ),
    re_path(
        r"link-identity/(?P<signed_params>[^\/]+)/$",
        DiscordLinkIdentityView.as_view(),
        name="sentry-integration-discord-link-identity",
    ),
    re_path(
        r"unlink-identity/(?P<signed_params>[^\/]+)/$",
        DiscordUnlinkIdentityView.as_view(),
        name="sentry-integration-discord-unlink-identity",
    ),
]

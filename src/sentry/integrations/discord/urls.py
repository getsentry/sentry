from django.urls import re_path

from sentry.integrations.discord.spec import DiscordMessagingSpec
from sentry.integrations.discord.views.configure_redirect import DiscordConfigureRedirectView

from .webhooks.base import DiscordInteractionsEndpoint

urlpatterns = [
    re_path(
        r"^interactions/$",
        DiscordInteractionsEndpoint.as_view(),
        name="sentry-integration-discord-interactions",
    ),
    # Discord App Directory's redirect_uri lands here after the user authorizes
    # in Discord. We forward the OAuth params to the link view, which opens the
    # install pipeline modal to finish the install.
    re_path(
        r"^configure/$",
        DiscordConfigureRedirectView.as_view(),
        name="discord-extension-configuration",
    ),
]

urlpatterns += DiscordMessagingSpec().get_identity_view_set_url_patterns()

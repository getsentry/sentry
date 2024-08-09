from django.urls import re_path

from sentry.integrations.discord.spec import DiscordMessagingSpec
from sentry.integrations.web.discord_extension_configuration import (
    DiscordExtensionConfigurationView,
)

from .webhooks.base import DiscordInteractionsEndpoint

urlpatterns = [
    re_path(
        r"^interactions/$",
        DiscordInteractionsEndpoint.as_view(),
        name="sentry-integration-discord-interactions",
    ),
    # Discord App Directory extension install flow
    re_path(
        r"^configure/$",
        DiscordExtensionConfigurationView.as_view(),
        name="discord-extension-configuration",
    ),
]

urlpatterns += DiscordMessagingSpec().get_identity_view_set_url_patterns()

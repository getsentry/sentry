from django.urls import re_path

from sentry.integrations.msteams.spec import MsTeamsMessagingSpec
from sentry.integrations.web.msteams_extension_configuration import (
    MsTeamsExtensionConfigurationView,
)

from .webhook import MsTeamsWebhookEndpoint

urlpatterns = [
    re_path(
        r"^webhook/$",
        MsTeamsWebhookEndpoint.as_view(),
        name="sentry-integration-msteams-webhooks",
    ),
    re_path(
        r"^configure/$",
        MsTeamsExtensionConfigurationView.as_view(),
        name="sentry-integration-msteams-configure",
    ),
]

urlpatterns += MsTeamsMessagingSpec().get_identity_view_set_url_patterns()

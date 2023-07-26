from django.urls import re_path

from sentry.web.frontend.msteams_extension_configuration import MsTeamsExtensionConfigurationView

from .link_identity import MsTeamsLinkIdentityView
from .unlink_identity import MsTeamsUnlinkIdentityView
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
    re_path(
        r"^link-identity/(?P<signed_params>[^\/]+)/$",
        MsTeamsLinkIdentityView.as_view(),
        name="sentry-integration-msteams-link-identity",
    ),
    re_path(
        r"^unlink-identity/(?P<signed_params>[^\/]+)/$",
        MsTeamsUnlinkIdentityView.as_view(),
        name="sentry-integration-msteams-unlink-identity",
    ),
]

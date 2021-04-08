from django.conf.urls import url

from sentry.web.frontend.msteams_extension_configuration import MsTeamsExtensionConfigurationView

from .link_identity import MsTeamsLinkIdentityView
from .unlink_identity import MsTeamsUnlinkIdentityView
from .webhook import MsTeamsWebhookEndpoint

urlpatterns = [
    url(r"^webhook/$", MsTeamsWebhookEndpoint.as_view()),
    url(r"^configure/$", MsTeamsExtensionConfigurationView.as_view()),
    url(
        r"^link-identity/(?P<signed_params>[^\/]+)/$",
        MsTeamsLinkIdentityView.as_view(),
        name="sentry-integration-msteams-link-identity",
    ),
    url(
        r"^unlink-identity/(?P<signed_params>[^\/]+)/$",
        MsTeamsUnlinkIdentityView.as_view(),
        name="sentry-integration-msteams-unlink-identity",
    ),
]

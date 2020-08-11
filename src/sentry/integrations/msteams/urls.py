from __future__ import absolute_import, print_function

from django.conf.urls import url

from .webhook import MsTeamsWebhookEndpoint
from sentry.web.frontend.msteams_extension_configuration import MsTeamsExtensionConfigurationView
from .link_identity import MsTeamsLinkIdentityView


urlpatterns = [
    url(r"^webhook/$", MsTeamsWebhookEndpoint.as_view()),
    url(r"^configure/$", MsTeamsExtensionConfigurationView.as_view()),
    url(
        r"^link-identity/(?P<signed_params>[^\/]+)/$",
        MsTeamsLinkIdentityView.as_view(),
        name="sentry-integration-msteams-link-identity",
    ),
]

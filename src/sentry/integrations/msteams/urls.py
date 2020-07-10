from __future__ import absolute_import, print_function

from django.conf.urls import url

from .webhook import MsTeamsWebhookEndpoint
from sentry.web.frontend.msteams_extension_configuration import MsTeamsExtensionConfigurationView


urlpatterns = [
    url(r"^webhook/$", MsTeamsWebhookEndpoint.as_view()),
    url(r"^configure/$", MsTeamsExtensionConfigurationView.as_view()),
]

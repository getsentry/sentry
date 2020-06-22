from __future__ import absolute_import, print_function

from django.conf.urls import url

from .webhook import VercelWebhookEndpoint
from sentry.web.frontend.vercel_extension_configuration import VercelExtensionConfigurationView


urlpatterns = [
    url(r"^webhook/$", VercelWebhookEndpoint.as_view()),
    url(r"^configure/$", VercelExtensionConfigurationView.as_view()),
]

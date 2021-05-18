from django.conf.urls import url

from sentry.web.frontend.vercel_extension_configuration import VercelExtensionConfigurationView

from .uninstall import VercelUninstallEndpoint
from .webhook import VercelWebhookEndpoint

urlpatterns = [
    url(r"^webhook/$", VercelWebhookEndpoint.as_view(), name="sentry-extensions-vercel-webhook"),
    url(
        r"^configure/$",
        VercelExtensionConfigurationView.as_view(),
        name="sentry-extensions-vercel-configure",
    ),
    url(r"^delete/$", VercelUninstallEndpoint.as_view(), name="sentry-extensions-vercel-delete"),
]

from django.conf.urls import url

from .webhook import VercelWebhookEndpoint
from .uninstall import VercelUninstallEndpoint
from .uihook import VercelUIHook
from sentry.web.frontend.vercel_extension_configuration import VercelExtensionConfigurationView


urlpatterns = [
    url(r"^webhook/$", VercelWebhookEndpoint.as_view(), name="sentry-extensions-vercel-webhook"),
    url(
        r"^configure/$",
        VercelExtensionConfigurationView.as_view(),
        name="sentry-extensions-vercel-configure",
    ),
    url(r"^delete/$", VercelUninstallEndpoint.as_view(), name="sentry-extensions-vercel-delete"),
    url(r"^ui-hook/$", VercelUIHook.as_view(), name="sentry-extensions-vercel-ui-hook"),
]

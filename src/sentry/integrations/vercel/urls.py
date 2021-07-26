from django.conf.urls import url

from sentry.web.frontend.vercel_extension_configuration import VercelExtensionConfigurationView

from .generic_webhook import VercelGenericWebhookEndpoint

urlpatterns = [
    url(
        r"^webhook/$",
        VercelGenericWebhookEndpoint.as_view(),
        name="sentry-extensions-vercel-webhook",
    ),
    url(
        r"^configure/$",
        VercelExtensionConfigurationView.as_view(),
        name="sentry-extensions-vercel-configure",
    ),
    # XXX(meredith): This route has become our generic hook, in
    # the future we'll need to update the route name to reflect that.
    # Can delete this once we are sure no more requests are being
    # made to this endpoint from Vercel.
    url(
        r"^delete/$",
        VercelGenericWebhookEndpoint.as_view(),
        name="sentry-extensions-vercel-generic-webhook",
    ),
]

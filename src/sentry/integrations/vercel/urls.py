from django.urls import re_path

from .views import VercelConfigureRedirectView
from .webhook import VercelWebhookEndpoint

urlpatterns = [
    # Vercel marketplace installs link here with the OAuth `code`. We forward it
    # to the link view, which opens the install pipeline modal to finish up.
    re_path(
        r"^configure/$",
        VercelConfigureRedirectView.as_view(),
        name="sentry-extensions-vercel-configure",
    ),
    # Since we've been endorsing using `/delete` as the endpoint for Self-Hosted, we need to
    # keep it operational for existing integrations. This is purely aesthetic, as both routes
    # will use the same webhook (Previously known as 'Generic Webhook' - See #26185)
    re_path(
        r"^delete/$",
        VercelWebhookEndpoint.as_view(),
        name="sentry-extensions-vercel-delete",
    ),
    re_path(
        r"^webhook/$",
        VercelWebhookEndpoint.as_view(),
        name="sentry-extensions-vercel-webhook",
    ),
]

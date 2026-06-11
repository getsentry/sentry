from django.urls import re_path

from sentry.integrations.msteams.spec import MsTeamsMessagingSpec
from sentry.integrations.msteams.views.configure_redirect import MsTeamsConfigureRedirectView

from .webhook import MsTeamsWebhookEndpoint

urlpatterns = [
    re_path(
        r"^webhook/$",
        MsTeamsWebhookEndpoint.as_view(),
        name="sentry-integration-msteams-webhooks",
    ),
    # The Sentry-Teams bot card links here with `signed_params`. We forward
    # those to the link view, which opens the install pipeline modal to finish
    # the install.
    re_path(
        r"^configure/$",
        MsTeamsConfigureRedirectView.as_view(),
        name="sentry-integration-msteams-configure",
    ),
]

urlpatterns += MsTeamsMessagingSpec().get_identity_view_set_url_patterns()

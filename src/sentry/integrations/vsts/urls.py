from django.urls import re_path

from sentry.integrations.vsts.views.configure_redirect import VstsExtensionConfigureRedirectView

from .search import VstsSearchEndpoint
from .webhooks import WorkItemWebhook

urlpatterns = [
    re_path(
        r"^issue-updated/$",
        WorkItemWebhook.as_view(),
        name="sentry-extensions-vsts-issue-updated",
    ),
    re_path(
        r"^search/(?P<organization_id_or_slug>[^/]+)/(?P<integration_id>\d+)/$",
        VstsSearchEndpoint.as_view(),
        name="sentry-extensions-vsts-search",
    ),
    # The Azure DevOps Marketplace links here with `targetId`/`targetName`. We
    # forward those to the link view, which opens the install pipeline modal to
    # finish the install.
    re_path(
        r"^configure/$",
        VstsExtensionConfigureRedirectView.as_view(),
        name="vsts-extension-configuration",
    ),
]

from django.urls import re_path

from sentry.web.frontend.vsts_extension_configuration import VstsExtensionConfigurationView

from .search import VstsSearchEndpoint
from .webhooks import WorkItemWebhook

urlpatterns = [
    re_path(
        r"^issue-updated/$",
        WorkItemWebhook.as_view(),
        name="sentry-extensions-vsts-issue-updated",
    ),
    re_path(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        VstsSearchEndpoint.as_view(),
        name="sentry-extensions-vsts-search",
    ),
    # VSTS Marketplace extension install flow
    re_path(
        r"^configure/$",
        VstsExtensionConfigurationView.as_view(),
        name="vsts-extension-configuration",
    ),
]

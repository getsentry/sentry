from __future__ import absolute_import, print_function

from django.conf.urls import url

from sentry.web.frontend.vsts_extension_configuration import VstsExtensionConfigurationView

from .search import VstsSearchEndpoint
from .webhooks import WorkItemWebhook

urlpatterns = [
    url(
        r"^issue-updated/$", WorkItemWebhook.as_view(), name="sentry-extensions-vsts-issue-updated"
    ),
    url(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        VstsSearchEndpoint.as_view(),
        name="sentry-extensions-vsts-search",
    ),
    # VSTS Marketplace extension install flow
    url(
        r"^configure/$",
        VstsExtensionConfigurationView.as_view(),
        name="vsts-extension-configuration",
    ),
]

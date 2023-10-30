from django.urls import re_path

from .installation import GitHubIntegrationsInstallationEndpoint
from .search import GithubSharedSearchEndpoint
from .webhook import GitHubIntegrationsWebhookEndpoint

urlpatterns = [
    re_path(
        r"^webhook/$",
        GitHubIntegrationsWebhookEndpoint.as_view(),
        name="sentry-integration-github-webhook",
    ),
    re_path(
        r"^installation/(?P<installation_id>\d+)/$",
        GitHubIntegrationsInstallationEndpoint.as_view(),
        name="sentry-integration-github-installation",
    ),
    re_path(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        GithubSharedSearchEndpoint.as_view(),
        name="sentry-integration-github-search",
    ),
]

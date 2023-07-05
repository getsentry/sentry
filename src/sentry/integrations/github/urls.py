from django.urls import re_path

from .search import GitHubSearchEndpoint
from .webhook import GitHubIntegrationsWebhookEndpoint

urlpatterns = [
    re_path(
        r"^webhook/$",
        GitHubIntegrationsWebhookEndpoint.as_view(),
        name="sentry-integration-github-webhook",
    ),
    re_path(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        GitHubSearchEndpoint.as_view(),
        name="sentry-integration-github-search",
    ),
]

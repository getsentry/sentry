from django.conf.urls import url

from .search import GitHubSearchEndpoint
from .webhook import GitHubIntegrationsWebhookEndpoint

urlpatterns = [
    url(r"^webhook/$", GitHubIntegrationsWebhookEndpoint.as_view()),
    url(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        GitHubSearchEndpoint.as_view(),
        name="sentry-extensions-github-search",
    ),
]

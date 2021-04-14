from django.conf.urls import url

from .search import GitlabIssueSearchEndpoint
from .webhooks import GitlabWebhookEndpoint

urlpatterns = [
    url(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        GitlabIssueSearchEndpoint.as_view(),
        name="sentry-extensions-gitlab-search",
    ),
    url(r"^webhook/$", GitlabWebhookEndpoint.as_view(), name="sentry-extensions-gitlab-webhook"),
]

from django.urls import re_path

from .search import GitlabIssueSearchEndpoint
from .webhooks import GitlabWebhookEndpoint

urlpatterns = [
    re_path(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        GitlabIssueSearchEndpoint.as_view(),
        name="sentry-extensions-gitlab-search",
    ),
    re_path(
        r"^webhook/$",
        GitlabWebhookEndpoint.as_view(),
        name="sentry-extensions-gitlab-webhook",
    ),
]

from django.urls import re_path

from .search import JiraServerSearchEndpoint
from .webhooks import JiraServerIssueUpdatedWebhook

urlpatterns = [
    re_path(
        r"^issue-updated/(?P<token>[^\/]+)/$",
        JiraServerIssueUpdatedWebhook.as_view(),
        name="sentry-extensions-jiraserver-issue-updated",
    ),
    re_path(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        JiraServerSearchEndpoint.as_view(),
        name="sentry-extensions-jiraserver-search",
    ),
]

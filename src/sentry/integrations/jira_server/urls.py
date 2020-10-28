from __future__ import absolute_import

from django.conf.urls import url

from .search import JiraServerSearchEndpoint
from .webhooks import JiraIssueUpdatedWebhook

urlpatterns = [
    url(
        r"^issue-updated/(?P<token>[^\/]+)/$",
        JiraIssueUpdatedWebhook.as_view(),
        name="sentry-extensions-jiraserver-issue-updated",
    ),
    url(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        JiraServerSearchEndpoint.as_view(),
        name="sentry-extensions-jiraserver-search",
    ),
]

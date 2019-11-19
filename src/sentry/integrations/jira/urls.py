from __future__ import absolute_import, print_function

from django.conf.urls import url

from .configure import JiraConfigureView
from .descriptor import JiraDescriptorEndpoint
from .installed import JiraInstalledEndpoint
from .search import JiraSearchEndpoint
from .uninstalled import JiraUninstalledEndpoint
from .webhooks import JiraIssueUpdatedWebhook


urlpatterns = [
    url(r"^configure/$", JiraConfigureView.as_view()),
    url(r"^descriptor/$", JiraDescriptorEndpoint.as_view()),
    url(r"^installed/$", JiraInstalledEndpoint.as_view()),
    url(r"^uninstalled/$", JiraUninstalledEndpoint.as_view()),
    url(
        r"^issue-updated/$",
        JiraIssueUpdatedWebhook.as_view(),
        name="sentry-extensions-jira-issue-updated",
    ),
    url(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        JiraSearchEndpoint.as_view(),
        name="sentry-extensions-jira-search",
    ),
]

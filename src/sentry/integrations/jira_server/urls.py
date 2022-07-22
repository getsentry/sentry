from django.conf.urls import url

from sentry.integrations.jira.views import (
    JiraExtensionConfigurationView,
    JiraIssueHookView,
    JiraUiHookView,
)
from sentry.integrations.jira.webhooks import (
    JiraDescriptorEndpoint,
    JiraInstalledEndpoint,
    JiraUninstalledEndpoint,
)

from .search import JiraServerSearchEndpoint
from .webhooks import JiraIssueUpdatedWebhook

urlpatterns = [
    url(r"^ui-hook/$", JiraUiHookView.as_view()),
    url(r"^descriptor/$", JiraDescriptorEndpoint.as_view()),
    url(r"^installed/$", JiraInstalledEndpoint.as_view(), name="sentry-extensions-jira-installed"),
    url(r"^uninstalled/$", JiraUninstalledEndpoint.as_view()),
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
    url(r"^configure/$", JiraExtensionConfigurationView.as_view()),
    url(
        r"^issue/(?P<issue_key>[^\/]+)/$",
        JiraIssueHookView.as_view(),
        name="sentry-extensions-jira-issue-hook",
    ),
]

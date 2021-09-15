from django.conf.urls import url

from .descriptor import JiraDescriptorEndpoint
from .extension_configuration import JiraExtensionConfigurationView
from .installed import JiraInstalledEndpoint
from .issue_hook import JiraIssueHookView
from .search import JiraSearchEndpoint
from .ui_hook import JiraUiHookView
from .uninstalled import JiraUninstalledEndpoint
from .webhooks import JiraIssueUpdatedWebhook

urlpatterns = [
    url(r"^ui-hook/$", JiraUiHookView.as_view()),
    url(r"^descriptor/$", JiraDescriptorEndpoint.as_view()),
    url(r"^installed/$", JiraInstalledEndpoint.as_view(), name="sentry-extensions-jira-installed"),
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
    url(r"^configure/$", JiraExtensionConfigurationView.as_view()),
    url(
        r"^issue/(?P<issue_key>[^\/]+)/$",
        JiraIssueHookView.as_view(),
        name="sentry-extensions-jira-issue-hook",
    ),
]

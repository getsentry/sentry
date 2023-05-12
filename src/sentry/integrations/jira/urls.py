from django.conf.urls import url

from .endpoints import JiraDescriptorEndpoint, JiraSearchEndpoint
from .views import (
    JiraExtensionConfigurationView,
    JiraSentryInstallationView,
    JiraSentryIssueDetailsView,
)
from .webhooks import (
    JiraIssueUpdatedWebhook,
    JiraSentryInstalledWebhook,
    JiraSentryUninstalledWebhook,
)

urlpatterns = [
    url(
        r"^ui-hook/$",
        JiraSentryInstallationView.as_view(),
    ),
    url(
        r"^descriptor/$",
        JiraDescriptorEndpoint.as_view(),
    ),
    url(
        r"^installed/$",
        JiraSentryInstalledWebhook.as_view(),
        name="sentry-extensions-jira-installed",
    ),
    url(
        r"^uninstalled/$",
        JiraSentryUninstalledWebhook.as_view(),
    ),
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
    url(
        r"^configure/$",
        JiraExtensionConfigurationView.as_view(),
    ),
    url(
        r"^issue/(?P<issue_key>[^\/]+)/$",
        JiraSentryIssueDetailsView.as_view(),
        name="sentry-extensions-jira-issue-hook",
    ),
]

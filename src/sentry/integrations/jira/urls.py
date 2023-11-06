from django.urls import re_path

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
    re_path(
        r"^ui-hook/$",
        JiraSentryInstallationView.as_view(),
        name="sentry-extensions-jira-ui-hook",
    ),
    re_path(
        r"^descriptor/$",
        JiraDescriptorEndpoint.as_view(),
        name="sentry-extensions-descriptor",
    ),
    re_path(
        r"^installed/$",
        JiraSentryInstalledWebhook.as_view(),
        name="sentry-extensions-jira-installed",
    ),
    re_path(
        r"^uninstalled/$",
        JiraSentryUninstalledWebhook.as_view(),
        name="sentry-extensions-jira-uninstalled",
    ),
    re_path(
        r"^issue-updated/$",
        JiraIssueUpdatedWebhook.as_view(),
        name="sentry-extensions-jira-issue-updated",
    ),
    re_path(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        JiraSearchEndpoint.as_view(),
        name="sentry-extensions-jira-search",
    ),
    re_path(
        r"^configure/$",
        JiraExtensionConfigurationView.as_view(),
        name="sentry-extensions-jira-configuration",
    ),
    re_path(
        r"^issue/(?P<issue_key>[^\/]+)/$",
        JiraSentryIssueDetailsView.as_view(),
        name="sentry-extensions-jira-issue-hook",
    ),
]

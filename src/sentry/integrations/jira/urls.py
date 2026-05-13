from django.urls import re_path

from .endpoints import JiraDescriptorEndpoint, JiraSearchEndpoint
from .views import (
    JiraExtensionConfigurationView,
    JiraSentryInstallationView,
    JiraSentryIssueDetailsControlView,
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
        r"^search/(?P<organization_id_or_slug>[^/]+)/(?P<integration_id>\d+)/$",
        JiraSearchEndpoint.as_view(),
        name="sentry-extensions-jira-search",
    ),
    re_path(
        r"^configure/$",
        JiraExtensionConfigurationView.as_view(),
        name="sentry-extensions-jira-configuration",
    ),
    # TODO(cells): Legacy URL, remove once Atlassian marketplace version updated.
    # Our descriptor now correctly points at `/issue-details/{key}/`, but
    # Atlassian only re-snapshots it when a new Marketplace version of `sentry.io.jira` is
    # published — existing tenants keep hitting this path until that happens. Routed to the
    # control view by `JiraRequestParser.immediate_response_cell_classes`.
    re_path(
        r"^issue/(?P<issue_key>[^/]+)/$",
        JiraSentryIssueDetailsView.as_view(),
        name="sentry-extensions-jira-issue-hook",
    ),
    re_path(
        r"^issue-details/(?P<issue_key>[^/]+)/$",
        JiraSentryIssueDetailsControlView.as_view(),
        name="sentry-extensions-jira-issue-hook-control",
    ),
]

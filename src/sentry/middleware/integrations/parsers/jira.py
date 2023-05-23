from __future__ import annotations

from sentry.integrations.jira.endpoints import JiraDescriptorEndpoint, JiraSearchEndpoint
from sentry.integrations.jira.views import (
    JiraExtensionConfigurationView,
    JiraSentryInstallationView,
    JiraSentryIssueDetailsView,
)
from sentry.integrations.jira.webhooks import (
    JiraIssueUpdatedWebhook,
    JiraSentryInstalledWebhook,
    JiraSentryUninstalledWebhook,
)
from sentry.integrations.jira.webhooks.base import JiraWebhookBase
from sentry.integrations.utils.atlassian_connect import parse_integration_from_request
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations import Integration


class JiraRequestParser(BaseRequestParser):
    provider = "jira"

    control_classes = ["JiraDescriptorEndpoint"]

    region_classes = [
        JiraSentryInstallationView,
        JiraDescriptorEndpoint,
        JiraSentryInstalledWebhook,
        JiraSentryUninstalledWebhook,
        JiraIssueUpdatedWebhook,
        JiraSearchEndpoint,
        JiraExtensionConfigurationView,
        JiraSentryIssueDetailsView,
    ]

    def get_integration_from_request(self) -> Integration | None:
        view_class = self.match.func.view_class
        if issubclass(view_class, JiraWebhookBase):
            return parse_integration_from_request(request=self.request, provider=self.provider)
        return None

    def get_response(self):
        view_class_name = self.match.func.view_class.__name__
        if view_class_name in self.control_classes:
            return self.get_response_from_control_silo()

        return super().get_response()

from __future__ import annotations

import logging

import sentry_sdk

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
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    parse_integration_from_request,
)
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations import Integration
from sentry.models.outbox import WebhookProviderIdentifier

logger = logging.getLogger(__name__)


class JiraRequestParser(BaseRequestParser):
    provider = "jira"
    webhook_identifier = WebhookProviderIdentifier.JIRA

    control_classes = [
        JiraDescriptorEndpoint,
        JiraSentryInstallationView,
        JiraSentryInstalledWebhook,
        JiraSentryUninstalledWebhook,
        JiraExtensionConfigurationView,
        JiraSearchEndpoint,
    ]

    immediate_response_region_classes = [JiraSentryIssueDetailsView]
    outbox_response_region_classes = [JiraIssueUpdatedWebhook]

    def get_integration_from_request(self) -> Integration | None:
        try:
            return parse_integration_from_request(request=self.request, provider=self.provider)
        except AtlassianConnectValidationError as e:
            sentry_sdk.capture_exception(e)
        return None

    def get_response(self):
        if self.view_class in self.control_classes:
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.info("%s.no_regions", self.provider, extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        if len(regions) > 1:
            # Since Jira is region_restricted (see JiraIntegrationProvider) we can just pick the
            # first region to forward along to.
            logger.info(
                "%s.too_many_regions",
                self.provider,
                extra={"path": self.request.path, "regions": regions},
            )
            return self.get_response_from_control_silo()

        if self.view_class in self.immediate_response_region_classes:
            return self.get_response_from_region_silo(region=regions[0])

        if self.view_class in self.outbox_response_region_classes:
            return self.get_response_from_outbox_creation(regions=regions)

        return self.get_response_from_control_silo()

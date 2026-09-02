from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.jira.endpoints import JiraDescriptorEndpoint, JiraSearchEndpoint
from sentry.integrations.jira.views import (
    JiraConfigureRedirectView,
    JiraSentryInstallationView,
    JiraSentryIssueDetailsView,
)
from sentry.integrations.jira.views.sentry_issue_details import JiraSentryIssueDetailsControlView
from sentry.integrations.jira.webhooks import (
    JiraIssueUpdatedWebhook,
    JiraSentryInstalledWebhook,
    JiraSentryUninstalledWebhook,
)
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    parse_integration_from_request,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


class JiraRequestParser(BaseRequestParser):
    provider = IntegrationProviderSlug.JIRA.value
    webhook_identifier = WebhookProviderIdentifier.JIRA

    # Far lower volume than GitHub: enough to unserialize a burst without thinning
    # mailboxes into scheduler rows that each carry a handful of payloads.
    mailbox_bucket_count = 10

    control_classes = [
        JiraDescriptorEndpoint,
        JiraSentryInstallationView,
        JiraSentryInstalledWebhook,
        JiraSentryUninstalledWebhook,
        JiraConfigureRedirectView,
        JiraSearchEndpoint,
        JiraSentryIssueDetailsControlView,
    ]

    immediate_response_cell_classes = [JiraSentryIssueDetailsView]
    outbox_response_cell_classes = [JiraIssueUpdatedWebhook]

    def get_integration_from_request(self) -> Integration | None:
        try:
            return parse_integration_from_request(request=self.request, provider=self.provider)
        except AtlassianConnectValidationError as e:
            sentry_sdk.capture_exception(e)
        return None

    def get_response(self) -> HttpResponseBase:
        if self.view_class in self.control_classes:
            return self.get_response_from_control_silo()

        integration = self.get_integration_from_request()
        if not integration:
            raise Integration.DoesNotExist()

        cells = self.get_cells_from_organizations()

        if len(cells) == 0:
            return self.get_default_missing_integration_response()

        if self.view_class in self.immediate_response_cell_classes:
            if len(cells) == 1:
                try:
                    return self.get_response_from_cell_silo(cell=cells[0])
                except ApiError as err:
                    sentry_sdk.capture_exception(err)
                    return self.get_response_from_control_silo()
            # TODO(cells): Remove once all installs have migrated to JiraSentryIssueDetailsControlView.
            return JiraSentryIssueDetailsControlView.as_view()(self.request, **self.match.kwargs)

        if self.view_class in self.outbox_response_cell_classes:
            return self.get_response_from_webhookpayload(
                cells=cells,
                identifier=self.get_mailbox_identifier(integration, self.get_request_body()),
                integration_id=integration.id,
            )

        return self.get_response_from_control_silo()

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """The Connect descriptor registers only `jira:issue_updated`, so the issue is
        the only axis a Jira mailbox can be split on.
        """
        try:
            return int(get_path(data, "issue", "id"))
        except (TypeError, ValueError):
            return None

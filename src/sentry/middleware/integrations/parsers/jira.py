from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from django.http import HttpResponse
from django.http.response import HttpResponseBase

from sentry.constants import ObjectStatus
from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.jira.endpoints import JiraDescriptorEndpoint, JiraSearchEndpoint
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocationTokenError,
    ForgeSigningKeysUnavailableError,
    jira_cloud_id,
    verify_forge_request,
)
from sentry.integrations.jira.views import (
    JiraConfigureRedirectView,
    JiraSentryInstallationView,
    JiraSentryIssueDetailsView,
)
from sentry.integrations.jira.views.sentry_issue_details import JiraSentryIssueDetailsControlView
from sentry.integrations.jira.webhooks import (
    JiraForgeInstallationWebhook,
    JiraForgeIssueUpdatedWebhook,
    JiraIssueUpdatedWebhook,
    JiraSentryInstalledWebhook,
    JiraSentryUninstalledWebhook,
)
from sentry.integrations.jira.webhooks.forge_issue_updated import FORGE_ISSUE_UPDATED_MODULE_KEY
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    parse_integration_from_request,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.util import WEBHOOK_DELIVERY_SIGNATURE_HEADER, encode_webhook_delivery_signature

logger = logging.getLogger(__name__)


class JiraRequestParser(BaseRequestParser):
    provider = IntegrationProviderSlug.JIRA.value
    webhook_identifier = WebhookProviderIdentifier.JIRA

    control_classes = [
        JiraDescriptorEndpoint,
        JiraForgeInstallationWebhook,
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

        if self.view_class == JiraForgeIssueUpdatedWebhook:
            return self.get_forge_issue_updated_response()

        integration = self.integration_for_request()
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
                mailbox=self.get_mailbox(integration, self.get_request_body()),
                integration_id=integration.id,
            )

        return self.get_response_from_control_silo()

    def get_forge_issue_updated_response(self) -> HttpResponseBase:
        """The Forge invocation token lives for under a minute, less than a queued event
        can wait, so it's verified here and the queued event is signed for the cell
        instead. The Forge OAuth tokens are dropped so they aren't stored with it.
        """
        # Checked first, since verifying the token is the expensive part.
        if shed_response := self.get_shed_response():
            return shed_response

        try:
            invocation = verify_forge_request(self.request)
        except ForgeSigningKeysUnavailableError:
            return HttpResponse(status=503)
        except ForgeInvocationTokenError:
            return HttpResponse(status=401)
        if invocation.module_key != FORGE_ISSUE_UPDATED_MODULE_KEY:
            return HttpResponse(status=403)

        cloud_id = jira_cloud_id(invocation)
        if cloud_id is None:
            return HttpResponse(status=400)

        # Only Forge-native sites are keyed by cloud ID for now. Sites that moved from
        # Connect keep their clientKey, so their events are dropped here and they keep
        # getting the Connect issue-updated webhook until they're rekeyed to the cloud ID.
        integration = Integration.objects.filter(
            provider=self.provider, external_id=cloud_id, status=ObjectStatus.ACTIVE
        ).first()
        forge = (integration.metadata.get("forge") or {}) if integration else {}
        # Only the installation that owns the integration may update its issues.
        if integration is None or forge.get("installation_id") != invocation.installation_id:
            return HttpResponse(status=202)

        organizations = self.get_organizations_from_integration(integration)
        if not organizations:
            return HttpResponse(status=202)

        signature = encode_webhook_delivery_signature(
            self.request.get_full_path(),
            self.request.headers.get("Authorization", ""),
            self.request.body,
        )
        if signature is None:
            # The cell would reject it unsigned, so have Forge retry instead.
            logger.error(
                "jira.forge.issue_updated.unsigned", extra={"integration_id": integration.id}
            )
            return HttpResponse(status=503)

        return self.get_response_from_webhookpayload(
            cells=self.get_cells_from_organizations(organizations),
            mailbox=self.get_mailbox(integration, self.get_request_body()),
            integration_id=integration.id,
            header_overrides={
                "X-Forge-OAuth-System": None,
                "X-Forge-OAuth-User": None,
                # Replaces any copy the caller sent.
                WEBHOOK_DELIVERY_SIGNATURE_HEADER: signature,
            },
        )

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """The Connect descriptor registers only `jira:issue_updated`, so the issue is
        the only axis a Jira mailbox can be split on.
        """
        return self.bucket_key_at(data, "issue", "id")

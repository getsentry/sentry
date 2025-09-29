from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.overwatch_webhooks.models import OrganizationSummary, WebhookDetails
from sentry.overwatch_webhooks.overwatch_consent.service import overwatch_consent_service
from sentry.overwatch_webhooks.webhook_publisher import OverwatchWebhookPublisher
from sentry.types.region import get_region_by_name

# TODO: Double check that this includes all of the events you care about.
GITHUB_EVENTS_TO_FORWARD_OVERWATCH = {
    "installation",
    "installation_repositories",
    "issue_comment",
    "pull_request",
    "pull_request_review_comment",
}


@dataclass(frozen=True)
class OverwatchOrganizationContext:
    organization_integration: OrganizationIntegration
    organization_mapping: OrganizationMapping


class OverwatchGithubWebhookForwarder:
    integration: Integration

    def __init__(self, integration: Integration):
        self.integration = integration

    def should_forward_to_overwatch(self, event: Mapping[str, Any]) -> bool:
        return event.get("action") in GITHUB_EVENTS_TO_FORWARD_OVERWATCH

    def _get_org_summaries_by_region_for_integration(
        self, integration: Integration
    ) -> dict[str, list[OrganizationSummary]]:
        org_integrations = OrganizationIntegration.objects.filter(
            integration=integration, status=ObjectStatus.ACTIVE
        )
        organization_ids = [org_integration.organization_id for org_integration in org_integrations]
        org_mappings = OrganizationMapping.objects.filter(organization_id__in=organization_ids)
        org_mappings_by_id = {
            org_mapping.organization_id: org_mapping for org_mapping in org_mappings
        }

        org_contexts_by_region: dict[str, list[OrganizationSummary]] = defaultdict(list)

        for org_integration in org_integrations:
            org_mapping = org_mappings_by_id[org_integration.organization_id]
            region_name = org_mapping.region_name

            org_contexts_by_region[region_name].append(
                OrganizationSummary.from_organization_mapping_and_integration(
                    org_integration=org_integration,
                    organization_mapping=org_mapping,
                )
            )

        return org_contexts_by_region

    def _get_org_ids(self, org_contexts: list[OrganizationSummary]) -> list[int]:
        return [org_context.id for org_context in org_contexts]

    def get_organizations_with_consent(
        self, integration: Integration
    ) -> dict[str, list[OrganizationSummary]]:
        """
        Collect all organizations related to the given organization integrations
        that have granted consent for AI features.
        """
        org_summaries_by_region = self._get_org_summaries_by_region_for_integration(integration)
        # Group organizations by region for efficient RPC calls
        # Get consent status for all organizations, one request per region
        consent_statuses_by_org_id: dict[int, bool] = {}
        org_summaries_with_consent_by_region: dict[str, list[OrganizationSummary]] = defaultdict(
            list
        )

        for region_name, org_summaries in org_summaries_by_region.items():
            org_ids = self._get_org_ids(org_summaries)
            region_consent_statuses = overwatch_consent_service.get_organization_consent_status(
                organization_ids=org_ids,
                region_name=region_name,
            )
            for org_id, consent_status in region_consent_statuses.items():
                consent_statuses_by_org_id[org_id] = consent_status.has_consent

            for org_summary in org_summaries:
                if consent_statuses_by_org_id[org_summary.id]:
                    org_summaries_with_consent_by_region[region_name].append(org_summary)

        return org_summaries_with_consent_by_region

    def forward_if_applicable(self, event: Mapping[str, Any]):
        orgs_by_region = self.get_organizations_with_consent(integration=self.integration)
        if not orgs_by_region or not self.should_forward_to_overwatch(event):
            return

        for region_name, org_summaries in orgs_by_region.items():
            webhook_detail = WebhookDetails(
                organizations=org_summaries,
                webhook_body=dict(event),
                integration_provider=self.integration.provider,
                region=region_name,
            )

            publisher = OverwatchWebhookPublisher(
                integration_provider=self.integration.provider,
                region=get_region_by_name(region_name),
            )
            publisher.enqueue_webhook(webhook_detail)

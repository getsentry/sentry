from collections.abc import Mapping
from typing import Any

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.overwatch_webhooks.models import OrganizationSummary, WebhookDetails
from sentry.overwatch_webhooks.overwatch_consent.service import overwatch_consent_service
from sentry.overwatch_webhooks.webhook_publisher import OverwatchWebhookPublisher

# TODO: Double check that this includes all of the events you care about.
GITHUB_EVENTS_TO_FORWARD_OVERWATCH = {
    "installation",
    "installation_repositories",
    "issue_comment",
    "pull_request",
    "pull_request_review_comment",
}


class OverwatchGithubWebhookForwarder:
    integration: Integration
    publisher: OverwatchWebhookPublisher

    def __init__(self, integration: Integration):
        self.integration = integration
        self.publisher = OverwatchWebhookPublisher(integration_provider=integration.provider)

    def should_forward_to_overwatch(self, event: Mapping[str, Any]) -> bool:
        return event.get("action") in GITHUB_EVENTS_TO_FORWARD_OVERWATCH

    def get_organizations_with_consent(self, integration: Integration) -> list[OrganizationSummary]:
        """
        Collect all organizations related to the given organization integrations
        that have granted consent for AI features.
        """

        org_integrations = OrganizationIntegration.objects.filter(integration=integration)
        organization_ids = [org_integration.organization_id for org_integration in org_integrations]
        org_mappings = OrganizationMapping.objects.filter(organization_id__in=organization_ids)

        org_mappings_by_id = {
            org_mapping.organization_id: org_mapping for org_mapping in org_mappings
        }

        # Group organizations by region for efficient RPC calls
        orgs_by_region: dict[str, list[int]] = {}
        for org_mapping in org_mappings:
            region_name = org_mapping.region_name
            if region_name not in orgs_by_region:
                orgs_by_region[region_name] = []
            orgs_by_region[region_name].append(org_mapping.organization_id)

        # Get consent status for all organizations, one request per region
        consent_statuses: dict[int, bool] = {}
        for region_name, org_ids in orgs_by_region.items():
            region_consent_statuses = overwatch_consent_service.get_organization_consent_status(
                organization_ids=org_ids,
                region_name=region_name,
            )
            for org_id, consent_status in region_consent_statuses.items():
                consent_statuses[org_id] = consent_status.has_consent

        # Build result with organizations that have consent
        org_summaries: list[OrganizationSummary] = []
        for org_integration in org_integrations:
            org_mapping = org_mappings_by_id[org_integration.organization_id]
            has_consent = consent_statuses.get(org_integration.organization_id, False)
            if has_consent:
                org_summaries.append(
                    OrganizationSummary.from_organization_mapping(org_mapping, org_integration)
                )

        return org_summaries

    def forward_if_applicable(self, event: Mapping[str, Any]):
        orgs_with_consent = self.get_organizations_with_consent(integration=self.integration)
        if not orgs_with_consent or not self.should_forward_to_overwatch(event):
            return

        webhook_detail = WebhookDetails(
            organizations=orgs_with_consent,
            webhook_body=dict(event),
            integration_provider=self.integration.provider,
        )

        self.publisher.enqueue_webhook(webhook_detail)

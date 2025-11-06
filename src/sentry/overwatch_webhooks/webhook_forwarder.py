import logging
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.overwatch_webhooks.types import OrganizationSummary, WebhookDetails
from sentry.overwatch_webhooks.webhook_publisher import OverwatchWebhookPublisher
from sentry.types.region import get_region_by_name
from sentry.utils import metrics

# TODO: Double check that this includes all of the events you care about.
GITHUB_EVENTS_TO_FORWARD_OVERWATCH = {
    "installation",
    "installation_repositories",
    "issue_comment",
    "pull_request",
    "pull_request_review_comment",
    "pull_request_review",
}


GITHUB_INSTALLATION_TARGET_ID_HEADER = "X-GitHub-Hook-Installation-Target-ID"
DJANGO_HTTP_GITHUB_INSTALLATION_TARGET_ID_HEADER = "HTTP_X_GITHUB_HOOK_INSTALLATION_TARGET_ID"


@dataclass(frozen=True)
class OverwatchOrganizationContext:
    organization_integration: OrganizationIntegration
    organization_mapping: OrganizationMapping


logger = logging.getLogger("sentry.overwatch_webhook_forwarder")


class OverwatchGithubWebhookForwarder:
    integration: Integration

    def __init__(self, integration: Integration):
        self.integration = integration

    def should_forward_to_overwatch(self, headers: Mapping[str, str]) -> bool:
        return headers.get("HTTP_X_GITHUB_EVENT") in GITHUB_EVENTS_TO_FORWARD_OVERWATCH

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

    def forward_if_applicable(self, event: Mapping[str, Any], headers: Mapping[str, str]):
        try:
            enabled_regions = options.get("overwatch.enabled-regions")
            if not enabled_regions:
                # feature isn't enabled, no work to do
                return

            orgs_by_region = self._get_org_summaries_by_region_for_integration(
                integration=self.integration
            )

            if not orgs_by_region or not self.should_forward_to_overwatch(headers):
                return

            # We can conditionally opt into forwarding on a per-region basis,
            # similar to codecov's current implementation.
            for region_name, org_summaries in orgs_by_region.items():
                if region_name not in enabled_regions:
                    continue

                raw_app_id = headers.get(
                    GITHUB_INSTALLATION_TARGET_ID_HEADER,
                ) or headers.get(DJANGO_HTTP_GITHUB_INSTALLATION_TARGET_ID_HEADER)
                app_id: int | None = None
                if raw_app_id is not None:
                    try:
                        app_id = int(raw_app_id)
                    except (TypeError, ValueError):
                        app_id = None

                webhook_detail = WebhookDetails(
                    organizations=org_summaries,
                    webhook_body=dict(event),
                    webhook_headers=headers,
                    integration_provider=self.integration.provider,
                    region=region_name,
                    app_id=app_id,
                )

                publisher = OverwatchWebhookPublisher(
                    integration_provider=self.integration.provider,
                    region=get_region_by_name(region_name),
                )
                publisher.enqueue_webhook(webhook_detail)
                metrics.incr(
                    "overwatch.forward-webhooks.success",
                    sample_rate=1.0,
                    tags={"forward_region": region_name},
                )
        except Exception:
            metrics.incr(
                "overwatch.forward-webhooks.forward-error",
                sample_rate=1.0,
                tags={"forward_region": region_name},
            )
            logger.exception(
                "overwatch.forward-webhooks.forward-error", extra={"forward_region": region_name}
            )

import logging
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.github.webhook_types import (
    GITHUB_INSTALLATION_TARGET_ID_HEADER,
    GITHUB_WEBHOOK_TYPE_HEADER_KEY,
    GithubWebhookType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.overwatch_webhooks.types import OrganizationSummary, WebhookDetails
from sentry.overwatch_webhooks.webhook_publisher import OverwatchWebhookPublisher
from sentry.types.region import get_region_by_name
from sentry.utils import metrics

# TODO: Double check that this includes all of the events you care about.
GITHUB_EVENTS_TO_FORWARD_OVERWATCH = {
    GithubWebhookType.INSTALLATION,
    GithubWebhookType.INSTALLATION_REPOSITORIES,
    GithubWebhookType.ISSUE_COMMENT,
    GithubWebhookType.PULL_REQUEST,
    GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT,
    GithubWebhookType.PULL_REQUEST_REVIEW,
}


@dataclass(frozen=True)
class OverwatchOrganizationContext:
    organization_integration: OrganizationIntegration
    organization_mapping: OrganizationMapping


logger = logging.getLogger("sentry.overwatch_webhook_forwarder")


def verbose_log(msg: str, *, extra: dict | None = None) -> None:
    if bool(options.get("overwatch.forward-webhooks.verbose", False)):
        logger.info(msg, extra=extra)


class OverwatchGithubWebhookForwarder:
    integration: Integration

    def __init__(self, integration: Integration):
        self.integration = integration

    def should_forward_to_overwatch(self, headers: Mapping[str, str]) -> bool:
        event_type = headers.get(GITHUB_WEBHOOK_TYPE_HEADER_KEY)
        verbose_log(
            "overwatch.debug.should_forward_to_overwatch.checked",
            extra={
                "event_type": event_type,
                "should_forward": event_type in GITHUB_EVENTS_TO_FORWARD_OVERWATCH,
            },
        )
        return event_type in GITHUB_EVENTS_TO_FORWARD_OVERWATCH

    def _get_org_summaries_by_region_for_integration(
        self, integration: Integration
    ) -> dict[str, list[OrganizationSummary]]:
        org_integrations = OrganizationIntegration.objects.filter(
            integration=integration, status=ObjectStatus.ACTIVE
        )
        verbose_log(
            "overwatch.debug.org_integrations.fetched",
            extra={
                "integration_id": integration.id,
                "org_integration_ids": [oi.organization_id for oi in org_integrations],
                "count": len(org_integrations),
            },
        )
        organization_ids = [org_integration.organization_id for org_integration in org_integrations]
        org_mappings = OrganizationMapping.objects.filter(organization_id__in=organization_ids)
        verbose_log(
            "overwatch.debug.org_mappings.fetched",
            extra={
                "org_mapping_ids": [om.organization_id for om in org_mappings],
                "count": len(org_mappings),
            },
        )
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
            verbose_log(
                "overwatch.debug.organizations.grouped_by_region",
                extra={
                    "region_name": region_name,
                    "org_id": org_integration.organization_id,
                },
            )

        verbose_log(
            "overwatch.debug.org_contexts_by_region.final",
            extra={
                "regions": list(org_contexts_by_region.keys()),
                "counts_per_region": {k: len(v) for k, v in org_contexts_by_region.items()},
            },
        )

        return org_contexts_by_region

    def forward_if_applicable(self, event: Mapping[str, Any], headers: Mapping[str, str]):
        region_name = None
        try:
            enabled_regions = options.get("overwatch.enabled-regions")
            if not enabled_regions:
                # feature isn't enabled, no work to do
                return

            orgs_by_region = self._get_org_summaries_by_region_for_integration(
                integration=self.integration
            )
            verbose_log(
                "overwatch.debug.orgs_by_region",
                extra={
                    "regions": list(orgs_by_region.keys()),
                    "counts_per_region": {k: len(v) for k, v in orgs_by_region.items()},
                },
            )

            if not orgs_by_region or not self.should_forward_to_overwatch(headers):
                verbose_log(
                    "overwatch.debug.skipped_forwarding",
                    extra={
                        "orgs_by_region_empty": not orgs_by_region,
                        "event_in_forward_list": self.should_forward_to_overwatch(headers),
                    },
                )
                return

            # We can conditionally opt into forwarding on a per-region basis,
            # similar to codecov's current implementation.
            for region_name, org_summaries in orgs_by_region.items():
                verbose_log(
                    "overwatch.debug.check_region",
                    extra={
                        "region_name": region_name,
                        "enabled": region_name in enabled_regions,
                        "org_summaries_count": len(org_summaries),
                    },
                )
                if region_name not in enabled_regions:
                    continue

                raw_app_id = headers.get(
                    GITHUB_INSTALLATION_TARGET_ID_HEADER,
                )
                verbose_log(
                    "overwatch.debug.raw_app_id",
                    extra={"region_name": region_name, "raw_app_id": raw_app_id},
                )
                app_id: int | None = None
                if raw_app_id is not None:
                    try:
                        app_id = int(raw_app_id)
                    except (TypeError, ValueError):
                        verbose_log(
                            "overwatch.debug.app_id_parse_error",
                            extra={"region_name": region_name, "raw_app_id": raw_app_id},
                        )
                        app_id = None

                formatted_headers = {k: v for k, v in headers.items()}

                webhook_detail = WebhookDetails(
                    organizations=org_summaries,
                    webhook_body=dict(event),
                    webhook_headers=formatted_headers,
                    integration_provider=self.integration.provider,
                    region=region_name,
                    app_id=app_id,
                )

                publisher = OverwatchWebhookPublisher(
                    integration_provider=self.integration.provider,
                    region=get_region_by_name(region_name),
                )
                verbose_log("overwatch.debug.enqueue_webhook", extra={"region_name": region_name})
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

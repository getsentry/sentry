from __future__ import annotations

import logging

from sentry.integrations.jira_server.search import JiraServerSearchEndpoint
from sentry.integrations.jira_server.webhooks import (
    JiraServerIssueUpdatedWebhook,
    get_integration_from_token,
)
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.types.region import RegionResolutionError, get_region_by_name

logger = logging.getLogger(__name__)


class JiraServerRequestParser(BaseRequestParser):
    provider = "jira_server"
    webhook_identifier = WebhookProviderIdentifier.JIRA_SERVER

    immediate_response_region_classes = [JiraServerSearchEndpoint]
    outbox_response_region_classes = [JiraServerIssueUpdatedWebhook]

    def get_response(self):
        if self.match.func.view_class in self.outbox_response_region_classes:  # type: ignore
            token = self.match.kwargs.get("token")
            try:
                integration = get_integration_from_token(token)
            except ValueError as e:
                logger.error("no_integration", extra={"error": str(e)})
                return self.get_response_from_control_silo()
            organizations = self.get_organizations_from_integration(integration=integration)
            regions = self.get_regions_from_organizations(organizations=organizations)
            return self.get_response_from_outbox_creation(regions=regions)

        elif self.match.func.view_class in self.immediate_response_region_classes:  # type: ignore
            organization_slug = self.match.kwargs.get("organization_slug")
            mapping: OrganizationMapping = OrganizationMapping.objects.filter(
                slug=organization_slug
            ).first()
            if not mapping:
                logger.error("no_mapping", extra={"slug": organization_slug})
            try:
                region = get_region_by_name(name=mapping.region_name)
            except RegionResolutionError:
                logger.error(
                    "no_region",
                    extra={"slug": organization_slug, "mapping_region": mapping.region_name},
                )
                return self.get_response_from_control_silo()
            return self.get_response_from_region_silo(region=region)

        return self.get_response_from_control_silo()

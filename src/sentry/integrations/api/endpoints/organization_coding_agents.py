from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.services.integration import integration_service

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationCodingAgentsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization) -> Response:
        """Get all available coding agent integrations for the organization."""
        if not features.has("organizations:seer-coding-agent-integrations", organization):
            return Response({"detail": "Feature not available"}, status=404)

        try:
            # Find all installed coding agent integrations using hybrid cloud service
            org_integrations = integration_service.get_organization_integrations(
                organization_id=organization.id,
                providers=get_coding_agent_providers(),
                status=ObjectStatus.ACTIVE,
            )

            # Serialize the integrations
            integrations_data = []
            for org_integration in org_integrations:
                try:
                    # Get the full integration details using the integration service
                    integration = integration_service.get_integration(
                        organization_integration_id=org_integration.id,
                        status=ObjectStatus.ACTIVE,
                    )

                    if not integration:
                        continue

                    integrations_data.append(
                        {
                            "id": str(integration.id),
                            "name": integration.name,
                            "provider": integration.provider,
                        }
                    )
                except Exception:
                    logger.exception(
                        "coding_agent.integration_processing_error",
                        extra={
                            "organization_id": organization.id,
                        },
                    )
                    # Continue processing other integrations
                    continue

            logger.info(
                "coding_agent.list_integrations",
                extra={"organization_id": organization.id, "count": len(integrations_data)},
            )

            return self.respond({"integrations": integrations_data})

        except Exception:
            logger.exception(
                "coding_agent.list_error",
                extra={"organization_id": organization.id},
            )
            return self.respond(
                {"error": "Failed to retrieve coding agent integrations"}, status=500
            )

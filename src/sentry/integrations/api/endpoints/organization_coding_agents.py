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

        integrations = integration_service.get_integrations(
            organization_id=organization.id,
            providers=get_coding_agent_providers(),
            status=ObjectStatus.ACTIVE,
        )

        integrations_data = [
            {
                "id": str(integration.id),
                "name": integration.name,
                "provider": integration.provider,
            }
            for integration in integrations
        ]

        logger.info(
            "coding_agent.list_integrations",
            extra={"organization_id": organization.id, "count": len(integrations_data)},
        )

        return self.respond({"integrations": integrations_data})

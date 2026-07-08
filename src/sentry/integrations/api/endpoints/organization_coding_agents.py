from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcException
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.services.github_copilot_identity import github_copilot_identity_service
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class OrganizationCodingAgentsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationEventPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """Get all available coding agent integrations for the organization."""
        integrations = integration_service.get_integrations(
            organization_id=organization.id,
            providers=get_coding_agent_providers(),
            status=ObjectStatus.ACTIVE,
        )

        integrations_data: list[dict[str, str | bool | None]] = [
            {
                "id": str(integration.id),
                "name": integration.name,
                "provider": integration.provider,
            }
            for integration in integrations
            if integration.provider != "github_copilot"
        ]

        github_copilot_installed = any(i.provider == "github_copilot" for i in integrations)
        if github_copilot_installed:
            has_identity = False
            if request.user and request.user.id:
                try:
                    access_token = github_copilot_identity_service.get_access_token_for_user(
                        user_id=request.user.id
                    )
                    has_identity = access_token is not None
                except RpcException:
                    # If the identity service is unavailable, default to no identity
                    # This ensures the endpoint remains functional even if the service is down
                    logger.warning(
                        "Failed to check GitHub Copilot identity",
                        extra={"user_id": request.user.id},
                        exc_info=True,
                    )
                    has_identity = False

            integrations_data.append(
                {
                    "id": None,
                    "name": "GitHub Copilot",
                    "provider": "github_copilot",
                    "requires_identity": True,
                    "has_identity": has_identity,
                }
            )

        logger.info(
            "coding_agent.list_integrations",
            extra={"organization_id": organization.id, "count": len(integrations_data)},
        )

        return self.respond({"integrations": integrations_data})

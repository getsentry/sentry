from __future__ import annotations

import logging
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationIntegrationsPermission,
)
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.exceptions import NotRegistered
from sentry.integrations.manager import default_manager as integrations
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.services.integration import integration_service
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext

logger = logging.getLogger(__name__)


@control_silo_endpoint
class OrganizationIntegrationDirectEnableEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        provider_key: str,
        **kwargs: Any,
    ) -> Response:
        """Directly install an integration that requires no pipeline configuration."""
        try:
            provider = integrations.get(provider_key)
        except NotRegistered:
            return Response({"detail": "Provider not found."}, status=404)

        if not (provider.metadata and provider.metadata.aspects.get("directEnable")):
            return Response(
                {"detail": "Direct enable is not supported for this integration."}, status=400
            )

        if not provider.allow_multiple:
            existing = integration_service.get_integrations(
                organization_id=organization.id,
                providers=[provider_key],
                status=ObjectStatus.ACTIVE,
            )
            if existing:
                return Response({"detail": "Integration is already enabled."}, status=400)

        data = provider.build_integration({})
        integration = ensure_integration(provider.key, data)

        user = request.user if request.user.is_authenticated else None
        org_integration = integration.add_organization(organization, user)
        if org_integration is None:
            return Response({"detail": "Could not create the integration."}, status=400)

        return Response(serialize(org_integration, request.user))

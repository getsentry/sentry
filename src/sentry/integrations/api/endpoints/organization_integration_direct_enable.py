from __future__ import annotations

from typing import Any

from django.db import IntegrityError, router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
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
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.services.integration import integration_service
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext


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

        if provider.requires_feature_flag:
            flag = (
                provider.feature_flag_name
                or "organizations:integrations-%s" % provider.key.replace("_", "-")
            )
            if not features.has(flag, organization, actor=request.user):
                return Response({"detail": "Provider not found."}, status=404)

        if not provider.allow_multiple:
            existing = integration_service.get_integrations(
                organization_id=organization.id,
                providers=[provider_key],
                status=ObjectStatus.ACTIVE,
            )
            if existing:
                return Response({"detail": "Integration is already enabled."}, status=400)

        try:
            with transaction.atomic(using=router.db_for_write(OrganizationIntegration)):
                if not provider.allow_multiple:
                    OrganizationMapping.objects.select_for_update().filter(
                        organization_id=organization.id
                    ).exists()

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
                    raise IntegrityError
        except IntegrityError:
            return Response({"detail": "Could not create the integration."}, status=400)

        provider.create_audit_log_entry(integration, organization, request, "install")
        return Response(serialize(org_integration, request.user))

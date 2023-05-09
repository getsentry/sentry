from __future__ import annotations

from django.db import transaction
from django.http import Http404
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import OrganizationIntegrationSerializer
from sentry.features.helpers import requires_feature
from sentry.models import ObjectStatus, OrganizationIntegration, ScheduledDeletion
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.audit import create_audit_entry


class IntegrationSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    domain = serializers.URLField(required=False, allow_blank=True)


@control_silo_endpoint
class OrganizationIntegrationDetailsEndpoint(OrganizationIntegrationBaseEndpoint):
    @never_cache
    def get(self, request: Request, organization, integration_id) -> Response:
        org_integration = self.get_organization_integration(organization.id, integration_id)

        return self.respond(
            serialize(
                org_integration, request.user, OrganizationIntegrationSerializer(params=request.GET)
            )
        )

    @requires_feature("organizations:integrations-custom-scm")
    @never_cache
    def put(self, request: Request, organization, integration_id) -> Response:
        integration = self.get_integration(organization.id, integration_id)

        if integration.provider != "custom_scm":
            return self.respond({"detail": "Invalid action for this integration"}, status=400)

        update_kwargs = {}

        serializer = IntegrationSerializer(data=request.data, partial=True)

        if serializer.is_valid():
            data = serializer.validated_data
            if data.get("name"):
                update_kwargs["name"] = data["name"]
            if data.get("domain") is not None:
                metadata = integration.metadata
                metadata["domain_name"] = data["domain"]
                update_kwargs["metadata"] = metadata
            integration_service.update_integration(integration_id=integration.id, **update_kwargs)

            org_integration = self.get_organization_integration(organization.id, integration_id)

            return self.respond(
                serialize(
                    org_integration,
                    request.user,
                    OrganizationIntegrationSerializer(params=request.GET),
                )
            )
        return self.respond(serializer.errors, status=400)

    @never_cache
    def delete(self, request: Request, organization, integration_id) -> Response:
        # Removing the integration removes the organization
        # integrations and all linked issues.

        # NOTE(hybrid-cloud): Deletions require the ORM object, not API versions
        org_integration: OrganizationIntegration | None = OrganizationIntegration.objects.filter(
            integration_id=integration_id, organization_id=organization.id
        ).first()
        if not org_integration:
            raise Http404
        integration = self.get_integration(organization.id, integration_id)
        # do any integration specific deleting steps
        integration_service.get_installation(
            integration=integration, organization_id=organization.id
        ).uninstall()

        with transaction.atomic():
            updated = OrganizationIntegration.objects.filter(
                id=org_integration.id, status=ObjectStatus.ACTIVE
            ).update(status=ObjectStatus.PENDING_DELETION)

            if updated:
                ScheduledDeletion.schedule(org_integration, days=0, actor=request.user)
                create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=integration.id,
                    event=audit_log.get_event_id("INTEGRATION_REMOVE"),
                    data={"provider": integration.provider, "name": integration.name},
                )

        return self.respond(status=204)

    @never_cache
    def post(self, request: Request, organization, integration_id) -> Response:
        integration = self.get_integration(organization.id, integration_id)
        installation = integration_service.get_installation(
            integration=integration, organization_id=organization.id
        )
        try:
            installation.update_organization_config(request.data)
        except IntegrationError as e:
            return self.respond({"detail": str(e)}, status=400)

        return self.respond(status=200)

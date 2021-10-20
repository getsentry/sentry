from django.db import transaction
from rest_framework import serializers

from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import OrganizationIntegrationSerializer
from sentry.features.helpers import requires_feature
from sentry.models import (
    AuditLogEntryEvent,
    Integration,
    ObjectStatus,
    OrganizationIntegration,
    ScheduledDeletion,
)
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.audit import create_audit_entry


class IntegrationSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    domain = serializers.URLField(required=False, allow_blank=True)


class OrganizationIntegrationDetailsEndpoint(OrganizationIntegrationBaseEndpoint):
    def get(self, request, organization, integration_id):
        org_integration = self.get_organization_integration(organization, integration_id)

        return self.respond(
            serialize(
                org_integration, request.user, OrganizationIntegrationSerializer(params=request.GET)
            )
        )

    @requires_feature("organizations:integrations-custom-scm")
    def put(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(organizations=organization, id=integration_id)
        except Integration.DoesNotExist:
            return self.respond(status=404)

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

            integration.update(**update_kwargs)
            integration.save()

            org_integration = self.get_organization_integration(organization, integration_id)

            return self.respond(
                serialize(
                    org_integration,
                    request.user,
                    OrganizationIntegrationSerializer(params=request.GET),
                )
            )
        return self.respond(serializer.errors, status=400)

    def delete(self, request, organization, integration_id):
        # Removing the integration removes the organization
        # integrations and all linked issues.
        org_integration = self.get_organization_integration(organization, integration_id)

        integration = org_integration.integration
        # do any integration specific deleting steps
        integration.get_installation(organization.id).uninstall()

        with transaction.atomic():
            updated = OrganizationIntegration.objects.filter(
                id=org_integration.id, status=ObjectStatus.VISIBLE
            ).update(status=ObjectStatus.PENDING_DELETION)

            if updated:
                ScheduledDeletion.schedule(org_integration, days=0, actor=request.user)
                create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=integration.id,
                    event=AuditLogEntryEvent.INTEGRATION_REMOVE,
                    data={"provider": integration.provider, "name": integration.name},
                )

        return self.respond(status=204)

    def post(self, request, organization, integration_id):
        integration = self.get_integration(organization, integration_id)
        installation = integration.get_installation(organization.id)
        try:
            installation.update_organization_config(request.data)
        except IntegrationError as e:
            return self.respond({"detail": str(e)}, status=400)

        return self.respond(status=200)

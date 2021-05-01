from uuid import uuid4

from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import OrganizationIntegrationSerializer
from sentry.models import AuditLogEntryEvent, Integration, ObjectStatus, OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.tasks.deletion import delete_organization_integration
from sentry.utils.audit import create_audit_entry


class OrganizationIntegrationDetailsEndpoint(OrganizationIntegrationBaseEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization, integration_id):
        org_integration = self.get_organization_integration(organization, integration_id)

        return self.respond(
            serialize(
                org_integration, request.user, OrganizationIntegrationSerializer(params=request.GET)
            )
        )

    def put(self, request, organization, integration_id):
        # TODO(meredith): Endpoint needs to be feature gated
        try:
            integration = Integration.objects.get(organizations=organization, id=integration_id)
        except Integration.DoesNotExist:
            self.respond(status=404)

        if integration.provider != "custom_scm":
            self.respond({"detail": "Invalid action for this integration"}, status=400)

        update_kwargs = {}
        # TODO(meredith): This data needs to be validated
        if request.data.get("name"):
            update_kwargs["name"] = request.data.get("name")
        if request.data.get("domain"):
            metadata = integration.metadata
            metadata["domain_name"] = request.data.get("domain")
            update_kwargs["metadata"] = metadata

        integration.update(**update_kwargs)
        integration.save()

        org_integration = self.get_organization_integration(organization, integration_id)

        return self.respond(
            serialize(
                org_integration, request.user, OrganizationIntegrationSerializer(params=request.GET)
            )
        )

    def delete(self, request, organization, integration_id):
        # Removing the integration removes the organization
        # integrations and all linked issues.
        org_integration = self.get_organization_integration(organization, integration_id)

        integration = org_integration.integration
        # do any integration specific deleting steps
        integration.get_installation(organization.id).uninstall()

        updated = OrganizationIntegration.objects.filter(
            id=org_integration.id, status=ObjectStatus.VISIBLE
        ).update(status=ObjectStatus.PENDING_DELETION)

        if updated:
            delete_organization_integration.apply_async(
                kwargs={
                    "object_id": org_integration.id,
                    "transaction_id": uuid4().hex,
                    "actor_id": request.user.id,
                },
                countdown=0,
            )
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

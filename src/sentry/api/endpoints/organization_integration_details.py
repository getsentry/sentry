from __future__ import absolute_import

from django.http import Http404

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationIntegrationsPermission
)
from sentry.api.serializers import serialize
from sentry.integrations.exceptions import IntegrationError
from sentry.models import Integration, OrganizationIntegration, ProjectIntegration


class OrganizationIntegrationDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission, )

    def get(self, request, organization, integration_id):
        try:
            integration = OrganizationIntegration.objects.get(
                integration_id=integration_id,
                organization=organization,
            )
        except OrganizationIntegration.DoesNotExist:
            raise Http404

        return self.respond(serialize(integration, request.user))

    def delete(self, request, organization, integration_id):
        # Removing the integration removes both the organization and project
        # integration.
        OrganizationIntegration.objects.filter(
            integration_id=integration_id,
            organization=organization,
        ).delete()
        ProjectIntegration.objects.filter(
            integration_id=integration_id,
            project__organization=organization,
        ).delete()

        return self.respond(status=204)

    def post(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                id=integration_id,
                organizations=organization,
            )
        except Integration.DoesNotExist:
            raise Http404

        installation = integration.get_installation(organization.id)
        try:
            installation.update_organization_config(request.DATA)
        except IntegrationError as e:
            return self.respond({'detail': e.message}, status=400)

        return self.respond(status=200)

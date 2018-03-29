from __future__ import absolute_import

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationIntegrationsPermission
)
from sentry.api.serializers import serialize
from sentry.models import Integration, OrganizationIntegration


class OrganizationIntegrationDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission, )

    def get(self, request, organization, integration_id):
        integration = Integration.objects.get(
            organizations=organization,
            id=integration_id,
        )

        return self.respond(serialize(integration, request.user))

    def delete(self, request, organization, integration_id):
        integration = Integration.objects.get(
            organizations=organization,
            id=integration_id,
        )
        OrganizationIntegration.objects.filter(
            integration=integration,
            organization=organization,
        ).delete()
        return self.respond(status=204)

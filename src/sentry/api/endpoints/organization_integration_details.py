from __future__ import absolute_import

from sentry import features
from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationIntegrationsPermission
)
from sentry.api.serializers import serialize
from sentry.models import Integration, OrganizationIntegration


class OrganizationIntegrationDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission, )

    def has_feature(self, request, organization):
        return features.has(
            'organizations:integrations-v3',
            organization=organization,
            actor=request.user,
        )

    def get(self, request, organization, integration_id):
        if not self.has_feature(request, organization):
            return self.respond({'detail': ['You do not have that feature enabled']}, status=400)

        integration = Integration.objects.get(
            organizations=organization,
            id=integration_id,
        )

        return self.respond(serialize(integration, request.user))

    def delete(self, request, organization, integration_id):
        if not self.has_feature(request, organization):
            return self.respond({'detail': ['You do not have that feature enabled']}, status=400)

        integration = Integration.objects.get(
            organizations=organization,
            id=integration_id,
        )
        OrganizationIntegration.objects.filter(
            integration=integration,
            organization=organization,
        ).delete()
        return self.respond(status=204)

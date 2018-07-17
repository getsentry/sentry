from __future__ import absolute_import

from django.http import Http404

from sentry.constants import ObjectStatus
from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationIntegrationsPermission
)
from sentry.integrations.repositories import RepositoryMixin
from sentry.models import Integration


class OrganizationIntegrationReposEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission, )

    def get(self, request, organization, integration_id):

        try:
            integration = Integration.objects.get(id=integration_id, organizations=organization)
        except Integration.DoesNotExist:
            raise Http404

        if integration.status == ObjectStatus.DISABLED:
            context = {'repos': []}
            return self.respond(context)

        install = integration.get_installation(organization.id)
        if isinstance(install, RepositoryMixin):
            repositories = install.get_repositories()
            context = {'repos': repositories}
            return self.respond(context)

        return self.respond({'detail': 'Repositories not supported'}, status=400)

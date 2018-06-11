from __future__ import absolute_import

from django.http import Http404

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationIntegrationsPermission
)

from sentry.models import Integration


class OrganizationIntegrationReposEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission, )

    def get(self, request, organization, integration_id):

        try:
            integration = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist:
            raise Http404

        install = integration.get_installation()
        context = {}
        try:
            repositories = install.get_client().get_repositories()
        except NotImplementedError:
            pass
        else:
            context = {'repos': repositories}

        return self.respond(context)

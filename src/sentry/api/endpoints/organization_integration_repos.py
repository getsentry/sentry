from __future__ import absolute_import

import six

from sentry.constants import ObjectStatus
from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.integrations.repositories import RepositoryMixin


class OrganizationIntegrationReposEndpoint(OrganizationIntegrationBaseEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization, integration_id):
        """
        Get the list of repositories available in an integration
        ````````````````````````````````````````````````````````

        Gets all repositories that an integration makes available,
        and indicates whether or not you can search repositories
        by name.

        :qparam string search: Name fragment to search repositories by.
        """
        integration = self.get_integration(organization, integration_id)

        if integration.status == ObjectStatus.DISABLED:
            context = {"repos": []}
            return self.respond(context)

        install = integration.get_installation(organization.id)

        if isinstance(install, RepositoryMixin):
            try:
                repositories = install.get_repositories(request.GET.get("search"))
            except IntegrationError as e:
                return self.respond({"detail": six.text_type(e)}, status=400)

            context = {"repos": repositories, "searchable": install.repo_search}
            return self.respond(context)

        return self.respond({"detail": "Repositories not supported"}, status=400)

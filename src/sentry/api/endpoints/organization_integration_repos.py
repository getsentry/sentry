from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.mixins import RepositoryMixin
from sentry.shared_integrations.exceptions import IntegrationError


class OrganizationIntegrationReposEndpoint(OrganizationIntegrationBaseEndpoint):
    def get(self, request: Request, organization, integration_id) -> Response:
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
            except (IntegrationError, IdentityNotValid) as e:
                return self.respond({"detail": str(e)}, status=400)

            context = {"repos": repositories, "searchable": install.repo_search}
            return self.respond(context)

        return self.respond({"detail": "Repositories not supported"}, status=400)

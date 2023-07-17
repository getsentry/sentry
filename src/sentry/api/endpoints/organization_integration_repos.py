from typing import Any, Optional, TypedDict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_integrations import RegionOrganizationIntegrationBaseEndpoint
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.mixins import RepositoryMixin
from sentry.models import Organization
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationError


class IntegrationRepository(TypedDict):
    name: str
    identifier: str
    defaultBranch: Optional[str]


@region_silo_endpoint
class OrganizationIntegrationReposEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    def get(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        """
        Get the list of repositories available in an integration
        ````````````````````````````````````````````````````````

        Gets all repositories that an integration makes available,
        and indicates whether or not you can search repositories
        by name.

        :qparam string search: Name fragment to search repositories by.
        """
        integration = self.get_integration(organization.id, integration_id)

        if integration.status == ObjectStatus.DISABLED:
            context = {"repos": []}
            return self.respond(context)

        installed_repos = Repository.objects.filter(integration_id=integration.id).exclude(
            status=ObjectStatus.HIDDEN
        )
        repo_names = {installed_repo.name for installed_repo in installed_repos}

        install = integration_service.get_installation(
            integration=integration, organization_id=organization.id
        )

        if isinstance(install, RepositoryMixin):
            try:
                repositories = install.get_repositories(request.GET.get("search"))
            except (IntegrationError, IdentityNotValid) as e:
                return self.respond({"detail": str(e)}, status=400)

            serializedRepositories = [
                IntegrationRepository(
                    name=repo["name"],
                    identifier=repo["identifier"],
                    defaultBranch=repo.get("default_branch"),
                )
                for repo in repositories
                if repo["identifier"] not in repo_names
            ]
            context = {"repos": serializedRepositories, "searchable": install.repo_search}
            return self.respond(context)

        return self.respond({"detail": "Repositories not supported"}, status=400)

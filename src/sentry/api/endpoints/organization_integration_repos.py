from typing import Any, Optional, TypedDict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_integrations import RegionOrganizationIntegrationBaseEndpoint
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.mixins import RepositoryMixin
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError


class IntegrationRepository(TypedDict):
    name: str
    identifier: str
    defaultBranch: Optional[str]


@region_silo_endpoint
class OrganizationIntegrationReposEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ISSUES

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
            return self.respond({"repos": []})

        installed_repos = Repository.objects.filter(integration_id=integration.id).exclude(
            status=ObjectStatus.HIDDEN
        )
        repo_names = {installed_repo.name for installed_repo in installed_repos}

        install = integration.get_installation(organization_id=organization.id)

        if isinstance(install, RepositoryMixin):
            try:
                repositories = install.get_repositories(request.GET.get("search"))
            except (IntegrationError, IdentityNotValid) as e:
                return self.respond({"detail": str(e)}, status=400)

            serialized_repositories = [
                IntegrationRepository(
                    name=repo["name"],
                    identifier=repo["identifier"],
                    defaultBranch=repo.get("default_branch"),
                )
                for repo in repositories
                if repo["identifier"] not in repo_names
            ]
            return self.respond(
                {"repos": serialized_repositories, "searchable": install.repo_search}
            )

        return self.respond({"detail": "Repositories not supported"}, status=400)

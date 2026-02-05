from typing import Any, TypedDict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.api.bases.organization_integrations import (
    RegionOrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError


class IntegrationRepository(TypedDict):
    name: str
    identifier: str
    isInstalled: bool
    defaultBranch: str | None


@region_silo_endpoint
class OrganizationIntegrationReposEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
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
        :qparam bool installableOnly: If true, return only repositories that can be installed.
                                      If false or not provided, return all repositories.
        """
        integration = self.get_integration(organization.id, integration_id)

        if integration.status == ObjectStatus.DISABLED:
            return self.respond({"repos": []})

        installed_repos = Repository.objects.filter(
            integration_id=integration.id, organization_id=organization.id
        ).exclude(status=ObjectStatus.HIDDEN)
        installed_repo_names = {installed_repo.name for installed_repo in installed_repos}

        install = integration.get_installation(organization_id=organization.id)

        if isinstance(install, RepositoryIntegration):
            try:
                repositories = install.get_repositories(request.GET.get("search"))
            except (IntegrationError, IdentityNotValid) as e:
                return self.respond({"detail": str(e)}, status=400)

            installable_only = request.GET.get("installableOnly", "false").lower() == "true"

            # Include a repository if the request is for all repositories, or if we want
            # installable-only repositories and the repository isn't already installed
            serialized_repositories = [
                IntegrationRepository(
                    name=repo["name"],
                    identifier=repo["identifier"],
                    defaultBranch=repo.get("default_branch"),
                    isInstalled=repo["identifier"] in installed_repo_names,
                )
                for repo in repositories
                if not installable_only or repo["identifier"] not in installed_repo_names
            ]
            return self.respond(
                {"repos": serialized_repositories, "searchable": install.repo_search}
            )

        return self.respond({"detail": "Repositories not supported"}, status=400)

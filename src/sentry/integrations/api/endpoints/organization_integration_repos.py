from typing import Any, NotRequired, TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.api.bases.organization_integrations import (
    CellOrganizationIntegrationBaseEndpoint,
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
    externalId: str
    url: str | None


class IntegrationRepositoriesResponse(TypedDict):
    repos: list[IntegrationRepository]
    searchable: NotRequired[bool]


@extend_schema(tags=["Integration"])
@cell_silo_endpoint
class OrganizationIntegrationReposEndpoint(CellOrganizationIntegrationBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="listOrganizationIntegrationRepositories",
        summary="List Repositories Available to an Integration",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.INTEGRATION_ID,
            OpenApiParameter("search", type=str, description="Repository name to search for."),
            OpenApiParameter(
                "installableOnly",
                type=bool,
                description="Only return repositories that are not already installed in Sentry.",
            ),
            OpenApiParameter(
                "accessibleOnly",
                type=bool,
                description="Only search repositories accessible to the integration installation.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "IntegrationRepositoriesResponse", IntegrationRepositoriesResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response[IntegrationRepositoriesResponse] | Response[DetailResponse]:
        """
        Get the list of repositories available in an integration
        ````````````````````````````````````````````````````````

        Gets all repositories that an integration makes available,
        and indicates whether or not you can search repositories
        by name.

        :qparam string search: Name fragment to search repositories by.
        :qparam bool installableOnly: If true, return only repositories that can be installed.
                                      If false or not provided, return all repositories.
        :qparam bool accessibleOnly: If true, only return repositories that the integration
                                     installation has access to, filtering locally instead of
                                     using the provider's search API which may return results
                                     beyond the installation's scope.
        """
        integration = self.get_integration(organization.id, integration_id)

        if integration.status == ObjectStatus.DISABLED:
            return self.respond({"repos": []})

        installed_repos = Repository.objects.filter(
            integration_id=integration.id, organization_id=organization.id
        ).exclude(status=ObjectStatus.HIDDEN)
        installed_external_ids = {repo.external_id for repo in installed_repos}

        install = integration.get_installation(organization_id=organization.id)

        if isinstance(install, RepositoryIntegration):
            search = request.GET.get("search")
            accessible_only = request.GET.get("accessibleOnly", "false").lower() == "true"

            try:
                # This endpoint backs interactive repo pickers (the onboarding
                # repo selector and the code-mappings path config form), so opt
                # into parallel pagination for the latency win. Providers that
                # don't implement it ignore the flag; internal/background callers
                # of get_repositories keep the serial default.
                repositories = install.get_repositories(
                    search,
                    accessible_only=accessible_only,
                    use_cache=accessible_only and bool(search),
                    parallel=True,
                )
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
                    isInstalled=repo["external_id"] in installed_external_ids,
                    externalId=repo["external_id"],
                    url=repo.get("url"),
                )
                for repo in repositories
                if not installable_only or repo["external_id"] not in installed_external_ids
            ]
            return self.respond(
                {"repos": serialized_repositories, "searchable": install.repo_search}
            )

        return self.respond({"detail": "Repositories not supported"}, status=400)

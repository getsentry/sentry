from __future__ import annotations

import logging
from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.repo_trees import RepoTreesIntegration
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.issues.auto_source_code_config.directory_prefixes import rank_directory_prefixes
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


class PrefixItem(TypedDict):
    path: str
    fileCount: int


class RepoPrefixesResponse(TypedDict):
    prefixes: list[PrefixItem]


def _get_repo_prefixes(
    organization: Organization, repository_id: int
) -> tuple[list[PrefixItem] | None, Response | None]:
    """Resolve a repo, fetch its cached file list, and return ranked prefixes.

    Returns (prefixes, None) on success or (None, error_response) on failure.
    """
    try:
        repo = Repository.objects.get(
            id=repository_id,
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
        )
    except Repository.DoesNotExist:
        return None, Response({"detail": "Repository not found."}, status=404)

    if not repo.integration_id:
        return None, Response({"detail": "Repository has no associated integration."}, status=404)

    integration = integration_service.get_integration(integration_id=repo.integration_id)
    if integration is None:
        return None, Response({"detail": "Integration not found."}, status=404)

    installation = integration.get_installation(organization_id=organization.id)
    if not isinstance(installation, RepoTreesIntegration):
        return None, Response(
            {"detail": "Integration does not support repository trees."}, status=404
        )

    cached = installation.get_repo_files_from_cache(repo.name)
    if cached is not None:
        # Warm cache hit — skip the provider branch lookup entirely.
        files = cached
    else:
        if isinstance(installation, RepositoryIntegration):
            try:
                branch = installation.get_repository_default_branch(repo)
            except ApiError as e:
                logger.warning(
                    "code_mapping_repo_prefixes.branch_lookup_error",
                    extra={"repo": repo.name, "error_code": e.code},
                )
                branch = None
            if not branch:
                return None, Response(
                    {"detail": "Could not determine default branch for this repository."},
                    status=400,
                )
        else:
            branch = "HEAD"

        try:
            files = installation.get_cached_repo_files(repo.name, branch, shifted_seconds=0)
        except ApiError as e:
            logger.warning(
                "code_mapping_repo_prefixes.api_error",
                extra={"repo": repo.name, "error_code": e.code},
            )
            return None, Response(
                {"detail": "Failed to retrieve repository file list."}, status=502
            )

    ranked = rank_directory_prefixes(files)
    prefixes: list[PrefixItem] = [{"path": p.path, "fileCount": p.file_count} for p in ranked]
    return prefixes, None


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class OrganizationCodeMappingRepoPrefixesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    @extend_schema(
        operation_id="listRepoCodeMappingPrefixes",
        summary="List repository directory prefixes for code mapping autocomplete",
        parameters=[
            OpenApiParameter(
                name="repositoryId",
                description="The numeric ID of the repository.",
                required=True,
                type=int,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={
            200: inline_sentry_response_serializer("RepoPrefixesResponse", RepoPrefixesResponse),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        raw_id = request.GET.get("repositoryId")
        if not raw_id:
            return self.respond({"detail": "repositoryId is required."}, status=400)

        try:
            repository_id = int(raw_id)
        except ValueError:
            return self.respond({"detail": "repositoryId must be a numeric ID."}, status=400)

        prefixes, error = _get_repo_prefixes(organization, repository_id)
        if error is not None:
            return error

        return self.respond({"prefixes": prefixes})

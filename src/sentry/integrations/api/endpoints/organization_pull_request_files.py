from __future__ import annotations

import logging
from typing import TypedDict

from rest_framework.exceptions import APIException, ParseError, PermissionDenied, Throttled
from rest_framework.request import Request
from rest_framework.response import Response
from scm import actions as scm_actions
from scm.errors import ProviderNotFound, RateLimitExceeded, ResourceNotFound, SCMError
from scm.helpers import iter_all_pages
from scm.types import FileStatus, GetPullRequestFilesProtocol, PullRequestFile

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import to_valid_int_id
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.utils.auth import is_user_from_viewer_context

logger = logging.getLogger(__name__)


class PullRequestFilesUnavailable(APIException):
    status_code = 502
    default_detail = "Failed to fetch pull request files."


class PullRequestFileResponse(TypedDict):
    path: str
    patch: str | None


class PullRequestFilesResponse(TypedDict):
    files: list[PullRequestFileResponse]


class RepositoryPullRequestFileResponse(PullRequestFileResponse):
    status: FileStatus
    previousPath: str | None


class RepositoryPullRequestFilesResponse(TypedDict):
    files: list[RepositoryPullRequestFileResponse]


def _require_user_session(request: Request) -> None:
    # Seer calls Sentry as a user by sending X-Viewer-Context. The auth middleware signs
    # that user in before SessionNoAuthTokenAuthentication runs, so the call looks like a
    # browser session. Refuse it here so Seer agents can't read source diffs, even if
    # Seer's generated SDK starts including these endpoints.
    if is_user_from_viewer_context(request):
        raise PermissionDenied("Pull request files can only be read from a user session.")


def _serialize_file(raw_file: PullRequestFile) -> PullRequestFileResponse:
    return {"path": raw_file["filename"], "patch": raw_file["patch"]}


def _fetch_files(
    organization_id: int, repository_id: int, pull_request_key: str
) -> list[PullRequestFile]:
    """Every file the pull request changes, as its provider reports them."""
    try:
        scm = make_scm(organization_id, repository_id, referrer="pull-request-files")
    except ProviderNotFound:
        # No integration installed, or a provider without SCM support (e.g. Bitbucket).
        return []
    except SCMError:
        raise ResourceDoesNotExist

    if not isinstance(scm, GetPullRequestFilesProtocol):
        return []

    try:
        files: list[PullRequestFile] = []
        for page in iter_all_pages(
            lambda pagination: scm_actions.get_pull_request_files(
                scm, pull_request_key, pagination=pagination
            )
        ):
            files.extend(page["data"])
    except ResourceNotFound:
        # The PR is gone on the provider.
        raise ResourceDoesNotExist
    except RateLimitExceeded:
        raise Throttled
    except SCMError:
        logger.warning(
            "organization_pull_request_files.fetch_failed",
            exc_info=True,
            extra={
                "organization_id": organization_id,
                "repository_id": repository_id,
                "pull_request_key": pull_request_key,
            },
        )
        raise PullRequestFilesUnavailable
    return files


@cell_silo_endpoint
class OrganizationPullRequestFilesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Browser sessions only: no API token of any kind may read source diffs.
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (OrganizationPermission,)

    def get(
        self, request: Request, organization: Organization, pull_request_id: str
    ) -> Response[PullRequestFilesResponse]:
        _require_user_session(request)
        try:
            pull_request = PullRequest.objects.get(
                id=to_valid_int_id("pull_request_id", pull_request_id, raise_404=True),
                organization_id=organization.id,
            )
        except PullRequest.DoesNotExist:
            raise ResourceDoesNotExist

        files = _fetch_files(organization.id, pull_request.repository_id, pull_request.key)
        return Response({"files": [_serialize_file(f) for f in files]})


@cell_silo_endpoint
class OrganizationRepositoryPullRequestFilesEndpoint(OrganizationEndpoint):
    """
    A pull request's files, found by its repository's name and its number.

    For callers that know the pull request only from the provider, like Seer runs that open
    and push to pull requests, which we may have no record of.
    """

    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Browser sessions only: no API token of any kind may read source diffs.
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (OrganizationPermission,)

    def get(
        self, request: Request, organization: Organization
    ) -> Response[RepositoryPullRequestFilesResponse]:
        _require_user_session(request)
        repo_name = request.GET.get("repo")
        number = request.GET.get("number", "")
        if not repo_name or not number.isdigit():
            raise ParseError(
                "Pass the repository's name as `repo` and the PR's number as `number`."
            )

        # Names aren't unique (e.g. the same repo on GitHub and GitHub Enterprise, or rows
        # left by a reinstall), so refuse to guess, like `Repository.objects.resolve_active`,
        # rather than show another repo's PR with the same number.
        matches = list(
            Repository.objects.filter(
                organization_id=organization.id,
                name=repo_name,
                status=ObjectStatus.ACTIVE,
                integration_id__isnull=False,
            ).order_by("id")[:2]
        )
        if len(matches) != 1:
            raise ResourceDoesNotExist
        repository = matches[0]

        files = _fetch_files(organization.id, repository.id, number)
        return Response(
            {
                "files": [
                    {
                        **_serialize_file(f),
                        "status": f["status"],
                        "previousPath": f["previous_filename"],
                    }
                    for f in files
                ]
            }
        )

from __future__ import annotations

import logging
from typing import NamedTuple, TypedDict

from rest_framework.exceptions import APIException, ParseError, Throttled
from rest_framework.request import Request
from rest_framework.response import Response
from scm import actions as scm_actions
from scm.errors import ProviderNotFound, RateLimitExceeded, ResourceNotFound, SCMError
from scm.helpers import iter_all_pages
from scm.types import (
    FileStatus,
    GetPullRequestFilesProtocol,
    GetPullRequestProtocol,
    PaginatedActionResult,
    PaginationParams,
    PullRequestFile,
)

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import to_valid_int_id
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# How many times to reread the files when a push lands while they're being read.
_HEAD_SHA_ATTEMPTS = 3


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
    # The PR's head commit while these files were read, or None if the provider doesn't say or
    # pushes kept landing mid-read. The provider can lag behind a push, so a caller that
    # pushed compares this to its own commit to tell whether the files include that push.
    headSha: str | None


class _PullRequestFiles(NamedTuple):
    files: list[PullRequestFile]
    head_sha: str | None


def _serialize_file(raw_file: PullRequestFile) -> PullRequestFileResponse:
    return {"path": raw_file["filename"], "patch": raw_file["patch"]}


def _read_files(
    scm: GetPullRequestFilesProtocol, pull_request_key: str
) -> tuple[list[PullRequestFile], int]:
    """The files, and how many provider calls reading them took."""
    files: list[PullRequestFile] = []
    calls = 0

    def read_page(pagination: PaginationParams) -> PaginatedActionResult[list[PullRequestFile]]:
        nonlocal calls
        calls += 1
        return scm_actions.get_pull_request_files(scm, pull_request_key, pagination=pagination)

    for page in iter_all_pages(read_page):
        files.extend(page["data"])
    return files, calls


def _record_head_sha_read(provider: str, outcome: str, attempts: int, provider_calls: int) -> None:
    tags = {"provider": provider, "outcome": outcome}
    metrics.distribution("organization_pull_request_files.head_sha.attempts", attempts, tags=tags)
    metrics.distribution(
        "organization_pull_request_files.head_sha.provider_calls", provider_calls, tags=tags
    )


def _read_files_at_one_head(
    scm: GetPullRequestFilesProtocol, pull_request_key: str, provider: str
) -> _PullRequestFiles:
    """
    The files, with the PR's head commit read before and after them. If a push moves the head
    while the pages are read, the pages may mix commits, so read them all again.
    """
    if not isinstance(scm, GetPullRequestProtocol):
        files, provider_calls = _read_files(scm, pull_request_key)
        _record_head_sha_read(provider, "no_pull_request_support", 1, provider_calls)
        return _PullRequestFiles(files, None)

    head_sha = scm_actions.get_pull_request(scm, pull_request_key)["data"]["head"]["sha"]
    provider_calls = 1
    for attempt in range(1, _HEAD_SHA_ATTEMPTS + 1):
        files, page_calls = _read_files(scm, pull_request_key)
        head_sha_after = scm_actions.get_pull_request(scm, pull_request_key)["data"]["head"]["sha"]
        provider_calls += page_calls + 1
        if head_sha_after == head_sha:
            _record_head_sha_read(provider, "matched", attempt, provider_calls)
            return _PullRequestFiles(files, head_sha)
        head_sha = head_sha_after
    _record_head_sha_read(provider, "gave_up", _HEAD_SHA_ATTEMPTS, provider_calls)
    return _PullRequestFiles(files, None)


def _fetch_files(
    organization_id: int,
    repository_id: int,
    pull_request_key: str,
    *,
    head_sha_provider: str | None = None,
) -> _PullRequestFiles:
    """
    Every file the pull request changes, as its provider reports them. With
    `head_sha_provider` (the repository's provider, used to tag metrics), also the head commit
    they were read at, which costs two or more extra provider calls.
    """
    try:
        scm = make_scm(organization_id, repository_id, referrer="pull-request-files")
    except ProviderNotFound:
        # No integration installed, or a provider without SCM support (e.g. Bitbucket).
        return _PullRequestFiles([], None)
    except SCMError:
        raise ResourceDoesNotExist

    if not isinstance(scm, GetPullRequestFilesProtocol):
        return _PullRequestFiles([], None)

    try:
        if head_sha_provider is not None:
            return _read_files_at_one_head(scm, pull_request_key, head_sha_provider)
        files, _ = _read_files(scm, pull_request_key)
        return _PullRequestFiles(files, None)
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


@cell_silo_endpoint
class OrganizationPullRequestFilesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Not the loose permission: org:ci tokens must not read source diffs.
    permission_classes = (OrganizationPermission,)

    def get(
        self, request: Request, organization: Organization, pull_request_id: str
    ) -> Response[PullRequestFilesResponse]:
        try:
            pull_request = PullRequest.objects.get(
                id=to_valid_int_id("pull_request_id", pull_request_id, raise_404=True),
                organization_id=organization.id,
            )
        except PullRequest.DoesNotExist:
            raise ResourceDoesNotExist

        fetched = _fetch_files(organization.id, pull_request.repository_id, pull_request.key)
        return Response({"files": [_serialize_file(f) for f in fetched.files]})


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
    # Not the loose permission: org:ci tokens must not read source diffs.
    permission_classes = (OrganizationPermission,)

    def get(
        self, request: Request, organization: Organization
    ) -> Response[RepositoryPullRequestFilesResponse]:
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

        fetched = _fetch_files(
            organization.id,
            repository.id,
            number,
            head_sha_provider=repository.provider or "unknown",
        )
        return Response(
            {
                "files": [
                    {
                        **_serialize_file(f),
                        "status": f["status"],
                        "previousPath": f["previous_filename"],
                    }
                    for f in fetched.files
                ],
                "headSha": fetched.head_sha,
            }
        )

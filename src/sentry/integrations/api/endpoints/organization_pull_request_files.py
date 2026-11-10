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


def _read_files(scm: GetPullRequestFilesProtocol, pull_request_key: str) -> list[PullRequestFile]:
    files: list[PullRequestFile] = []
    for page in iter_all_pages(
        lambda pagination: scm_actions.get_pull_request_files(
            scm, pull_request_key, pagination=pagination
        )
    ):
        files.extend(page["data"])
    return files


def _read_files_at_one_head(
    scm: GetPullRequestFilesProtocol, pull_request_key: str
) -> _PullRequestFiles:
    """
    The files, with the PR's head commit read before and after them. If a push moves the head
    while the pages are read, the pages may mix commits, so read them all again.
    """
    if not isinstance(scm, GetPullRequestProtocol):
        return _PullRequestFiles(_read_files(scm, pull_request_key), None)

    head_sha = scm_actions.get_pull_request(scm, pull_request_key)["data"]["head"]["sha"]
    for _ in range(_HEAD_SHA_ATTEMPTS):
        files = _read_files(scm, pull_request_key)
        head_sha_after = scm_actions.get_pull_request(scm, pull_request_key)["data"]["head"]["sha"]
        if head_sha_after == head_sha:
            return _PullRequestFiles(files, head_sha)
        head_sha = head_sha_after
    return _PullRequestFiles(files, None)


def _fetch_files(
    organization_id: int,
    repository_id: int,
    pull_request_key: str,
    *,
    with_head_sha: bool = False,
) -> _PullRequestFiles:
    """
    Every file the pull request changes, as its provider reports them. With `with_head_sha`,
    also the head commit they were read at, which costs two or more extra provider calls.
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
        if with_head_sha:
            return _read_files_at_one_head(scm, pull_request_key)
        return _PullRequestFiles(_read_files(scm, pull_request_key), None)
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

        fetched = _fetch_files(organization.id, repository.id, number, with_head_sha=True)
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

from __future__ import annotations

import logging
from base64 import b64decode
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, NotRequired, TypedDict

from requests import PreparedRequest

from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_API_BASE_URL,
    PAGE_SIZE,
    TOKEN_MINIMUM_VALIDITY_SECONDS,
)
from sentry.integrations.cursor_origin.languages import languages_from_tree
from sentry.integrations.cursor_origin.utils import get_jwt
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.source_code_management.repo_trees import RepoTreesClient
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.models.repository import Repository
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiError,
    ApiPaginationTruncated,
)
from sentry.silo.base import control_silo_function

logger = logging.getLogger("sentry.integrations.cursor_origin")

_APP_ROUTE_PREFIX = "/v1/origin/app"

_DEFAULT_RATE_LIMIT_REMAINING = 3000


def _is_app_route(path_url: str) -> bool:
    path = path_url.split("?", 1)[0]
    return path == _APP_ROUTE_PREFIX or path.startswith(f"{_APP_ROUTE_PREFIX}/")


def _parse_expires_at(value: str) -> datetime | None:
    """Origin sends RFC 3339. Returns an aware datetime, or None if unparseable."""
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


OriginFileStatus = Literal["added", "removed", "modified", "renamed", "copied"]
OriginComparisonStatus = Literal["identical", "ahead", "behind", "diverged"]
OriginOwnerType = Literal["team", "user"]
OriginVisibility = Literal["internal", "private"]
OriginMirrorSource = Literal["github"]
OriginMirrorStatus = Literal["inbound", "outbound"]
OriginRepoSelectionMode = Literal["all", "selected"]
OriginContentType = Literal["file", "dir"]
OriginTreeEntryType = Literal["blob", "tree", "commit"]


class OriginOwner(TypedDict):
    slug: str
    id: str
    # Output-only, and omitted when unknown.
    type: NotRequired[OriginOwnerType]


class OriginMirror(TypedDict):
    source: OriginMirrorSource
    sourceId: str
    status: OriginMirrorStatus


class OriginRepositorySummary(TypedDict):
    id: str
    name: str
    fullName: str
    owner: OriginOwner
    defaultBranch: str
    visibility: OriginVisibility
    allowMergeCommit: bool
    allowSquashMerge: bool
    deleteBranchOnMerge: bool
    # Absent for a native repository, and until a mirror's first sync is ready.
    mirror: NotRequired[OriginMirror]


class OriginRepository(OriginRepositorySummary):
    createdAt: str
    updatedAt: str
    pushedAt: str
    cloneUrl: str


class OriginCommitRef(TypedDict):
    sha: str


class OriginBranch(TypedDict):
    name: str
    commit: OriginCommitRef


class OriginBlob(TypedDict):
    sha: str
    size: int
    encoding: str
    content: str


class OriginTreeEntry(TypedDict):
    """One entry in a git tree."""

    path: str
    # Git mode as an octal string, such as "100644".
    mode: str
    type: OriginTreeEntryType
    sha: str
    # Unset for trees and gitlinks.
    size: NotRequired[int]


class OriginContentEntry(TypedDict):
    type: OriginContentType
    name: str
    path: str
    sha: str
    # A string, under Origin's convention for 64-bit integers.
    size: str


class OriginContents(TypedDict):
    """A file or a directory"""

    type: OriginContentType
    name: str
    path: str
    sha: str
    encoding: str
    size: str
    content: NotRequired[str]
    entries: NotRequired[list[OriginContentEntry]]


class OriginApp(TypedDict):
    id: str
    displayName: str
    description: str
    websiteUrl: str
    namespaceSlug: str
    webhookUrl: str
    events: list[str]
    installationRedirectUris: list[str]
    defaultScopes: list[str]
    createdAt: str
    updatedAt: str


class OriginUser(TypedDict):
    id: str
    email: str
    displayName: NotRequired[str]
    handle: NotRequired[str]


class OriginInstallation(TypedDict):
    id: str
    appId: str
    target: OriginOwner
    repoSelectionMode: OriginRepoSelectionMode
    scopes: list[str]
    createdAt: str
    updatedAt: str
    installedBy: NotRequired[OriginUser]
    suspendedAt: NotRequired[str]
    deletedAt: NotRequired[str]


class OriginGitUser(TypedDict):
    """A git identity recorded in a commit, not an Origin user."""

    name: str
    email: str
    date: str


class OriginCommitDetail(TypedDict):
    author: OriginGitUser
    committer: OriginGitUser
    message: str


class OriginCommit(TypedDict):
    """A commit returned by Origin."""

    sha: str
    commit: OriginCommitDetail
    parents: list[dict[str, str]]
    stats: NotRequired[dict[str, int]]


class OriginCommitFile(TypedDict):
    """A file changed by a commit or comparison."""

    filename: str
    status: OriginFileStatus
    additions: int
    deletions: int
    changes: int
    # Empty for a binary file.
    patch: str
    previousFilename: NotRequired[str]


class OriginComparison(TypedDict):
    """A comparison returned by Origin."""

    status: OriginComparisonStatus
    aheadBy: int
    behindBy: int
    baseCommit: OriginCommit
    headCommit: OriginCommit
    mergeBaseCommit: OriginCommit


class CursorOriginSetupApiClient(IntegrationProxyClient):
    """Authenticates as the app. Used during install, before an Integration exists."""

    base_url = CURSOR_ORIGIN_API_BASE_URL
    integration_name = "cursor_origin_setup"

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bearer {get_jwt()}"
        prepared_request.headers["Accept"] = "application/json"
        return prepared_request

    def get_app(self) -> OriginApp:
        return self.get("/app")

    def get_installation(self, installation_id: str) -> OriginInstallation:
        return self.get(f"/app/installations/{installation_id}")

    def delete_installation(self, installation_id: str) -> None:
        """Remove the installation on Origin. Responds with an empty body."""
        self.delete(f"/app/installations/{installation_id}")


class CursorOriginApiClient(IntegrationProxyClient, RepositoryClient, RepoTreesClient):
    """Authenticates as an installation, for an installed integration."""

    base_url = CURSOR_ORIGIN_API_BASE_URL
    integration_name = "cursor_origin"
    has_languages_endpoint = False
    _rate_limit_remaining: int = _DEFAULT_RATE_LIMIT_REMAINING
    # Origin caps pageSize at 100, so this bounds a listing at 10,000 items.
    page_number_limit = 100

    integration: Integration | RpcIntegration

    class AccessTokenData(TypedDict):
        access_token: str
        expires_at: str

    def __init__(
        self,
        integration: Integration | RpcIntegration,
        org_integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        self.integration = integration
        super().__init__(
            integration_id=integration.id,
            org_integration_id=org_integration_id,
            verify_ssl=verify_ssl,
            logging_context=logging_context,
        )

    @control_silo_function
    def _refresh_access_token(self) -> AccessTokenData | None:
        integration = Integration.objects.filter(id=self.integration.id).first()
        if not integration:
            return None

        data = self.post(f"/app/installations/{self.integration.external_id}/access_tokens")

        token = data["token"]
        expires_at = data["expiresAt"]
        if _parse_expires_at(expires_at) is None:
            raise ApiError(f"unparseable expiresAt from Cursor Origin: {expires_at!r}")

        integration.metadata.update({"access_token": token, "expires_at": expires_at})
        integration.save()
        self.integration = integration

        return {"access_token": token, "expires_at": expires_at}

    @control_silo_function
    def get_access_token(
        self, token_minimum_validity_time: timedelta | None = None
    ) -> AccessTokenData | None:
        """Reuse the stored installation token, refreshing it before it expires."""
        if token_minimum_validity_time is None:
            token_minimum_validity_time = timedelta(seconds=TOKEN_MINIMUM_VALIDITY_SECONDS)

        access_token = self.integration.metadata.get("access_token")
        raw_expires_at = self.integration.metadata.get("expires_at")
        if not isinstance(access_token, str) or not isinstance(raw_expires_at, str):
            return self._refresh_access_token()

        expires_at = _parse_expires_at(raw_expires_at)
        if expires_at is None or expires_at < datetime.now(UTC) + token_minimum_validity_time:
            return self._refresh_access_token()

        return {"access_token": access_token, "expires_at": raw_expires_at}

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        if _is_app_route(prepared_request.path_url):
            token: str | None = get_jwt()
        else:
            data = self.get_access_token()
            token = data["access_token"] if data else None

        if not token:
            logger.info(
                "cursor_origin.no_token",
                extra={
                    "path_url": prepared_request.path_url,
                    "integration_id": self.integration.id,
                },
            )
            return prepared_request

        prepared_request.headers["Authorization"] = f"Bearer {token}"
        prepared_request.headers["Accept"] = "application/json"
        return prepared_request

    def track_response_data(
        self,
        code: str | int,
        error: Exception | None = None,
        resp: Any = None,
        extra: Mapping[str, str | int] | None = None,
    ) -> None:
        if resp is not None:
            remaining = resp.headers.get("x-ratelimit-remaining")
            if remaining is not None:
                try:
                    self._rate_limit_remaining = int(remaining)
                except ValueError:
                    pass
        super().track_response_data(code, error, resp, extra)

    def _paginate[T](
        self,
        path: str,
        collection_key: str,
        params: dict[str, Any] | None = None,
        limit: int | None = None,
    ) -> list[T]:
        results: list[T] = []
        page_token: str | None = None
        page_size = min(PAGE_SIZE, limit) if limit else PAGE_SIZE

        for _ in range(self.page_number_limit):
            request_params: dict[str, Any] = {"pageSize": page_size, **(params or {})}
            if page_token:
                request_params["pageToken"] = page_token

            response = self.get(path, params=request_params)
            results.extend(response[collection_key])
            if limit is not None and len(results) >= limit:
                return results[:limit]

            # Present on every page; empty on the last one.
            page_token = response["nextPageToken"]
            if not page_token:
                return results

        raise ApiPaginationTruncated(results)

    def get_repositories(self) -> list[OriginRepositorySummary]:
        """Repositories this installation can see."""
        return self._paginate("/installation/repos", "repositories")

    def get_repo(self, repo_full_name: str) -> OriginRepository:
        return self.get(f"/repos/{repo_full_name}")

    def get_branches(self, repo_full_name: str) -> list[OriginBranch]:
        return self._paginate(f"/repos/{repo_full_name}/branches", "branches")

    def get_commits(
        self, repo_full_name: str, sha: str | None = None, limit: int | None = None
    ) -> list[OriginCommit]:
        """Return commits from `sha`, newest first, or from the default branch."""
        params = {"sha": sha} if sha else None
        return self._paginate(
            f"/repos/{repo_full_name}/commits", "commits", params=params, limit=limit
        )

    def get_commit(self, repo_full_name: str, sha: str) -> OriginCommit:
        """Return a commit with aggregate stats."""
        return self.get(f"/repos/{repo_full_name}/commits/{sha}")

    def get_commit_files(self, repo_full_name: str, sha: str) -> list[OriginCommitFile]:
        """Return the files changed by a commit."""
        return self._paginate(
            f"/repos/{repo_full_name}/commits/{sha}/files", "files", params={"sha": sha}
        )

    def compare_commits(self, repo_full_name: str, base: str, head: str) -> OriginComparison:
        """Return how `head` relates to `base`."""
        return self.get(f"/repos/{repo_full_name}/compare/{base}...{head}")

    def get_compare_files(
        self, repo_full_name: str, base: str, head: str
    ) -> list[OriginCommitFile]:
        """Return the files that differ between two revisions."""
        return self._paginate(f"/repos/{repo_full_name}/compare/{base}...{head}/files", "files")

    # -- git data ---------------------------------------------------------

    def get_tree_response(
        self, repo_full_name: str, tree_sha: str
    ) -> tuple[list[OriginTreeEntry], bool]:
        """Full recursive tree, and whether Origin truncated it.

        Truncation is at 100,000 entries or 7 MiB. An empty repository is a 409, which
        would otherwise surface as an opaque failure.
        """
        try:
            response = self.get(
                f"/repos/{repo_full_name}/git/trees/{tree_sha}", params={"recursive": "true"}
            )
        except ApiError as e:
            if e.code == 409:
                raise ApiConflictError(f"{repo_full_name} has an empty git tree")
            raise
        return response["tree"], response["truncated"]

    def get_tree(self, repo_full_name: str, tree_sha: str) -> list[OriginTreeEntry]:
        entries, truncated = self.get_tree_response(repo_full_name, tree_sha)
        if truncated:
            logger.warning(
                "cursor_origin.tree_truncated",
                extra={"repo": repo_full_name, "entry_count": len(entries)},
            )
        return entries

    def get_blob(self, repo_full_name: str, sha: str) -> OriginBlob:
        return self.get(f"/repos/{repo_full_name}/git/blobs/{sha}")

    def get_languages(
        self, repo_full_name: str, tree: list[dict[str, Any]] | None = None
    ) -> dict[str, int]:
        """Byte counts per language, shaped like GitHub's languages API.

        Origin has no languages endpoint. Callers that already hold the tree pass it;
        otherwise it is fetched.
        """
        entries: Sequence[Mapping[str, Any]] = (
            self.get_tree(repo_full_name, "HEAD") if tree is None else tree
        )
        return languages_from_tree(entries)

    def get_contents(
        self, repo_full_name: str, path: str, ref: str | None = None
    ) -> OriginContents:
        """A file or a directory.

        A file carries base64 ``content``; a directory carries ``entries``. Files over
        1 MiB decoded are rejected by Origin with a 400.
        """
        params: dict[str, Any] = {"path": path}
        if ref:
            params["ref"] = ref
        return self.get(f"/repos/{repo_full_name}/contents", params=params)

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        # Origin has no HEAD route for contents, so this is a GET whose body we discard.
        # Errors are left for RepositoryIntegration.check_file, which classifies them.
        return self.get_contents(repo.name, path, ref=version)

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        contents = self.get_contents(repo.name, path, ref=ref)
        # A directory answers with entries and no content
        content = contents.get("content")
        if content is None:
            raise ApiError(f"No file content at {path!r} in {repo.name}")
        return b64decode(content).decode("utf-8")

    def get_remaining_api_requests(self) -> int:
        return self._rate_limit_remaining

    def should_count_api_error(self, error: ApiError, extra: dict[str, str]) -> bool:
        """Whether this error counts toward the connection-error tally."""
        if error.code in (403, 404, 409):
            return False
        return True

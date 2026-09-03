from __future__ import annotations

import logging
import re
import time
from base64 import b64decode
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from django.core.cache import cache
from requests import PreparedRequest, Response

from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_API_BASE_URL,
    TOKEN_MINIMUM_VALIDITY_SECONDS,
)
from sentry.integrations.cursor_origin.languages import languages_from_tree
from sentry.integrations.cursor_origin.utils import get_jwt
from sentry.integrations.source_code_management.repo_trees import RepoTreesClient
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.models.repository import Repository
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.cursor_origin")

# Matches GitHub's `/repos/{owner}/{repo}/contents/{path}` so it can be rewritten to
# Origin's `/repos/{owner}/{repo}/contents?path=…`.
_GITHUB_CONTENTS_PATH = re.compile(
    r"^/repos/(?P<repo>[^/]+/[^/]+)/contents/(?P<path>.+)$",
)

# Origin names each collection after the resource rather than using a generic
# "items" key, so callers say which key they expect.
PAGE_SIZE = 100


class CursorOriginApiMixin(RepositoryClient, RepoTreesClient):
    """Read methods shared by the setup client and the installed-integration client.

    Everything here is written against the *verified* Origin API, which differs from
    the published docs in one important way: file contents live at
    ``/contents?path=…``, not ``/contents/{path}``. The documented path form returns a
    404 with a route-not-found body, which reads like an auth failure but is not.
    """

    # Seeded with the documented installation budget and replaced by the real
    # figure as soon as a response carrying rate-limit headers arrives. Starting
    # at 0 would read as "exhausted" and make callers back off before we have
    # made a single request.
    _rate_limit_remaining: int = 3000

    def track_response_data(
        self,
        code: str | int,
        error: Exception | None = None,
        resp: Response | None = None,
        extra: Mapping[str, str | int] | None = None,
    ) -> None:
        """Capture Origin's rate-limit headers on the way past.

        This is the only place the raw response is visible, and `repo_trees`
        backs off when the remaining budget gets low, so the figure has to be
        live rather than assumed.
        """
        if resp is not None:
            remaining = resp.headers.get("x-ratelimit-remaining")
            if remaining is not None:
                try:
                    self._rate_limit_remaining = int(remaining)
                except ValueError:
                    pass
        super().track_response_data(code, error, resp, extra)  # type: ignore[misc]

    # Concrete subclasses supply `post` via the shared API client base. Declared here
    # only so mypy can see it -- do NOT give it a body, or the MRO will shadow the
    # real implementation.
    if TYPE_CHECKING:

        def post(self, path: str, *args: Any, **kwargs: Any) -> Any: ...

    def get(self, path: str, *args: Any, **kwargs: Any) -> Any:
        """Read, translating GitHub-shaped contents paths to Origin's form.

        Origin serves file contents from ``/contents?path=…`` while GitHub uses
        ``/contents/{path}``. Rewriting here rather than at every call site lets
        Sentry's existing GitHub-oriented helpers -- platform detection, CODEOWNERS
        lookups, stacktrace linking -- run against Origin unmodified.

        The failure this prevents is a confusing one: the documented path form
        returns 404 with a route-not-found body, which reads like a permissions
        problem rather than a wrong URL.
        """
        match = _GITHUB_CONTENTS_PATH.match(path)
        if match:
            repo, file_path = match.group("repo"), match.group("path")
            params = dict(kwargs.pop("params", None) or {})
            params["path"] = file_path
            kwargs["params"] = params
            path = f"/repos/{repo}/contents"

        return super().get(path, *args, **kwargs)  # type: ignore[misc]

    # -- repositories --------------------------------------------------------

    def get_repositories(self) -> list[dict[str, Any]]:
        """Repositories this installation can see.

        Note: excludes repositories mirrored inbound from GitHub -- installations
        cannot access those.
        """
        return self._paginate("/installation/repos", "repositories")

    def get_repos(self) -> list[dict[str, Any]]:
        """``get_repositories`` in the GitHub shape shared tasks expect.

        Origin returns ``fullName`` where GitHub returns ``full_name``. Tasks
        written against GitHub read the latter -- link_all_repos, which
        post_install schedules, does ``repo["full_name"]`` -- so without this
        alias every install raises AttributeError for the missing method and
        then KeyError for the missing field.
        """
        return [{**repo, "full_name": repo["fullName"]} for repo in self.get_repositories()]

    def get_repo(self, repo_full_name: str) -> dict[str, Any]:
        return self.get(f"/repos/{repo_full_name}")

    # -- git data ------------------------------------------------------------

    def get_tree(self, repo_full_name: str, tree_sha: str) -> list[dict[str, Any]]:
        """Full recursive tree.

        Shape is identical to GitHub's ``git/trees``: entries carry
        ``path``/``mode``/``type``/``sha``, and blobs additionally carry ``size``.
        Origin exposes no ``truncated`` flag, so unlike GitHub we cannot tell whether
        a very large tree was capped.
        """
        response = self.get(
            f"/repos/{repo_full_name}/git/trees/{tree_sha}", params={"recursive": "1"}
        )
        if not isinstance(response, dict):
            return []
        return response.get("tree", []) or []

    def get_blob(self, repo_full_name: str, sha: str) -> dict[str, Any]:
        return self.get(f"/repos/{repo_full_name}/git/blobs/{sha}")

    def get_languages(self, repo_full_name: str, ref: str | None = None) -> dict[str, int]:
        """Byte counts per language, shaped like GitHub's languages API.

        Origin has no languages endpoint, so this is derived from the tree. Keeping
        the GitHub shape means the whole existing platform registry works unchanged.
        """
        return languages_from_tree(self.get_tree(repo_full_name, ref or "HEAD"))

    # -- contents ------------------------------------------------------------

    def get_contents(
        self, repo_full_name: str, path: str, ref: str | None = None
    ) -> dict[str, Any]:
        """Read a file or directory.

        A file returns ``{"type": "file", "encoding": "base64", "content": …}``;
        a directory returns ``{"type": "dir", "entries": [...]}``. Missing paths 404.
        """
        params: dict[str, Any] = {"path": path}
        if ref:
            params["ref"] = ref
        return self.get(f"/repos/{repo_full_name}/contents", params=params)

    # -- branches ------------------------------------------------------------

    def get_branches(self, repo_full_name: str) -> list[dict[str, Any]]:
        return self._paginate(f"/repos/{repo_full_name}/branches", "branches")

    # -- commits -------------------------------------------------------------

    def get_commits(
        self, repo_full_name: str, sha: str | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Commits reachable from ``sha``, newest first.

        The ref parameter is spelled ``sha``, as on GitHub. Note that Origin
        *silently ignores* unknown query parameters rather than rejecting them,
        so passing ``ref`` here would return a normal 200 with the unfiltered
        default-branch history -- a wrong answer that looks right.

        ``since``/``until``/``path`` are likewise accepted and ignored, so they
        are deliberately not offered.
        """
        params: dict[str, Any] = {"pageSize": min(limit, PAGE_SIZE)}
        if sha:
            params["sha"] = sha

        commits: list[dict[str, Any]] = []
        page_token: str | None = None
        while len(commits) < limit:
            if page_token:
                # A page token encodes the filters it was issued for, so `sha`
                # and `pageSize` are ignored once one is supplied.
                params = {"pageToken": page_token}
            response = self.get(f"/repos/{repo_full_name}/commits", params=params)
            if not isinstance(response, dict):
                break
            page = response.get("commits") or []
            commits.extend(page)
            page_token = response.get("nextPageToken") or None
            if not page or not page_token:
                break

        return commits[:limit]

    def get_commit_files(self, repo_full_name: str, sha: str) -> list[dict[str, Any]]:
        """Files changed by a single commit, GitHub-shaped.

        Entries carry ``filename``/``status``/``patch``. Zero-valued stats keys
        are omitted rather than sent as 0.
        """
        response = self.get(f"/repos/{repo_full_name}/commits/{sha}/files")
        if not isinstance(response, dict):
            return []
        return response.get("files") or []

    def compare_commits(
        self, repo_full_name: str, start_sha: str, end_sha: str, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Commits between two shas, oldest first, excluding ``start_sha``.

        Origin has a compare endpoint but it returns only counts and boundary
        commits -- no commit list, and no route anywhere gives the files changed
        between two arbitrary commits. So the range is rebuilt by walking back
        from ``end_sha`` until ``start_sha`` is reached.

        If ``start_sha`` is not found within ``limit`` commits the walk is
        returned as-is: a truncated range beats failing a release entirely.
        """
        walked: list[dict[str, Any]] = []
        for commit in self.get_commits(repo_full_name, sha=end_sha, limit=limit):
            if commit.get("sha") == start_sha:
                break
            walked.append(commit)
        return list(reversed(walked))

    # -- RepositoryClient ----------------------------------------------------

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        """Does this path exist? Used by stacktrace linking and CODEOWNERS.

        Origin has no HEAD route for contents, so this is a GET whose body we
        discard. Missing paths 404, which surfaces as ApiError.
        """
        try:
            return self.get_contents(repo.name, path, ref=version)
        except ApiError:
            return None

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        contents = self.get_contents(repo.name, path, ref=ref)
        # Origin answers a directory path with {"type": "dir", "entries": [...]},
        # which has no "content". Raise ApiError rather than KeyError: callers such
        # as source_context._fetch_file_from_scm and the CODEOWNERS lookup already
        # handle ApiError, and check_file returns the truthy directory dict, so a
        # directory sitting at a codeowners_locations path reaches here.
        content = contents.get("content") if isinstance(contents, dict) else None
        if not isinstance(content, str):
            raise ApiError(f"No file content at {path!r} in {repo.name}")
        return b64decode(content).decode("utf-8")

    # -- RepoTreesClient -----------------------------------------------------

    def get_remaining_api_requests(self) -> int:
        """Requests left in the current window, from the last response's headers.

        Origin uses the same ``X-RateLimit-*`` header names as GitHub. When we
        have not made a request yet, report the documented installation budget
        rather than 0, which callers treat as "back off".
        """
        return self._rate_limit_remaining

    def should_count_api_error(self, error: ApiError, extra: dict[str, str]) -> bool:
        """Whether this error counts toward the connection-error tally.

        An empty or inaccessible repository is an expected condition when
        walking an org's trees, not a sign the integration is broken.
        """
        # ApiError.json is whatever json.loads returned, which is not necessarily a
        # dict -- a bare string or list body would make .get() an AttributeError.
        message = error.json.get("message") if isinstance(error.json, dict) else error.text
        if message and (
            "not found" in message.lower()
            or "empty" in message.lower()
            or "permission" in message.lower()
        ):
            return False
        return True

    # -- pagination ----------------------------------------------------------

    def _paginate(self, path: str, collection_key: str) -> list[dict[str, Any]]:
        """Follow Origin's cursor pagination.

        Origin uses opaque ``pageToken``/``nextPageToken`` cursors rather than
        GitHub's ``Link`` header and ``page`` counter.
        """
        results: list[dict[str, Any]] = []
        page_token: str | None = None

        while True:
            params: dict[str, Any] = {"pageSize": PAGE_SIZE}
            if page_token:
                params["pageToken"] = page_token

            response = self.get(path, params=params)
            if not isinstance(response, dict):
                break

            results.extend(response.get(collection_key, []) or [])

            page_token = response.get("nextPageToken") or None
            if not page_token:
                break

        return results


class CursorOriginSetupApiClient(CursorOriginApiMixin, IntegrationProxyClient):
    """Client that authenticates as the app itself, with no stored integration.

    Used both during install, before an Integration row exists, and afterwards
    by the installation's ``get_client()``. Installation tokens are shared
    through the cache so repeated client construction does not re-mint them.
    """

    base_url = CURSOR_ORIGIN_API_BASE_URL
    integration_type = "integration"
    integration_name = "cursor_origin_setup"

    def __init__(
        self,
        installation_id: str | None = None,
        app_id: str | None = None,
        private_key: str | None = None,
        verify_ssl: bool = True,
    ):
        super().__init__(verify_ssl=verify_ssl)
        self.installation_id = installation_id
        self._app_id = app_id
        self._private_key = private_key
        self._access_token: str | None = None
        self._expires_at: float = 0.0
        # Set for the duration of a request that asked for app-level credentials.
        self._force_app_auth = False

    # -- auth ----------------------------------------------------------------

    def request(self, *args: Any, **kwargs: Any) -> Any:
        """Accept scm-platform's ``credentials_set`` argument.

        Providers in the scm library thread ``credentials_set`` through every
        call to choose between app-level and installation-level credentials.
        Sentry's BaseApiClient knows nothing about it, so it has to be consumed
        here or the call fails with an unexpected-keyword TypeError -- which is
        how this surfaced: every read through SourceCodeManager blew up before
        reaching the network.

        "application" means authenticate as the app itself rather than as the
        installation, which for Origin is the app JWT.
        """
        credentials_set = kwargs.pop("credentials_set", None)
        previous = self._force_app_auth
        self._force_app_auth = credentials_set == "application"
        try:
            return super().request(*args, **kwargs)
        finally:
            self._force_app_auth = previous

    def _jwt(self) -> str:
        return get_jwt(app_id=self._app_id, private_key=self._private_key)

    def _is_app_route(self, path_url: str) -> bool:
        """``/app`` and everything under it authenticates with the app JWT.

        That includes the token-exchange call itself. Repository routes
        (``/repos/…``, ``/installation/repos``) use the installation token.
        """
        return path_url.startswith("/v1/origin/app") or path_url.startswith("/app")

    def get_access_token(self) -> str:
        """Mint or reuse an installation token.

        Shared through the cache, not just this instance. A new client is built
        on every ``get_installation().get_client()``, so an instance-only cache
        meant a fresh token exchange per call site -- and token minting is
        charged against the app-JWT budget, which is the smaller of the two.

        The cache is deliberately given a shorter life than the token itself:
        Origin's tokens last under 15 minutes and the response carries no usable
        expiry, so a cached token is always refreshed well before it can expire
        mid-request. Eviction is harmless -- it just costs one exchange.
        """
        if self.installation_id is None:
            raise ValueError("installation_id is required for installation-scoped calls")

        if self._access_token and time.time() < self._expires_at:
            return self._access_token

        cache_key = self._token_cache_key(self.installation_id)
        cached = cache.get(cache_key)
        if cached:
            self._access_token = cached
            self._expires_at = time.time() + TOKEN_MINIMUM_VALIDITY_SECONDS
            return cached

        response = self.post(f"/app/installations/{self.installation_id}/access_tokens")
        if not isinstance(response, dict):
            raise ApiError("unexpected access_token response from Cursor Origin")

        token = next(
            (v for v in response.values() if isinstance(v, str) and v.startswith("oit_")),
            None,
        )
        if not token:
            raise ApiError("no installation token in Cursor Origin response")

        self._access_token = token
        self._expires_at = time.time() + TOKEN_MINIMUM_VALIDITY_SECONDS
        cache.set(cache_key, token, TOKEN_MINIMUM_VALIDITY_SECONDS)
        return token

    @staticmethod
    def _token_cache_key(installation_id: str) -> str:
        return f"cursor-origin:token:{installation_id}"

    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        if self._force_app_auth or self._is_app_route(prepared_request.path_url):
            token = self._jwt()
        else:
            token = self.get_access_token()

        prepared_request.headers["Authorization"] = f"Bearer {token}"
        prepared_request.headers["Accept"] = "application/json"
        return prepared_request

    # -- app-level endpoints -------------------------------------------------

    def get_app(self) -> dict[str, Any]:
        return self.get("/app")

    def get_installations(self) -> list[dict[str, Any]]:
        response = self.get("/app/installations")
        if not isinstance(response, dict):
            return []
        for value in response.values():
            if isinstance(value, list):
                return value
        return []

    def get_installation(self, installation_id: str) -> dict[str, Any]:
        return self.get(f"/app/installations/{installation_id}")

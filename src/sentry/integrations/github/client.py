from __future__ import annotations

import contextlib
import logging
import time
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from functools import cached_property
from typing import Any, TypedDict

import orjson
import sentry_sdk
from django.core.cache import cache
from requests import PreparedRequest, Response

from sentry.constants import ObjectStatus
from sentry.integrations.github.blame import (
    create_blame_query,
    extract_commits_from_blame_response,
    generate_file_path_mapping,
    is_graphql_response,
)
from sentry.integrations.github.constants import GITHUB_API_ACCEPT_HEADER
from sentry.integrations.github.utils import get_jwt, get_last_page_number, get_next_link
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.source_code_management.commit_context import (
    CommitContextClient,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repo_trees import RepoTreesClient
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.integrations.source_code_management.status_check import StatusCheckClient
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders, IntegrationProviderSlug
from sentry.models.pullrequest import PullRequest, PullRequestComment
from sentry.models.repository import Repository
from sentry.net.http import SafeSession
from sentry.scm.private.rate_limit import DynamicRateLimiter, RedisRateLimitProvider
from sentry.shared_integrations.client.base import SessionSettings
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiError,
    ApiForbiddenError,
    ApiPaginationTruncated,
    ApiRateLimitedError,
    UnknownHostError,
)
from sentry.silo.base import control_silo_function
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.dates import deprecated_utcnow
from sentry.utils.tracing import start_span

logger = logging.getLogger("sentry.integrations.github")

# Some functions that require a large number of API requests can use this value
# as the lower ceiling before hitting Github anymore, thus, leaving at least these
# many requests left for other features that need to reach Github
MINIMUM_REQUESTS = 200

# When Github advertises the total page count up front, the pages after the
# first are fetched concurrently. Bounded to keep the fan-out comfortably under
# Github's secondary (concurrent request) rate limits.
PAGINATION_MAX_WORKERS = 10

JWT_AUTH_ROUTES = ("/app/installations", "access_tokens")


def _is_rate_limit_forbidden(error: ApiForbiddenError) -> bool:
    """
    GitHub does not only use 429 for rate limits: it also returns 403 when an
    installation trips its primary or secondary rate limits, naming the limit
    in the response body (e.g. "You have exceeded a secondary rate limit" or
    "API rate limit exceeded"). ApiForbiddenError does not retain the
    Retry-After header GitHub sets on these responses, so detect the condition
    from the body message instead. A plain permission 403 has no such message.
    """
    message = ""
    if isinstance(error.json, dict):
        raw_message = error.json.get("message")
        if isinstance(raw_message, str):
            message = raw_message
    return "rate limit" in (message or error.text or "").lower()


class CachedRepo(TypedDict):
    id: int
    name: str
    full_name: str
    default_branch: str | None
    archived: bool | None


class GithubRateLimitInfo:
    def __init__(self, info: dict[str, int]) -> None:
        self.limit = info["limit"]
        self.remaining = info["remaining"]
        self.reset = info["reset"]
        self.used = info["used"]

    def next_window(self) -> str:
        return datetime.fromtimestamp(self.reset).strftime("%H:%M:%S")

    def __repr__(self) -> str:
        return f"GithubRateLimitInfo(limit={self.limit},rem={self.remaining},reset={self.reset})"


class GitHubReaction(StrEnum):
    """
    https://docs.github.com/en/rest/reactions/reactions#about-reactions
    """

    PLUS_ONE = "+1"
    MINUS_ONE = "-1"
    LAUGH = "laugh"
    CONFUSED = "confused"
    HEART = "heart"
    HOORAY = "hooray"
    ROCKET = "rocket"
    EYES = "eyes"


class GitHubApiRequestType(StrEnum):
    CHECK_FILE = "check_file"
    COMPARE_COMMITS = "compare_commits"
    CREATE_CHECK_RUN = "create_check_run"
    CREATE_COMMENT = "create_comment"
    CREATE_COMMENT_REACTION = "create_comment_reaction"
    CREATE_ISSUE = "create_issue"
    CREATE_ISSUE_REACTION = "create_issue_reaction"
    DELETE_ISSUE_REACTION = "delete_issue_reaction"
    GET_ARCHIVE_LINK = "get_archive_link"
    GET_ASSIGNEES = "get_assignees"
    GET_BLAME_FOR_FILES = "get_blame_for_files"
    GET_CHECK_RUN = "get_check_run"
    GET_CHECK_RUNS = "get_check_runs"
    GET_COMMENT_REACTIONS = "get_comment_reactions"
    GET_COMMIT = "get_commit"
    GET_COMMITS = "get_commits"
    GET_FILE = "get_file"
    GET_INSTALLATION_INFO = "get_installation_info"
    GET_ISSUE = "get_issue"
    GET_ISSUE_COMMENTS = "get_issue_comments"
    GET_ISSUE_REACTIONS = "get_issue_reactions"
    GET_LANGUAGES = "get_languages"
    GET_LABELS = "get_labels"
    GET_ORGANIZATION_MEMBERSHIPS_FOR_USER = "get_organization_memberships_for_user"
    GET_PULL_REQUEST = "get_pull_request"
    GET_PULL_REQUEST_COMMENTS = "get_pull_request_comments"
    GET_PULL_REQUEST_FILES = "get_pull_request_files"
    GET_PULL_REQUEST_FROM_COMMIT = "get_pull_request_from_commit"
    GET_RATE_LIMIT = "get_rate_limit"
    GET_REPO = "get_repo"
    GET_REPO_TREE = "get_repo_tree"
    GET_REPOSITORIES = "get_repositories"
    GET_USER = "get_user"
    GET_USER_INFO = "get_user_info"
    GET_USER_INFO_INSTALLATIONS = "get_user_info_installations"
    REFRESH_ACCESS_TOKEN = "refresh_access_token"
    REPO_HOOKS = "repo_hooks"
    SEARCH_ISSUES = "search_issues"
    SEARCH_REPOSITORIES = "search_repositories"
    UPDATE_COMMENT = "update_comment"
    UPDATE_ISSUE_ASSIGNEES = "update_issue_assignees"
    UPDATE_ISSUE_STATUS = "update_issue_status"


class GithubSetupApiClient(IntegrationProxyClient):
    """
    API Client that doesn't require an installation.
    This client is used during integration setup to fetch data
    needed to build installation metadata
    """

    base_url = "https://api.github.com"
    integration_name = "github_setup"

    def __init__(self, access_token: str | None = None, verify_ssl: bool = True):
        super().__init__(verify_ssl=verify_ssl)
        self.jwt = get_jwt()
        self.access_token = access_token

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        token = self.access_token

        if any(url in prepared_request.path_url for url in JWT_AUTH_ROUTES):
            token = self.jwt

        prepared_request.headers["Authorization"] = f"Bearer {token}"
        prepared_request.headers["Accept"] = GITHUB_API_ACCEPT_HEADER
        return prepared_request

    def get_installation_info(self, installation_id: int | str) -> dict[str, Any]:
        """
        Authentication: JWT
        Docs: https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#get-an-installation-for-the-authenticated-app
        """
        return self.get(
            f"/app/installations/{installation_id}",
            api_request_type=GitHubApiRequestType.GET_INSTALLATION_INFO,
        )

    def get_user_info(self) -> dict[str, Any]:
        """
        Authentication: Access Token
        Docs: https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
        """
        return self.get("/user", api_request_type=GitHubApiRequestType.GET_USER_INFO)

    def get_user_info_installations(self):
        """
        Authentication: Access Token
        Docs: https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28#list-app-installations-accessible-to-the-user-access-token
        """
        return self.get(
            "/user/installations",
            api_request_type=GitHubApiRequestType.GET_USER_INFO_INSTALLATIONS,
        )

    def get_organization_memberships_for_user(self):
        """
        Authentication: Access Token
        Docs: https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#get-an-organization-membership-for-the-authenticated-user
        """
        return self.get(
            "/user/memberships/orgs",
            api_request_type=GitHubApiRequestType.GET_ORGANIZATION_MEMBERSHIPS_FOR_USER,
        )


class GithubProxyClient(IntegrationProxyClient):
    integration: Integration | RpcIntegration  # late init

    def request(self, *args: Any, **kwargs: Any):
        credentials_set = kwargs.pop("credentials_set", None)
        if credentials_set == "application":
            if "headers" not in kwargs:
                kwargs["headers"] = {}
            kwargs["headers"]["X-Sentry-Credentials-Set"] = "application"

        return super().request(*args, **kwargs)

    class AccessTokenData(TypedDict):
        access_token: str
        permissions: dict[str, str] | None

    @cached_property
    def organization_id(self) -> int | None:
        return self._lookup_organization_id()

    def _lookup_organization_id(self) -> int | None:
        if self.org_integration_id is None:
            return None

        org_integrations = integration_service.get_organization_integrations(
            org_integration_ids=[self.org_integration_id], limit=1
        )
        if not org_integrations:
            return None
        return org_integrations[0].organization_id

    def _get_installation_id(self) -> str:
        """
        Returns the Github App installation identifier.
        This is necessary since Github and Github Enterprise integrations store the
        identifier in different places on their database records.
        """
        return self.integration.external_id

    def _get_jwt(self) -> str:
        """
        Returns the JSON Web Token for authorized GitHub requests.
        This is necessary since Github and Github Enterprise create do not create the JWTs in the
        same pattern.
        """
        return get_jwt()

    @control_silo_function
    def _refresh_access_token(self) -> AccessTokenData | None:
        integration = Integration.objects.filter(id=self.integration.id).first()
        if not integration:
            return None

        logger.info(
            "token.refresh_start",
            extra={
                "old_expires_at": self.integration.metadata.get("expires_at"),
                "integration_id": self.integration.id,
            },
        )
        data = self.post(
            f"/app/installations/{self._get_installation_id()}/access_tokens",
            api_request_type=GitHubApiRequestType.REFRESH_ACCESS_TOKEN,
        )
        access_token = data["token"]
        expires_at = datetime.strptime(data["expires_at"], "%Y-%m-%dT%H:%M:%SZ").isoformat()
        permissions = data.get("permissions")
        integration.metadata.update(
            {
                "access_token": access_token,
                "expires_at": expires_at,
                "permissions": permissions,
            }
        )

        if integration.debug_data is None:
            integration.debug_data = {}

        integration.debug_data.update(
            {
                "permissions": permissions,
                "expires_at": expires_at,
                "last_refresh_at": deprecated_utcnow().isoformat(),
            }
        )

        integration.save()
        logger.info(
            "token.refresh_end",
            extra={
                "new_expires_at": integration.metadata.get("expires_at"),
                "new_permissions": integration.metadata.get("permissions"),
                "integration_id": integration.id,
            },
        )

        self.integration = integration
        return {
            "access_token": access_token,
            "permissions": permissions,
        }

    @control_silo_function
    def _get_token(self, prepared_request: PreparedRequest) -> str | None:
        """
        Get token retrieves the active access token from the integration model.
        Should the token have expired, a new token will be generated and
        automatically persisted into the integration.
        """

        if not self.integration:
            return None

        logger_extra = {
            "path_url": prepared_request.path_url,
            "integration_id": getattr(self.integration, "id", "unknown"),
        }

        credentials_set = prepared_request.headers.pop("X-Sentry-Credentials-Set", None)
        # Only certain routes are authenticated with JWTs....
        if (
            any(url in prepared_request.path_url for url in JWT_AUTH_ROUTES)
            or credentials_set == "application"
        ):
            jwt = self._get_jwt()
            logger.info("token.jwt", extra=logger_extra)
            return jwt

        # The rest should use access tokens...
        metadata = self.get_access_token()
        if not metadata:
            return None
        return metadata["access_token"]

    @control_silo_function
    def get_access_token(
        self, token_minimum_validity_time: timedelta | None = None
    ) -> AccessTokenData | None:
        """
        Retrieves an access token for the given integration with an optional
        minimum validity time. This will guarantee that the token is valid for
        at least the timedelta provided.
        """
        token_minimum_validity_time = token_minimum_validity_time or timedelta(minutes=0)
        now = deprecated_utcnow()
        access_token: str | None = self.integration.metadata.get("access_token")
        expires_at: str | None = self.integration.metadata.get("expires_at")

        close_to_expiry = (
            expires_at
            and datetime.fromisoformat(expires_at).replace(tzinfo=None)
            < now + token_minimum_validity_time
        )
        should_refresh = not access_token or not expires_at or close_to_expiry

        if should_refresh:
            return self._refresh_access_token()

        if access_token:
            return {
                "access_token": access_token,
                "permissions": self.integration.metadata.get("permissions"),
            }

        return None

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        integration: RpcIntegration | Integration | None = None
        if hasattr(self, "integration"):
            integration = self.integration
        elif self.org_integration_id is not None:
            integration = Integration.objects.filter(
                organizationintegration__id=self.org_integration_id,
                provider=EXTERNAL_PROVIDERS[ExternalProviders.GITHUB],
                status=ObjectStatus.ACTIVE,
            ).first()

        if not integration:
            logger.info("no_integration", extra={"path_url": prepared_request.path_url})
            return prepared_request

        token = self._get_token(prepared_request=prepared_request)
        if not token:
            logger.info(
                "no_token",
                extra={"path_url": prepared_request.path_url, "integration_id": integration.id},
            )
            return prepared_request

        prepared_request.headers["Authorization"] = f"Bearer {token}"
        prepared_request.headers["Accept"] = GITHUB_API_ACCEPT_HEADER
        if prepared_request.headers.get("Content-Type") == "application/raw; charset=utf-8":
            prepared_request.headers["Accept"] = "application/vnd.github.raw"

        return prepared_request

    def is_error_fatal(self, error: Exception) -> bool:
        if (
            hasattr(error, "response")
            and hasattr(error.response, "text")
            and error.response.text
            and "suspended" in error.response.text
        ):
            return True
        return super().is_error_fatal(error)


class GitHubBaseClient(
    GithubProxyClient, RepositoryClient, CommitContextClient, RepoTreesClient, StatusCheckClient
):
    allow_redirects = True

    base_url = "https://api.github.com"
    integration_name = IntegrationProviderSlug.GITHUB.value
    # Github gives us links to navigate, however, let's be safe in case we're fed garbage
    page_number_limit = 200  # With a default of 100 per page -> 20,000 items

    def get_last_commits(self, repo: str, end_sha: str, per_page: int = 20) -> Sequence[Any]:
        """
        Return API request that fetches the last N commits.
        see https://docs.github.com/en/rest/commits/commits#list-commits-on-a-repository
        using end_sha as parameter.
        """
        return self.get_cached(
            f"/repos/{repo}/commits",
            params={"sha": end_sha, "per_page": per_page},
            api_request_type=GitHubApiRequestType.GET_COMMITS,
        )

    def compare_commits(self, repo: str, start_sha: str, end_sha: str) -> list[Any]:
        """
        See https://docs.github.com/en/rest/commits/commits#compare-two-commits
        where start sha is oldest and end is most recent.
        """
        return self._get_with_pagination(
            f"/repos/{repo}/compare/{start_sha}...{end_sha}",
            response_key="commits",
            api_request_type=GitHubApiRequestType.COMPARE_COMMITS,
        )

    def repo_hooks(self, repo: str) -> Sequence[Any]:
        """
        https://docs.github.com/en/rest/webhooks/repos#list-repository-webhooks
        """
        return self.get(f"/repos/{repo}/hooks", api_request_type=GitHubApiRequestType.REPO_HOOKS)

    def get_commits(self, repo: str) -> Sequence[Any]:
        """
        https://docs.github.com/en/rest/commits/commits#list-commits
        """
        return self.get(f"/repos/{repo}/commits", api_request_type=GitHubApiRequestType.GET_COMMITS)

    def get_commit(self, repo: str, sha: str) -> Any:
        """
        https://docs.github.com/en/rest/commits/commits#get-a-commit
        """
        return self.get_cached(
            f"/repos/{repo}/commits/{sha}", api_request_type=GitHubApiRequestType.GET_COMMIT
        )

    def get_installation_info(self, installation_id: int | str) -> Any:
        """
        https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#get-an-installation-for-the-authenticated-app
        """
        return self.get(
            f"/app/installations/{installation_id}",
            api_request_type=GitHubApiRequestType.GET_INSTALLATION_INFO,
        )

    def get_merge_commit_sha_from_commit(self, repo: Repository, sha: str) -> str | None:
        """
        Get the merge commit sha from a commit sha.
        """
        response = self.get_pull_request_from_commit(repo.name, sha)
        if not response or (isinstance(response, list) and len(response) != 1):
            # the response should return a single merged PR, return if multiple
            return None

        (pull_request,) = response
        if pull_request["state"] == "open":
            metrics.incr(
                "github_pr_comment.queue_comment_check.open_pr",
                sample_rate=1.0,
            )
            return None

        return pull_request.get("merge_commit_sha")

    def get_pull_request_from_commit(self, repo: str, sha: str) -> Any:
        """
        https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit

        Returns the merged pull request that introduced the commit to the repository. If the commit is not present in the default branch, will only return open pull requests associated with the commit.
        """
        return self.get(
            f"/repos/{repo}/commits/{sha}/pulls",
            api_request_type=GitHubApiRequestType.GET_PULL_REQUEST_FROM_COMMIT,
        )

    def get_pull_request_files(self, repo: str, pull_number: str) -> Any:
        """
        https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files

        Returns up to 30 files associated with a pull request. Responses are paginated.
        """
        return self.get(
            f"/repos/{repo}/pulls/{pull_number}/files",
            api_request_type=GitHubApiRequestType.GET_PULL_REQUEST_FILES,
        )

    def get_pull_request(self, repo: str, pull_number: str) -> Any:
        """
        https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request

        Returns a single pull request.
        """
        return self.get(
            f"/repos/{repo}/pulls/{pull_number}",
            api_request_type=GitHubApiRequestType.GET_PULL_REQUEST,
        )

    def get_archive_link(self, repo: str, archive_format: str, ref: str) -> str:
        """
        https://docs.github.com/en/rest/repos/contents#download-a-repository-archive-tar-ball-or-zip-ball

        Returns the redirect URL for downloading a repository archive.
        The API returns a 302; we capture the Location header instead of following it.
        """
        resp = self._request(
            "GET",
            f"/repos/{repo}/{archive_format}/{ref}",
            allow_redirects=False,
            raw_response=True,
            api_request_type=GitHubApiRequestType.GET_ARCHIVE_LINK,
        )
        if resp.status_code != 302 or "Location" not in resp.headers:
            raise ApiError.from_response(resp)
        return resp.headers["Location"]

    def get_repo(self, repo: str) -> Any:
        """
        https://docs.github.com/en/rest/repos/repos#get-a-repository
        """
        return self.get(f"/repos/{repo}", api_request_type=GitHubApiRequestType.GET_REPO)

    def get_languages(self, repo: str) -> dict[str, int]:
        """
        https://docs.github.com/en/rest/repos/repos#list-repository-languages

        :param repo: "owner/repo" format
        :returns: {"Python": 50000, "JavaScript": 30000, ...}
                  Keys are GitHub Linguist names, values are bytes of code.
        """
        return self.get(
            f"/repos/{repo}/languages",
            api_request_type=GitHubApiRequestType.GET_LANGUAGES,
        )

    # https://docs.github.com/en/rest/rate-limit?apiVersion=2022-11-28
    def get_rate_limit(self, specific_resource: str = "core") -> GithubRateLimitInfo:
        """This gives information of the current rate limit"""
        # There's more but this is good enough
        assert specific_resource in ("core", "search", "graphql")
        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_RATE_LIMIT,
            provider_key=self.integration_name,
            integration_id=self.integration.id,
            organization_id=self.organization_id,
        ).capture():
            return GithubRateLimitInfo(
                self.get("/rate_limit", api_request_type=GitHubApiRequestType.GET_RATE_LIMIT)[
                    "resources"
                ][specific_resource]
            )

    # This method is used by RepoTreesIntegration
    def get_remaining_api_requests(self) -> int:
        """This gives information of the current rate limit"""
        return self.get_rate_limit().remaining

    # This method is used by RepoTreesIntegration
    # https://docs.github.com/en/rest/git/trees#get-a-tree
    def get_tree(self, repo_full_name: str, tree_sha: str) -> list[dict[str, Any]]:
        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_REPO_TREE,
            provider_key=self.integration_name,
            integration_id=self.integration.id,
            organization_id=self.organization_id,
        ).capture() as lifecycle:
            try:
                # We do not cache this call since it is a rather large object
                contents: dict[str, Any] = self.get(
                    f"/repos/{repo_full_name}/git/trees/{tree_sha}",
                    # Will cause all objects or subtrees referenced by the tree specified in :tree_sha
                    params={"recursive": 1},
                    api_request_type=GitHubApiRequestType.GET_REPO_TREE,
                )
            except ApiConflictError as e:
                # Empty repos return a 409 which is expected
                lifecycle.record_halt(e)
                raise
            # If truncated is true in the response then the number of items in the tree array exceeded our maximum limit.
            # If you need to fetch more items, use the non-recursive method of fetching trees, and fetch one sub-tree at a time.
            # Note: The limit for the tree array is 100,000 entries with a maximum size of 7 MB when using the recursive parameter.
            # XXX: We will need to improve this by iterating through trees without using the recursive parameter
            if contents.get("truncated"):
                # e.g. getsentry/DataForThePeople
                logger.warning(
                    "The tree for %s has been truncated. Use different a approach for retrieving contents of tree.",
                    repo_full_name,
                )
            return contents["tree"]

    # Used by RepoTreesIntegration
    def should_count_api_error(self, error: ApiError, extra: dict[str, str]) -> bool:
        """
        Returns a boolean indicating whether the error should count towards the connection errors tally.
        """
        should_count_error = False
        error_message = error.json.get("message") if error.json else error.text

        if error_message in (
            "Git Repository is empty.",
            "Not Found.",  # The app does not have access to the repo
            "Repository access blocked",  # GitHub has blocked the repository
            "Bad credentials",  # No permission granted for this repo
        ):
            logger.warning(error_message, extra=extra)
        elif (
            error_message
            in (
                "Server Error",  # Github failed to respond
                "Connection reset by peer",  # Connection reset by GitHub
                "Connection broken: invalid chunk length",  # Connection broken by chunk with invalid length
                "Unable to reach host:",  # Unable to reach host at the moment
            )
        ):
            should_count_error = True
        elif error_message and error_message.startswith(
            "Due to U.S. trade controls law restrictions, this GitHub"
        ):
            # Raising the error will stop execution and let the task handle it
            raise error
        else:
            # We do not raise the exception so we can keep iterating through the repos.
            # Nevertheless, investigate the error to determine if we should abort the processing
            logger.warning("Continuing execution. Investigate: %s", error_message, extra=extra)

        return should_count_error

    def get_repos(
        self,
        page_number_limit: int | None = None,
        raise_on_page_limit: bool = False,
        parallel: bool = False,
    ) -> list[dict[str, Any]]:
        """
        This fetches all repositories accessible to the Github App
        https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-app-installation

        It uses page_size from the base class to specify how many items per page.
        The upper bound of requests is controlled with self.page_number_limit to prevent infinite requests.

        When ``raise_on_page_limit`` is True, raises ``ApiPaginationTruncated`` if the
        pagination loop exits because it hit the cap while there were still
        more pages available.

        When ``parallel`` is True, pages after the first are fetched concurrently
        (see ``_get_with_pagination``). Only interactive callers opt in; the
        background ``link_all_repos`` task keeps the serial default.
        """
        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_REPOSITORIES,
            provider_key=self.integration_name,
            integration_id=self.integration.id,
            organization_id=self.organization_id,
        ).capture() as lifecycle:
            try:
                return self._get_with_pagination(
                    "/installation/repositories",
                    response_key="repositories",
                    page_number_limit=page_number_limit,
                    api_request_type=GitHubApiRequestType.GET_REPOSITORIES,
                    raise_on_page_limit=raise_on_page_limit,
                    parallel=parallel,
                )
            except ApiPaginationTruncated as e:
                # Hitting the pagination cap is an expected signal.
                # Record as halt so the lifecycle doesn't create a
                # Sentry every time this is called.
                lifecycle.record_halt(e, create_issue=False)
                raise

    def get_repos_cached(self, ttl: int = 300, parallel: bool = False) -> list[CachedRepo]:
        """
        Return all repos accessible to this installation, cached in
        Django cache for ``ttl`` seconds.

        Only the fields used by get_repositories() are stored to keep
        the cache payload small.

        ``parallel`` is forwarded to ``get_repos`` for the cache-miss fetch.
        """
        cache_key = f"github:repos:{self.integration.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        all_repos = self.get_repos(parallel=parallel)
        repos: list[CachedRepo] = [
            {
                "id": r["id"],
                "name": r["name"],
                "full_name": r["full_name"],
                "default_branch": r.get("default_branch"),
                "archived": r.get("archived"),
            }
            for r in all_repos
        ]
        cache.set(cache_key, repos, ttl)
        return repos

    def search_repositories(self, query: bytes) -> Mapping[str, Sequence[Any]]:
        """
        Find repositories matching a query.
        https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#search-repositories

        NOTE: All search APIs (except code search) share a rate limit of 30 requests/minute
        """
        return self.get(
            "/search/repositories",
            params={"q": query},
            api_request_type=GitHubApiRequestType.SEARCH_REPOSITORIES,
        )

    def get_assignees(self, repo: str) -> Sequence[Any]:
        """
        https://docs.github.com/en/rest/issues/assignees#list-assignees
        """
        return self._get_with_pagination(
            f"/repos/{repo}/assignees",
            api_request_type=GitHubApiRequestType.GET_ASSIGNEES,
        )

    def _get_with_pagination(
        self,
        path: str,
        response_key: str | None = None,
        page_number_limit: int | None = None,
        api_request_type: GitHubApiRequestType | None = None,
        raise_on_page_limit: bool = False,
        parallel: bool = False,
    ) -> list[Any]:
        """
        Github uses the Link header to provide pagination links.
        https://docs.github.com/en/rest/guides/traversing-with-pagination

        Use response_key when the API stores the results within a key.
        For instance, the repositories API returns the list of repos under the "repositories" key.

        By default the remaining pages are fetched serially by following the
        ``next`` links one round-trip at a time, which is what Github recommends.

        When ``parallel`` is True and Github advertises the total page count via
        a ``rel="last"`` link on the first response, the remaining pages are
        fetched concurrently instead. Callers opt into this only where the
        latency matters and the bounded extra concurrency against Github's
        secondary rate limits is acceptable. Even when ``parallel`` is True,
        endpoints that do not advertise a last page (a single page, or
        cursor-based pagination where arbitrary page jumps are unsupported) fall
        back to the serial ``next`` walk.

        When ``raise_on_page_limit`` is True and pagination stops because it hit
        ``page_number_limit`` while Github was still advertising more pages,
        raises ``ApiPaginationTruncated`` with the partial result attached.
        """
        if page_number_limit is None or page_number_limit > self.page_number_limit:
            page_number_limit = self.page_number_limit

        def page_items(resp: Any) -> Any:
            return resp[response_key] if response_key else resp

        with start_span(
            op=f"{self.integration_type}.http.pagination",
            name=f"{self.integration_type}.http_response.pagination.{self.name}",
        ):
            # Fetch the first page serially. Besides returning its data, this
            # warms up any lazily-initialized client state (auth token, session)
            # before any fan-out, and tells us how many pages there are.
            first_response = self.get(
                path, params={"per_page": self.page_size}, api_request_type=api_request_type
            )
            output: list[Any] = list(page_items(first_response))

            if parallel:
                last_page_number = get_last_page_number(first_response)
                if last_page_number is not None and last_page_number > 1:
                    truncated = last_page_number > page_number_limit
                    remaining_pages = range(2, min(last_page_number, page_number_limit) + 1)

                    # Pages are addressed by number (per_page + page) rather than
                    # by following Github's next-link URLs. Any query params
                    # already in ``path`` survive because fetch_page reuses it, so
                    # this matches next-link following for offset-paginated
                    # endpoints (the only kind we take this path for, since it is
                    # gated on a numeric rel="last"). The one gap: if this function
                    # ever grows a ``params`` argument for filter/sort/q, fetch_page
                    # must forward it too -- it hardcodes only per_page and page, so
                    # params supplied any way other than via ``path`` would be
                    # dropped from pages 2..N.
                    def fetch_page(page_number: int) -> Any:
                        return self.get(
                            path,
                            params={"per_page": self.page_size, "page": page_number},
                            api_request_type=api_request_type,
                        )

                    if remaining_pages:
                        # Stats for the parallel fan-out so we can watch whether
                        # the extra concurrency is what tips installs over
                        # GitHub's secondary rate limits (the ``rate_limited``
                        # outcome), and how wide the fan-outs actually get. These
                        # fire only on multi-page picker opens, and rate_limited
                        # is rarer still, so pin sample_rate=1.0 (prod lowers the
                        # global default) to keep the rare event visible.
                        metrics.distribution(
                            "integrations.github.parallel_pagination.pages",
                            len(remaining_pages) + 1,
                            sample_rate=1.0,
                        )
                        try:
                            with ContextPropagatingThreadPoolExecutor(
                                thread_name_prefix=__name__,
                                max_workers=min(PAGINATION_MAX_WORKERS, len(remaining_pages)),
                            ) as executor:
                                # ``map`` yields results in input order, so the pages
                                # are concatenated in order regardless of which request
                                # finished first. If a page fails, ``map`` cancels the
                                # pages it has not started yet, so a failed fan-out costs
                                # at most roughly one in-flight batch of extra requests
                                # (bounded by max_workers), not the whole page range.
                                for resp in executor.map(fetch_page, remaining_pages):
                                    output.extend(page_items(resp))
                        except (ApiRateLimitedError, ApiForbiddenError) as e:
                            # GitHub signals a tripped rate limit with either a
                            # 429 or a 403 whose body names the limit (primary or
                            # secondary), so attribute both to the rate_limited
                            # outcome to keep the fan-out's rate-limit exposure
                            # visible. A plain permission 403 re-raises untagged.
                            if isinstance(e, ApiRateLimitedError) or _is_rate_limit_forbidden(e):
                                metrics.incr(
                                    "integrations.github.parallel_pagination",
                                    tags={"outcome": "rate_limited"},
                                    sample_rate=1.0,
                                )
                            raise
                        metrics.incr(
                            "integrations.github.parallel_pagination",
                            tags={"outcome": "success"},
                            sample_rate=1.0,
                        )

                    if truncated and raise_on_page_limit:
                        raise ApiPaginationTruncated(
                            output,
                            f"pagination stopped at page_number_limit={page_number_limit}",
                        )
                    return output

            # Serial walk: the default, and the fallback when ``parallel`` is
            # requested but Github does not advertise a last page.
            page_number = 1
            next_link = get_next_link(first_response)
            while next_link and page_number < page_number_limit:
                resp = self.get(next_link, api_request_type=api_request_type)
                output.extend(page_items(resp))
                next_link = get_next_link(resp)
                page_number += 1

            if next_link and raise_on_page_limit:
                raise ApiPaginationTruncated(
                    output,
                    f"pagination stopped at page_number_limit={page_number_limit}",
                )
            return output

    def search_issues(self, query: str) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        """
        https://docs.github.com/en/rest/search?apiVersion=2022-11-28#search-issues-and-pull-requests

        NOTE: All search APIs (except code search) share a rate limit of 30 requests/minute
        """
        return self.get(
            "/search/issues",
            params={"q": query},
            api_request_type=GitHubApiRequestType.SEARCH_ISSUES,
        )

    def get_issue(self, repo: str, number: str) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#get-an-issue
        """
        return self.get(
            f"/repos/{repo}/issues/{number}",
            api_request_type=GitHubApiRequestType.GET_ISSUE,
        )

    def get_issue_comments(self, repo: str, issue_number: str) -> Any:
        """
        https://docs.github.com/en/rest/issues/comments#list-issue-comments
        """
        return self.get(
            f"/repos/{repo}/issues/{issue_number}/comments",
            api_request_type=GitHubApiRequestType.GET_ISSUE_COMMENTS,
        )

    def get_pull_request_comments(self, repo: str, pull_number: str) -> Any:
        """
        https://docs.github.com/en/rest/pulls/comments#list-review-comments-on-a-pull-request
        """
        return self.get(
            f"/repos/{repo}/pulls/{pull_number}/comments",
            api_request_type=GitHubApiRequestType.GET_PULL_REQUEST_COMMENTS,
        )

    def create_issue(self, repo: str, data: Mapping[str, Any]) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#create-an-issue
        """
        endpoint = f"/repos/{repo}/issues"
        return self.post(endpoint, data=data, api_request_type=GitHubApiRequestType.CREATE_ISSUE)

    def update_issue_assignees(self, repo: str, issue_number: str, assignees: list[str]) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#update-an-issue
        """
        endpoint = f"/repos/{repo}/issues/{issue_number}"
        return self.patch(
            endpoint,
            data={"assignees": assignees},
            api_request_type=GitHubApiRequestType.UPDATE_ISSUE_ASSIGNEES,
        )

    def update_issue_status(self, repo: str, issue_number: str, status: str) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#update-an-issue
        """
        endpoint = f"/repos/{repo}/issues/{issue_number}"
        return self.patch(
            endpoint,
            data={"state": status},
            api_request_type=GitHubApiRequestType.UPDATE_ISSUE_STATUS,
        )

    def get_issue_reactions(self, repo: str, issue_number: str) -> list[Any]:
        """
        https://docs.github.com/en/rest/reactions/reactions#list-reactions-for-an-issue
        """
        return self._get_with_pagination(
            f"/repos/{repo}/issues/{issue_number}/reactions",
            api_request_type=GitHubApiRequestType.GET_ISSUE_REACTIONS,
        )

    def create_issue_reaction(self, repo: str, issue_number: str, reaction: GitHubReaction) -> Any:
        """
        https://docs.github.com/en/rest/reactions/reactions#create-reaction-for-an-issue
        """
        endpoint = f"/repos/{repo}/issues/{issue_number}/reactions"
        return self.post(
            endpoint,
            data={"content": reaction.value},
            api_request_type=GitHubApiRequestType.CREATE_ISSUE_REACTION,
        )

    def delete_issue_reaction(self, repo: str, issue_number: str, reaction_id: str) -> Any:
        """
        https://docs.github.com/en/rest/reactions/reactions#delete-an-issue-reaction
        """
        return self.delete(
            f"/repos/{repo}/issues/{issue_number}/reactions/{reaction_id}",
            api_request_type=GitHubApiRequestType.DELETE_ISSUE_REACTION,
        )

    def create_comment(self, repo: str, issue_id: str, data: dict[str, Any]) -> Any:
        """
        https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
        """
        endpoint = f"/repos/{repo}/issues/{issue_id}/comments"
        return self.post(endpoint, data=data, api_request_type=GitHubApiRequestType.CREATE_COMMENT)

    def update_comment(
        self, repo: str, issue_id: str, comment_id: str, data: dict[str, Any]
    ) -> Any:
        endpoint = f"/repos/{repo}/issues/comments/{comment_id}"
        return self.patch(endpoint, data=data, api_request_type=GitHubApiRequestType.UPDATE_COMMENT)

    def create_pr_comment(self, repo: Repository, pr: PullRequest, data: dict[str, Any]) -> Any:
        return self.create_comment(repo.name, pr.key, data)

    def update_pr_comment(
        self,
        repo: Repository,
        pr: PullRequest,
        pr_comment: PullRequestComment,
        data: dict[str, Any],
    ) -> Any:
        return self.update_comment(repo.name, pr.key, pr_comment.external_id, data)

    def get_comment_reactions(self, repo: str, comment_id: str) -> list[Any]:
        """
        https://docs.github.com/en/rest/reactions/reactions#list-reactions-for-an-issue-comment
        """
        return self._get_with_pagination(
            f"/repos/{repo}/issues/comments/{comment_id}/reactions",
            api_request_type=GitHubApiRequestType.GET_COMMENT_REACTIONS,
        )

    def create_comment_reaction(self, repo: str, comment_id: str, reaction: GitHubReaction) -> Any:
        """
        https://docs.github.com/en/rest/reactions/reactions#create-reaction-for-an-issue-comment

        Args:
            repo: Repository name in "owner/repo" format
            comment_id: The ID of the comment
            reaction: The reaction type
        """
        endpoint = f"/repos/{repo}/issues/comments/{comment_id}/reactions"
        return self.post(
            endpoint,
            data={"content": reaction.value},
            api_request_type=GitHubApiRequestType.CREATE_COMMENT_REACTION,
        )

    def get_user(self, gh_username: str) -> Any:
        """
        https://docs.github.com/en/rest/users/users#get-a-user
        """
        return self.get(f"/users/{gh_username}", api_request_type=GitHubApiRequestType.GET_USER)

    def get_labels(self, owner: str, repo: str) -> list[Any]:
        """
        Fetches all labels for a repository.
        https://docs.github.com/en/rest/issues/labels#list-labels-for-a-repository
        """
        return self._get_with_pagination(
            f"/repos/{owner}/{repo}/labels",
            api_request_type=GitHubApiRequestType.GET_LABELS,
        )

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        return self.head_cached(
            path=f"/repos/{repo.name}/contents/{path}",
            params={"ref": version},
            api_request_type=GitHubApiRequestType.CHECK_FILE,
        )

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        """Get the contents of a file

        See https://docs.github.com/en/rest/reference/repos#get-repository-content
        """
        from base64 import b64decode

        headers = {"Content-Type": "application/raw; charset=utf-8"} if codeowners else {}
        contents = self.get(
            path=f"/repos/{repo.name}/contents/{path}",
            params={"ref": ref},
            raw_response=True if codeowners else False,
            headers=headers,
            api_request_type=GitHubApiRequestType.GET_FILE,
        )

        if codeowners:
            if not contents.ok:
                raise ApiError.from_response(contents)
            return contents.content.decode("utf-8")

        return b64decode(contents["content"]).decode("utf-8")

    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
    ) -> list[FileBlameInfo]:
        log_info = {
            **extra,
            "provider": IntegrationProviderSlug.GITHUB,
            "organization_integration_id": self.org_integration_id,
        }
        metrics.incr("integrations.github.get_blame_for_files")
        try:
            rate_limit = self.get_rate_limit(specific_resource="graphql")
        except ApiError:
            # Some GitHub instances don't enforce rate limiting and will respond with a 404
            pass
        else:
            if rate_limit.remaining < MINIMUM_REQUESTS:
                metrics.incr(
                    "integrations.github.get_blame_for_files.not_enough_requests_remaining"
                )
                logger.warning(
                    "sentry.integrations.github.get_blame_for_files.rate_limit",
                    extra={
                        "provider": IntegrationProviderSlug.GITHUB,
                        "specific_resource": "graphql",
                        "remaining": rate_limit.remaining,
                        "next_window": rate_limit.next_window(),
                        "organization_integration_id": self.org_integration_id,
                    },
                )
                raise ApiRateLimitedError("Not enough requests remaining for GitHub")

        file_path_mapping = generate_file_path_mapping(files)
        query, variables = create_blame_query(file_path_mapping, extra=log_info)
        data = {"query": query, "variables": variables}
        cache_key = self.get_cache_key("/graphql", "", orjson.dumps(data).decode())
        response = self.check_cache(cache_key)
        if response:
            metrics.incr("integrations.github.get_blame_for_files.got_cached")
            logger.info(
                "sentry.integrations.github.get_blame_for_files.got_cached",
                extra=log_info,
            )
        else:
            try:
                response = self.post(
                    path="/graphql",
                    data=data,
                    allow_text=False,
                    api_request_type=GitHubApiRequestType.GET_BLAME_FOR_FILES,
                )
            except ValueError as e:
                logger.warning(str(e), log_info)
                return []
            else:
                self.set_cache(cache_key, response, 60)

        if not is_graphql_response(response):
            raise ApiError("Response is not JSON")

        errors = response.get("errors", [])
        if len(errors) > 0:
            if any([error for error in errors if error.get("type") == "RATE_LIMITED"]):
                raise ApiRateLimitedError("GitHub rate limit exceeded")

            # When data is present, it means that the query was at least partially successful,
            # usually a missing repo/branch/file which is expected with wrong configurations.
            # If data is not present, the query may be formed incorrectly, so raise an error.
            if not response.get("data"):
                err_message = ""
                for error in response.get("errors", []):
                    err = error.get("message", "")
                    err_message += err + "\n"

                    if err and "something went wrong" in err.lower():
                        raise UnknownHostError(err)

                raise ApiError(err_message)

        detail = str(response.get("detail", ""))
        if detail and "internal error" in detail.lower():
            errorId = response.get("errorId", "")
            logger.info(
                "github.get_blame_for_files.host_error", extra={**log_info, "errorId": errorId}
            )
            raise UnknownHostError("Something went wrong when communicating with GitHub")

        return extract_commits_from_blame_response(
            response=response,
            file_path_mapping=file_path_mapping,
            files=files,
            extra={
                **extra,
                "provider": IntegrationProviderSlug.GITHUB,
                "organization_integration_id": self.org_integration_id,
            },
        )

    def create_check_run(self, repo: str, data: dict[str, Any]) -> Any:
        """
        https://docs.github.com/en/rest/checks/runs#create-a-check-run

        The repo must be in the format of "owner/repo".
        """
        endpoint = f"/repos/{repo}/check-runs"
        return self.post(
            endpoint, data=data, api_request_type=GitHubApiRequestType.CREATE_CHECK_RUN
        )

    def get_check_run(self, repo: str, check_run_id: int) -> Any:
        """
        https://docs.github.com/en/rest/checks/runs#get-a-check-run

        The repo must be in the format of "owner/repo".
        """
        endpoint = f"/repos/{repo}/check-runs/{check_run_id}"
        return self.get(endpoint, api_request_type=GitHubApiRequestType.GET_CHECK_RUN)

    def get_check_runs(self, repo: str, sha: str) -> Any:
        """
        https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference

        The repo must be in the format of "owner/repo". SHA can be any reference.
        """
        endpoint = f"/repos/{repo}/commits/{sha}/check-runs"
        return self.get(endpoint, api_request_type=GitHubApiRequestType.GET_CHECK_RUNS)


class _IntegrationIdParams(TypedDict, total=False):
    integration_id: int


# TODO: Emerge Team - Update to be -> {"emerge": 0.05}.
REFERRER_ALLOCATION: dict[str, float] = {}
assert "shared" not in REFERRER_ALLOCATION

GITHUB_RATE_LIMIT_WINDOW = 3600
GITHUB_RATE_LIMIT_CAPACITY = "x-ratelimit-limit"
GITHUB_RATE_LIMIT_USED = "x-ratelimit-used"
GITHUB_RATE_LIMIT_RESET = "x-ratelimit-reset"

# Requests to this resource do not count against GitHub's primary rate limit, so our
# internal rate limiter ignores them. https://docs.github.com/en/rest/rate-limit
GITHUB_RATE_LIMIT_RESOURCE_PATH = "/rate_limit"


class GitHubApiClient(GitHubBaseClient):
    """
    GitHub REST API client.

    Certain referrers need reserved quota to ensure their requests are always completed. This
    class enables that with the `referrer` context manager. This does not enforce GitHub's
    secondary rate-limits which are not publicly known.

    To use the reserved quota system you must:

    1. Register your referrer in the referrer allocation dictionary.
    2. Use the `with client.referrer(name):` expression to scope your requests to your referrer.
        - Lower priority requests can be made outside the with block which falls back to the
          shared quota pool.
    """

    def __init__(
        self,
        integration: Integration | RpcIntegration,
        org_integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        self.integration = integration
        kwargs: _IntegrationIdParams = {}
        if hasattr(self.integration, "id"):
            kwargs["integration_id"] = integration.id

        super().__init__(
            org_integration_id=org_integration_id,
            verify_ssl=verify_ssl,
            logging_context=logging_context,
            **kwargs,
        )

        self.__referrer = "shared"
        self.__rate_limiter = DynamicRateLimiter(
            get_time_in_seconds=lambda: int(time.time()),
            integration_id=self.integration.id,
            provider="github",
            rate_limit_provider=RedisRateLimitProvider(),
            rate_limit_window_seconds=GITHUB_RATE_LIMIT_WINDOW,
            referrer_allocation=REFERRER_ALLOCATION,
        )

    @contextlib.contextmanager
    def referrer(self, referrer: str):
        prev = self.__referrer
        self.__referrer = referrer
        try:
            yield
        finally:
            self.__referrer = prev

    def _do_send(
        self, session: SafeSession, request: PreparedRequest, session_settings: SessionSettings
    ) -> Response:
        # The rate-limit resource is not itself rate limited by GitHub, so we skip the internal
        # rate limiter entirely. Counting these requests would both consume quota we don't owe and
        # pollute the recorded capacity with the rate-limit resource's own (unrelated) headers.
        if request.path_url.partition("?")[0] == GITHUB_RATE_LIMIT_RESOURCE_PATH:
            return super()._do_send(session, request, session_settings)

        is_rate_limited = False
        try:
            if self.__rate_limiter.is_rate_limited(self.__referrer):
                # For now do nothing. We'll eventually use this once we understand its behavior better.
                # raise RateLimitExceed
                is_rate_limited = True
                metrics.incr("sentry.scm.github.rate_limit_exceeded")
        except Exception as e:
            # Something went really wrong. Let's not be instrusive. We'll fail silently instead.
            sentry_sdk.capture_exception(e)

        response = super()._do_send(session, request, session_settings)

        try:
            capacity = int(response.headers[GITHUB_RATE_LIMIT_CAPACITY])
            self.__rate_limiter.set_total_capacity(capacity=capacity)
        except KeyError:
            # GitHub didn't return rate-limit headers for some unknown reason.
            metrics.incr("sentry.scm.github.could_not_extract_rate_limit_headers")
        except Exception as e:
            # Something went really wrong. Let's not be instrusive. We'll fail silently instead.
            sentry_sdk.capture_exception(e)

        # QA metrics.
        if is_rate_limited and response.status_code != 429:
            # We thought we exceeded our rate-limit but actually we didn't.
            metrics.incr("sentry.scm.github.rate_limit.false_positive")
        elif response.status_code == 429 and not is_rate_limited:
            # We thought we had capacity but actually we didn't.
            metrics.incr("sentry.scm.github.rate_limit.false_negative")

        return response

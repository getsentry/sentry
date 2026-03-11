from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any, TypedDict

import orjson
import sentry_sdk
from requests import PreparedRequest

from sentry.constants import ObjectStatus
from sentry.integrations.github.blame import (
    create_blame_query,
    extract_commits_from_blame_response,
    generate_file_path_mapping,
    is_graphql_response,
)
from sentry.integrations.github.constants import GITHUB_API_ACCEPT_HEADER
from sentry.integrations.github.utils import get_jwt, get_next_link
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
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
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiError,
    ApiRateLimitedError,
    UnknownHostError,
)
from sentry.silo.base import control_silo_function
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.github")

# Some functions that require a large number of API requests can use this value
# as the lower ceiling before hitting Github anymore, thus, leaving at least these
# many requests left for other features that need to reach Github
MINIMUM_REQUESTS = 200

GET_PULL_REQUEST_COMMENTS_QUERY = """
query GetPullRequestComments(
    $owner: String!,
    $repo: String!,
    $prNumber: Int!,
    $commentsAfter: String,
    $includeComments: Boolean!,
    $reviewThreadsAfter: String,
    $includeThreads: Boolean!
) {
    repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
            comments(first: 100, after: $commentsAfter) @include(if: $includeComments) {
                nodes {
                    id
                    body
                    isMinimized
                    author { login databaseId __typename }
                }
                pageInfo { hasNextPage endCursor }
            }
            reviewThreads(first: 100, after: $reviewThreadsAfter) @include(if: $includeThreads) {
                nodes {
                    id
                    isCollapsed
                    isOutdated
                    isResolved
                    comments(last: 100) {
                        nodes {
                            id
                            fullDatabaseId
                            url
                            body
                            isMinimized
                            path
                            startLine
                            line
                            diffHunk
                            createdAt
                            updatedAt
                            reactions(last: 10) {
                                nodes { content }
                                totalCount
                            }
                            author { login databaseId __typename }
                        }
                    }
                }
                pageInfo { hasNextPage endCursor }
            }
        }
    }
}
"""

MINIMIZE_COMMENT_MUTATION = """
mutation MinimizeComment($commentId: ID!, $reason: ReportedContentClassifiers!) {
    minimizeComment(input: {subjectId: $commentId, classifier: $reason}) {
        minimizedComment { isMinimized }
    }
}
"""

RESOLVE_REVIEW_THREAD_MUTATION = """
mutation ResolveReviewThread($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
        thread { isResolved }
    }
}
"""

DELETE_PULL_REQUEST_REVIEW_COMMENT_MUTATION = """
mutation DeletePullRequestReviewComment($commentNodeId: ID!) {
    deletePullRequestReviewComment(input: {id: $commentNodeId}) {
        clientMutationId
    }
}
"""

JWT_AUTH_ROUTES = ("/app/installations", "access_tokens")


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
        return self.get(f"/app/installations/{installation_id}")

    def get_user_info(self) -> dict[str, Any]:
        """
        Authentication: Access Token
        Docs: https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
        """
        return self.get("/user")

    def get_user_info_installations(self):
        """
        Authentication: Access Token
        Docs: https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28#list-app-installations-accessible-to-the-user-access-token
        """
        return self.get("/user/installations")

    def get_organization_memberships_for_user(self):
        """
        Authentication: Access Token
        Docs: https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#get-an-organization-membership-for-the-authenticated-user
        """
        return self.get("/user/memberships/orgs")


class GithubProxyClient(IntegrationProxyClient):
    integration: Integration | RpcIntegration  # late init

    class AccessTokenData(TypedDict):
        access_token: str
        permissions: dict[str, str] | None

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
        data = self.post(f"/app/installations/{self._get_installation_id()}/access_tokens")
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
                "last_refresh_at": datetime.utcnow().isoformat(),
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

        # Only certain routes are authenticated with JWTs....
        if any(url in prepared_request.path_url for url in JWT_AUTH_ROUTES):
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
        now = datetime.utcnow()
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
    page_number_limit = 50  # With a default of 100 per page -> 5,000 items

    def get_last_commits(self, repo: str, end_sha: str) -> Sequence[Any]:
        """
        Return API request that fetches last ~30 commits
        see https://docs.github.com/en/rest/commits/commits#list-commits-on-a-repository
        using end_sha as parameter.
        """
        return self.get_cached(f"/repos/{repo}/commits", params={"sha": end_sha})

    def compare_commits(self, repo: str, start_sha: str, end_sha: str) -> list[Any]:
        """
        See https://docs.github.com/en/rest/commits/commits#compare-two-commits
        where start sha is oldest and end is most recent.
        """
        return self._get_with_pagination(
            f"/repos/{repo}/compare/{start_sha}...{end_sha}",
            response_key="commits",
        )

    def repo_hooks(self, repo: str) -> Sequence[Any]:
        """
        https://docs.github.com/en/rest/webhooks/repos#list-repository-webhooks
        """
        return self.get(f"/repos/{repo}/hooks")

    def get_commits(
        self, repo: str, sha: str | None = None, path: str | None = None
    ) -> Sequence[Any]:
        """
        https://docs.github.com/en/rest/commits/commits#list-commits
        """
        params: dict[str, str] = {}
        if sha:
            params["sha"] = sha
        if path:
            params["path"] = path
        return self.get(f"/repos/{repo}/commits", params=params)

    def get_commit(self, repo: str, sha: str) -> Any:
        """
        https://docs.github.com/en/rest/commits/commits#get-a-commit
        """
        return self.get_cached(f"/repos/{repo}/commits/{sha}")

    def get_installation_info(self, installation_id: int | str) -> Any:
        """
        https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#get-an-installation-for-the-authenticated-app
        """
        return self.get(f"/app/installations/{installation_id}")

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
        return self.get(f"/repos/{repo}/commits/{sha}/pulls")

    def get_pull_request_files(self, repo: str, pull_number: str) -> Any:
        """
        https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files

        Returns up to 30 files associated with a pull request. Responses are paginated.
        """
        return self.get(f"/repos/{repo}/pulls/{pull_number}/files")

    def get_pull_request(self, repo: str, pull_number: str) -> Any:
        """
        https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request

        Returns a single pull request.
        """
        return self.get(f"/repos/{repo}/pulls/{pull_number}")

    def get_repo(self, repo: str) -> Any:
        """
        https://docs.github.com/en/rest/repos/repos#get-a-repository
        """
        return self.get(f"/repos/{repo}")

    # https://docs.github.com/en/rest/rate-limit?apiVersion=2022-11-28
    def get_rate_limit(self, specific_resource: str = "core") -> GithubRateLimitInfo:
        """This gives information of the current rate limit"""
        # There's more but this is good enough
        assert specific_resource in ("core", "search", "graphql")
        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_RATE_LIMIT,
            provider_key=self.integration_name,
            integration_id=self.integration.id,
        ).capture():
            return GithubRateLimitInfo(self.get("/rate_limit")["resources"][specific_resource])

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
        ).capture() as lifecycle:
            try:
                # We do not cache this call since it is a rather large object
                contents: dict[str, Any] = self.get(
                    f"/repos/{repo_full_name}/git/trees/{tree_sha}",
                    # Will cause all objects or subtrees referenced by the tree specified in :tree_sha
                    params={"recursive": 1},
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

    def get_tree_full(
        self, repo_full_name: str, tree_sha: str, recursive: bool = True
    ) -> dict[str, Any]:
        """https://docs.github.com/en/rest/git/trees#get-a-tree

        Returns the full API response including the ``truncated`` flag.
        """
        params: dict[str, int] = {}
        if recursive:
            params["recursive"] = 1
        contents: dict[str, Any] = self.get(
            f"/repos/{repo_full_name}/git/trees/{tree_sha}",
            params=params,
        )
        return contents

    def get_branch(self, repo: str, branch: str) -> Any:
        """https://docs.github.com/en/rest/branches/branches#get-a-branch"""
        return self.get(f"/repos/{repo}/branches/{branch}")

    def get_git_ref(self, repo: str, ref: str) -> Any:
        """https://docs.github.com/en/rest/git/refs#get-a-reference"""
        return self.get(f"/repos/{repo}/git/refs/heads/{ref}")

    def create_git_ref(self, repo: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/git/refs#create-a-reference"""
        return self.post(f"/repos/{repo}/git/refs", data=data)

    def update_git_ref(self, repo: str, ref: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/git/refs#update-a-reference"""
        return self.patch(f"/repos/{repo}/git/refs/heads/{ref}", data=data)

    def create_git_blob(self, repo: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/git/blobs#create-a-blob"""
        return self.post(f"/repos/{repo}/git/blobs", data=data)

    def get_file_content(self, repo: str, path: str, ref: str | None = None) -> Any:
        """https://docs.github.com/en/rest/repos/contents#get-repository-content"""
        params = {}
        if ref:
            params["ref"] = ref
        return self.get(f"/repos/{repo}/contents/{path}", params=params)

    def get_git_commit(self, repo: str, sha: str) -> Any:
        """https://docs.github.com/en/rest/git/commits#get-a-commit-object"""
        return self.get(f"/repos/{repo}/git/commits/{sha}")

    def create_git_tree(self, repo: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/git/trees#create-a-tree"""
        return self.post(f"/repos/{repo}/git/trees", data=data)

    def create_git_commit(self, repo: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/git/commits#create-a-commit"""
        return self.post(f"/repos/{repo}/git/commits", data=data)

    def list_pull_requests(self, repo: str, state: str = "open", head: str | None = None) -> Any:
        """https://docs.github.com/en/rest/pulls/pulls#list-pull-requests"""
        params: dict[str, Any] = {"state": state}
        if head:
            params["head"] = head
        return self.get(f"/repos/{repo}/pulls", params=params)

    def get_pull_request_commits(self, repo: str, pull_number: str) -> Any:
        """https://docs.github.com/en/rest/pulls/pulls#list-commits-on-a-pull-request"""
        return self.get(f"/repos/{repo}/pulls/{pull_number}/commits")

    def get_pull_request_diff(self, repo: str, pull_number: str) -> Any:
        """https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request (diff format)"""
        return self.get(
            f"/repos/{repo}/pulls/{pull_number}",
            headers={"Accept": "application/vnd.github.v3.diff"},
            allow_text=True,
        )

    def create_pull_request(self, repo: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request"""
        return self.post(f"/repos/{repo}/pulls", data=data)

    def update_pull_request(self, repo: str, pull_number: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request"""
        return self.patch(f"/repos/{repo}/pulls/{pull_number}", data=data)

    def create_review_request(self, repo: str, pull_number: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/pulls/review-requests#request-reviewers-for-a-pull-request"""
        return self.post(f"/repos/{repo}/pulls/{pull_number}/requested_reviewers", data=data)

    def create_review_comment(self, repo: str, pull_number: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/pulls/comments#create-a-review-comment-for-a-pull-request"""
        return self.post(f"/repos/{repo}/pulls/{pull_number}/comments", data=data)

    def create_review(self, repo: str, pull_number: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request"""
        return self.post(f"/repos/{repo}/pulls/{pull_number}/reviews", data=data)

    def update_check_run(self, repo: str, check_run_id: str, data: dict[str, Any]) -> Any:
        """https://docs.github.com/en/rest/checks/runs#update-a-check-run"""
        return self.patch(f"/repos/{repo}/check-runs/{check_run_id}", data=data)

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

    def get_repos(self, page_number_limit: int | None = None) -> list[dict[str, Any]]:
        """
        This fetches all repositories accessible to the Github App
        https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-app-installation

        It uses page_size from the base class to specify how many items per page.
        The upper bound of requests is controlled with self.page_number_limit to prevent infinite requests.
        """
        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_REPOSITORIES,
            provider_key=self.integration_name,
            integration_id=self.integration.id,
        ).capture():
            return self._get_with_pagination(
                "/installation/repositories",
                response_key="repositories",
                page_number_limit=page_number_limit,
            )

    def search_repositories(self, query: bytes) -> Mapping[str, Sequence[Any]]:
        """
        Find repositories matching a query.
        https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#search-repositories

        NOTE: All search APIs (except code search) share a rate limit of 30 requests/minute
        """
        return self.get("/search/repositories", params={"q": query})

    def get_assignees(self, repo: str) -> Sequence[Any]:
        """
        https://docs.github.com/en/rest/issues/assignees#list-assignees
        """
        return self._get_with_pagination(f"/repos/{repo}/assignees")

    def _get_with_pagination(
        self, path: str, response_key: str | None = None, page_number_limit: int | None = None
    ) -> list[Any]:
        """
        Github uses the Link header to provide pagination links. Github
        recommends using the provided link relations and not constructing our
        own URL.
        https://docs.github.com/en/rest/guides/traversing-with-pagination

        Use response_key when the API stores the results within a key.
        For instance, the repositories API returns the list of repos under the "repositories" key
        """
        if page_number_limit is None or page_number_limit > self.page_number_limit:
            page_number_limit = self.page_number_limit

        with sentry_sdk.start_span(
            op=f"{self.integration_type}.http.pagination",
            name=f"{self.integration_type}.http_response.pagination.{self.name}",
        ):
            output: list[dict[str, Any]] = []

            page_number = 1
            resp = self.get(path, params={"per_page": self.page_size})
            output.extend(resp) if not response_key else output.extend(resp[response_key])
            next_link = get_next_link(resp)

            # XXX: In order to speed up this function we will need to parallelize this
            # Use ThreadPoolExecutor; see src/sentry/utils/snuba.py#L358
            while next_link and page_number < page_number_limit:
                # If a per_page is specified, GitHub preserves the per_page value
                # in the response headers.
                resp = self.get(next_link)
                output.extend(resp) if not response_key else output.extend(resp[response_key])

                next_link = get_next_link(resp)
                page_number += 1
            return output

    def search_issues(self, query: str) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        """
        https://docs.github.com/en/rest/search?apiVersion=2022-11-28#search-issues-and-pull-requests

        NOTE: All search APIs (except code search) share a rate limit of 30 requests/minute
        """
        return self.get("/search/issues", params={"q": query})

    def get_issue(self, repo: str, number: str) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#get-an-issue
        """
        return self.get(f"/repos/{repo}/issues/{number}")

    def get_issue_comments(self, repo: str, issue_number: str) -> Any:
        """
        https://docs.github.com/en/rest/issues/comments#list-issue-comments
        """
        return self.get(f"/repos/{repo}/issues/{issue_number}/comments")

    def get_pull_request_comments(self, repo: str, pull_number: str) -> Any:
        """
        https://docs.github.com/en/rest/pulls/comments#list-review-comments-on-a-pull-request
        """
        return self.get(f"/repos/{repo}/pulls/{pull_number}/comments")

    def create_issue(self, repo: str, data: Mapping[str, Any]) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#create-an-issue
        """
        endpoint = f"/repos/{repo}/issues"
        return self.post(endpoint, data=data)

    def update_issue_assignees(self, repo: str, issue_number: str, assignees: list[str]) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#update-an-issue
        """
        endpoint = f"/repos/{repo}/issues/{issue_number}"
        return self.patch(endpoint, data={"assignees": assignees})

    def update_issue_status(self, repo: str, issue_number: str, status: str) -> Any:
        """
        https://docs.github.com/en/rest/issues/issues#update-an-issue
        """
        endpoint = f"/repos/{repo}/issues/{issue_number}"
        return self.patch(endpoint, data={"state": status})

    def get_issue_reactions(self, repo: str, issue_number: str) -> list[Any]:
        """
        https://docs.github.com/en/rest/reactions/reactions#list-reactions-for-an-issue
        """
        return self._get_with_pagination(f"/repos/{repo}/issues/{issue_number}/reactions")

    def create_issue_reaction(self, repo: str, issue_number: str, reaction: GitHubReaction) -> Any:
        """
        https://docs.github.com/en/rest/reactions/reactions#create-reaction-for-an-issue
        """
        endpoint = f"/repos/{repo}/issues/{issue_number}/reactions"
        return self.post(endpoint, data={"content": reaction.value})

    def delete_issue_reaction(self, repo: str, issue_number: str, reaction_id: str) -> Any:
        """
        https://docs.github.com/en/rest/reactions/reactions#delete-an-issue-reaction
        """
        return self.delete(f"/repos/{repo}/issues/{issue_number}/reactions/{reaction_id}")

    def create_comment(self, repo: str, issue_id: str, data: dict[str, Any]) -> Any:
        """
        https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
        """
        endpoint = f"/repos/{repo}/issues/{issue_id}/comments"
        return self.post(endpoint, data=data)

    def update_comment(
        self, repo: str, issue_id: str, comment_id: str, data: dict[str, Any]
    ) -> Any:
        endpoint = f"/repos/{repo}/issues/comments/{comment_id}"
        return self.patch(endpoint, data=data)

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
        return self._get_with_pagination(f"/repos/{repo}/issues/comments/{comment_id}/reactions")

    def create_comment_reaction(self, repo: str, comment_id: str, reaction: GitHubReaction) -> Any:
        """
        https://docs.github.com/en/rest/reactions/reactions#create-reaction-for-an-issue-comment

        Args:
            repo: Repository name in "owner/repo" format
            comment_id: The ID of the comment
            reaction: The reaction type
        """
        endpoint = f"/repos/{repo}/issues/comments/{comment_id}/reactions"
        return self.post(endpoint, data={"content": reaction.value})

    def delete_issue_comment(self, repo: str, comment_id: str) -> None:
        """
        https://docs.github.com/en/rest/issues/comments#delete-an-issue-comment
        """
        self.delete(f"/repos/{repo}/issues/comments/{comment_id}")

    def delete_comment_reaction(self, repo: str, comment_id: str, reaction_id: str) -> None:
        """
        https://docs.github.com/en/rest/reactions/reactions#delete-an-issue-comment-reaction
        """
        self.delete(f"/repos/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}")

    def get_user(self, gh_username: str) -> Any:
        """
        https://docs.github.com/en/rest/users/users#get-a-user
        """
        return self.get(f"/users/{gh_username}")

    def get_labels(self, owner: str, repo: str) -> list[Any]:
        """
        Fetches all labels for a repository.
        https://docs.github.com/en/rest/issues/labels#list-labels-for-a-repository
        """
        return self._get_with_pagination(f"/repos/{owner}/{repo}/labels")

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        return self.head_cached(path=f"/repos/{repo.name}/contents/{path}", params={"ref": version})

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
        )

        if codeowners:
            if not contents.ok:
                raise ApiError.from_response(contents)
            return contents.content.decode("utf-8")

        return b64decode(contents["content"]).decode("utf-8")

    def _graphql(
        self,
        query: str,
        variables: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a GraphQL query/mutation against GitHub's API."""
        payload: dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        response = self.post(path="/graphql", data=payload, allow_text=False)

        if not isinstance(response, Mapping) or (
            "data" not in response and "errors" not in response
        ):
            raise ApiError("GraphQL response is not in expected format")

        errors = response.get("errors", [])
        if errors:
            if any(error.get("type") == "RATE_LIMITED" for error in errors):
                raise ApiRateLimitedError("GitHub rate limit exceeded")
            if not response.get("data"):
                err_message = "\n".join(e.get("message", "") for e in errors)
                raise ApiError(err_message)

        return response.get("data", {})

    def get_pull_request_comments_graphql(
        self,
        owner: str,
        repo: str,
        pr_number: int,
        *,
        comments_after: str | None = None,
        include_comments: bool = True,
        review_threads_after: str | None = None,
        include_threads: bool = True,
    ) -> dict[str, Any]:
        """Fetch PR comments and review threads via GraphQL with independent pagination."""
        variables: dict[str, Any] = {
            "owner": owner,
            "repo": repo,
            "prNumber": pr_number,
            "includeComments": include_comments,
            "includeThreads": include_threads,
        }
        if comments_after is not None:
            variables["commentsAfter"] = comments_after
        if review_threads_after is not None:
            variables["reviewThreadsAfter"] = review_threads_after
        return self._graphql(GET_PULL_REQUEST_COMMENTS_QUERY, variables)

    def minimize_comment(self, comment_node_id: str, reason: str) -> dict[str, Any]:
        """Minimize (collapse) a comment by its GraphQL node ID."""
        return self._graphql(
            MINIMIZE_COMMENT_MUTATION,
            {"commentId": comment_node_id, "reason": reason},
        )

    def resolve_review_thread(self, thread_node_id: str) -> dict[str, Any]:
        """Resolve a review thread by its GraphQL node ID."""
        return self._graphql(
            RESOLVE_REVIEW_THREAD_MUTATION,
            {"threadId": thread_node_id},
        )

    def delete_pull_request_review_comment(self, comment_node_id: str) -> dict[str, Any]:
        """Delete a pull request review comment by its GraphQL node ID."""
        return self._graphql(
            DELETE_PULL_REQUEST_REVIEW_COMMENT_MUTATION,
            {"commentNodeId": comment_node_id},
        )

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
        return self.post(endpoint, data=data)

    def get_check_run(self, repo: str, check_run_id: int) -> Any:
        """
        https://docs.github.com/en/rest/checks/runs#get-a-check-run

        The repo must be in the format of "owner/repo".
        """
        endpoint = f"/repos/{repo}/check-runs/{check_run_id}"
        return self.get(endpoint)

    def get_check_runs(self, repo: str, sha: str) -> Any:
        """
        https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference

        The repo must be in the format of "owner/repo". SHA can be any reference.
        """
        endpoint = f"/repos/{repo}/commits/{sha}/check-runs"
        return self.get(endpoint)


class _IntegrationIdParams(TypedDict, total=False):
    integration_id: int


class GitHubApiClient(GitHubBaseClient):
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

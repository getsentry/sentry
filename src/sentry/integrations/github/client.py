from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Mapping, Sequence, cast

import sentry_sdk
from requests import PreparedRequest

from sentry.constants import ObjectStatus
from sentry.integrations.github.utils import get_jwt, get_next_link
from sentry.integrations.utils.code_mapping import (
    MAX_CONNECTION_ERRORS,
    Repo,
    RepoTree,
    filter_source_code_files,
)
from sentry.models import Integration, Repository
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.cache import cache
from sentry.utils.json import JSONData

logger = logging.getLogger("sentry.integrations.github")

# Some functions that require a large number of API requests can use this value
# as the lower ceiling before hitting Github anymore, thus, leaving at least these
# many requests left for other features that need to reach Github
MINIMUM_REQUESTS = 200


class GithubRateLimitInfo:
    def __init__(self, info: Dict[str, int]) -> None:
        self.limit = info["limit"]
        self.remaining = info["remaining"]
        self.reset = info["reset"]
        self.used = info["used"]

    def next_window(self) -> str:
        return datetime.utcfromtimestamp(self.reset).strftime("%H:%M:%S")

    def __repr__(self) -> str:
        return f"GithubRateLimit(limit={self.limit},rem={self.remaining},reset={self.reset})"


class GithubProxyClient(IntegrationProxyClient):
    def _get_installation_id(self) -> str:
        self.integration: RpcIntegration
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
    def _refresh_access_token(self) -> str | None:
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
        access_token = cast(str, data["token"])
        expires_at = datetime.strptime(data["expires_at"], "%Y-%m-%dT%H:%M:%SZ").isoformat()
        integration.metadata.update({"access_token": access_token, "expires_at": expires_at})
        integration.save()
        logger.info(
            "token.refresh_end",
            extra={
                "new_expires_at": integration.metadata.get("expires_at"),
                "integration_id": integration.id,
            },
        )

        self.integration = integration
        return access_token

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
        should_use_jwt = (
            "/app/installations" in prepared_request.path_url
            or "access_tokens" in prepared_request.path_url
        )
        if should_use_jwt:
            jwt = self._get_jwt()
            logger.info("token.jwt", extra=logger_extra)
            return jwt

        # The rest should use access tokens...
        now = datetime.utcnow()
        access_token: str | None = self.integration.metadata.get("access_token")
        expires_at: str | None = self.integration.metadata.get("expires_at")
        is_expired = (
            bool(expires_at) and datetime.strptime(cast(str, expires_at), "%Y-%m-%dT%H:%M:%S") < now
        )
        should_refresh = not access_token or not expires_at or is_expired

        if should_refresh:
            access_token = self._refresh_access_token()

        logger.info("token.access_token", extra=logger_extra)
        return access_token

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        integration: RpcIntegration | Integration | None = None
        if hasattr(self, "integration"):
            integration = self.integration
        elif hasattr(self, "org_integration_id"):
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

        prepared_request.headers["Accept"] = "application/vnd.github+json"
        prepared_request.headers["Authorization"] = f"Bearer {token}"

        return prepared_request


class GitHubClientMixin(GithubProxyClient):
    allow_redirects = True

    base_url = "https://api.github.com"
    integration_name = "github"
    # Github gives us links to navigate, however, let's be safe in case we're fed garbage
    page_number_limit = 50  # With a default of 100 per page -> 5,000 items

    def get_last_commits(self, repo: str, end_sha: str) -> Sequence[JSONData]:
        """
        Return API request that fetches last ~30 commits
        see https://docs.github.com/en/rest/commits/commits#list-commits-on-a-repository
        using end_sha as parameter.
        """
        # Explicitly typing to satisfy mypy.
        commits: Sequence[JSONData] = self.get_cached(
            f"/repos/{repo}/commits", params={"sha": end_sha}
        )
        return commits

    def compare_commits(self, repo: str, start_sha: str, end_sha: str) -> JSONData:
        """
        See https://docs.github.com/en/rest/commits/commits#compare-two-commits
        where start sha is oldest and end is most recent.
        """
        # Explicitly typing to satisfy mypy.
        diff: JSONData = self.get_cached(f"/repos/{repo}/compare/{start_sha}...{end_sha}")
        return diff

    def repo_hooks(self, repo: str) -> Sequence[JSONData]:
        """
        https://docs.github.com/en/rest/webhooks/repos#list-repository-webhooks
        """
        # Explicitly typing to satisfy mypy.
        hooks: Sequence[JSONData] = self.get(f"/repos/{repo}/hooks")
        return hooks

    def get_commits(self, repo: str) -> Sequence[JSONData]:
        """
        https://docs.github.com/en/rest/commits/commits#list-commits
        """
        # Explicitly typing to satisfy mypy.
        commits: Sequence[JSONData] = self.get(f"/repos/{repo}/commits")
        return commits

    def get_commit(self, repo: str, sha: str) -> JSONData:
        """
        https://docs.github.com/en/rest/commits/commits#get-a-commit
        """
        # Explicitly typing to satisfy mypy.
        commit: JSONData = self.get_cached(f"/repos/{repo}/commits/{sha}")
        return commit

    def get_repo(self, repo: str) -> JSONData:
        """
        https://docs.github.com/en/rest/repos/repos#get-a-repository
        """
        # Explicitly typing to satisfy mypy.
        repository: JSONData = self.get(f"/repos/{repo}")
        return repository

    # https://docs.github.com/en/rest/rate-limit?apiVersion=2022-11-28
    def get_rate_limit(self, specific_resource: str = "core") -> GithubRateLimitInfo:
        """This gives information of the current rate limit"""
        # There's more but this is good enough
        assert specific_resource in ("core", "search", "graphql")
        return GithubRateLimitInfo(self.get("/rate_limit")["resources"][specific_resource])

    # https://docs.github.com/en/rest/git/trees#get-a-tree
    def get_tree(self, repo_full_name: str, tree_sha: str) -> JSONData:
        tree: JSONData = {}
        # We do not cache this call since it is a rather large object
        contents: Dict[str, Any] = self.get(
            f"/repos/{repo_full_name}/git/trees/{tree_sha}",
            # Will cause all objects or subtrees referenced by the tree specified in :tree_sha
            params={"recursive": 1},
        )
        # If truncated is true in the response then the number of items in the tree array exceeded our maximum limit.
        # If you need to fetch more items, use the non-recursive method of fetching trees, and fetch one sub-tree at a time.
        # Note: The limit for the tree array is 100,000 entries with a maximum size of 7 MB when using the recursive parameter.
        # XXX: We will need to improve this by iterating through trees without using the recursive parameter
        if contents.get("truncated"):
            # e.g. getsentry/DataForThePeople
            logger.warning(
                f"The tree for {repo_full_name} has been truncated. Use different a approach for retrieving contents of tree."
            )
        tree = contents["tree"]

        return tree

    def get_cached_repo_files(
        self,
        repo_full_name: str,
        tree_sha: str,
        only_source_code_files: bool = True,
        only_use_cache: bool = False,
        cache_seconds: int = 3600 * 24,
    ) -> List[str]:
        """It return all files for a repo or just source code files.

        repo_full_name: e.g. getsentry/sentry
        tree_sha: A branch or a commit sha
        only_source_code_files: Include all files or just the source code files
        only_use_cache: Do not hit the network but use the value from the cache
            if any. This is useful if the remaining API requests are low
        cache_seconds: How long to cache a value for
        """
        key = f"github:repo:{repo_full_name}:{'source-code' if only_source_code_files else 'all'}"
        repo_files: List[str] = cache.get(key, [])
        if not repo_files and not only_use_cache:
            tree = self.get_tree(repo_full_name, tree_sha)
            if tree:
                # Keep files; discard directories
                repo_files = [x["path"] for x in tree if x["type"] == "blob"]
                if only_source_code_files:
                    repo_files = filter_source_code_files(files=repo_files)
                # The backend's caching will skip silently if the object size greater than 5MB
                # The trees API does not return structures larger than 7MB
                # As an example, all file paths in Sentry is about 1.3MB
                # Larger customers may have larger repositories, however,
                # the cost of not having cached the files cached for those
                # repositories is a single GH API network request, thus,
                # being acceptable to sometimes not having everything cached
                cache.set(key, repo_files, cache_seconds)

        return repo_files

    def get_trees_for_org(self, gh_org: str, cache_seconds: int = 3600 * 24) -> Dict[str, RepoTree]:
        """
        This fetches tree representations of all repos for an org and saves its
        contents into the cache.
        """
        trees: Dict[str, RepoTree] = {}
        extra = {"gh_org": gh_org}
        repositories = self._populate_repositories(gh_org, cache_seconds)
        extra.update({"repos_num": str(len(repositories))})
        trees = self._populate_trees(repositories)
        if trees:
            logger.info("Using cached trees for Github org.", extra=extra)

        try:
            rate_limit = self.get_rate_limit()
            extra.update({"remaining": str(rate_limit.remaining)})
        except ApiError:
            logger.warning("Failed to get latest rate limit info. Let's keep going.")

        return trees

    def _populate_repositories(self, gh_org: str, cache_seconds: int) -> List[Dict[str, str]]:
        cache_key = f"githubtrees:repositories:{gh_org}"
        repositories: List[Dict[str, str]] = cache.get(cache_key, [])

        if not repositories:
            # Remove unnecessary fields from the response
            repositories = [
                {"full_name": repo["full_name"], "default_branch": repo["default_branch"]}
                for repo in self.get_repositories(fetch_max_pages=True)
            ]
            if not repositories:
                logger.warning("Fetching repositories returned an empty list.")
            else:
                cache.set(cache_key, repositories, cache_seconds)
                logger.info("Cached repositories.", extra={"repos_count": len(repositories)})

        return repositories

    def _populate_trees_process_error(self, error: ApiError, extra: Dict[str, str]) -> bool:
        """
        Log different messages based on the error received. Returns a boolean indicating whether
        the error should count towards the connection errors tally.
        """
        msg = "Continuing execution."
        should_count_error = False
        txt = error.text
        if error.json:
            json_data: JSONData = error.json
            txt = json_data.get("message")

        # TODO: Add condition for  getsentry/DataForThePeople
        # e.g. getsentry/nextjs-sentry-example
        if txt == "Git Repository is empty.":
            logger.warning(f"The repository is empty. {msg}", extra=extra)
        elif txt == "Not Found":
            logger.warning(f"The app does not have access to the repo. {msg}", extra=extra)
        elif txt == "Repository access blocked":
            logger.warning(f"Github has blocked the repository. {msg}", extra=extra)
        elif txt == "Server Error":
            logger.warning(f"Github failed to respond. {msg}.", extra=extra)
            should_count_error = True
        elif txt == "Bad credentials":
            logger.warning(f"No permission granted for this repo. {msg}.", extra=extra)
        elif txt == "Connection reset by peer":
            logger.warning(f"Connection reset by GitHub. {msg}.", extra=extra)
            should_count_error = True
        elif txt == "Connection broken: invalid chunk length":
            logger.warning(f"Connection broken by chunk with invalid length. {msg}.", extra=extra)
            should_count_error = True
        elif txt and txt.startswith("Unable to reach host:"):
            logger.warning(f"Unable to reach host at the moment. {msg}.", extra=extra)
            should_count_error = True
        elif txt and txt.startswith("Due to U.S. trade controls law restrictions, this GitHub"):
            logger.warning("Github has blocked this org. We will not continue.", extra=extra)
            # Raising the error will be handled at the task level
            raise error
        else:
            # We do not raise the exception so we can keep iterating through the repos.
            # Nevertheless, investigate the error to determine if we should abort the processing
            logger.exception(
                f"Investigate if to raise error. An error happened. {msg}", extra=extra
            )

        return should_count_error

    def _populate_trees(self, repositories: List[Dict[str, str]]) -> Dict[str, RepoTree]:
        """
        For every repository, fetch the tree associated and cache it.
        This function takes API rate limits into consideration to prevent exhaustion.
        """
        trees: Dict[str, RepoTree] = {}
        only_use_cache = False
        connection_error_count = 0

        remaining_requests = MINIMUM_REQUESTS
        try:
            rate_limit = self.get_rate_limit()
            remaining_requests = rate_limit.remaining
            logger.info("Current rate limit info.", extra={"rate_limit": rate_limit})
        except ApiError:
            only_use_cache = True
            # Report so we can investigate
            logger.exception("Loading trees from cache. Execution will continue. Check logs.")

        for index, repo_info in enumerate(repositories):
            repo_full_name = repo_info["full_name"]
            extra = {"repo_full_name": repo_full_name}
            # Only use the cache if we drop below the lower ceiling
            # We will fetch after the limit is reset (every hour)
            if not only_use_cache and remaining_requests <= MINIMUM_REQUESTS:
                only_use_cache = True
                logger.info(
                    "Too few requests remaining. Grabbing values from the cache.", extra=extra
                )
            else:
                remaining_requests -= 1

            try:
                # The Github API rate limit is reset every hour
                # Spread the expiration of the cache of each repo across the day
                trees[repo_full_name] = self._populate_tree(
                    repo_info, only_use_cache, (3600 * 24) + (3600 * (index % 24))
                )
            except ApiError as error:
                should_count_error = self._populate_trees_process_error(error, extra)
                if should_count_error:
                    connection_error_count += 1
            except Exception:
                # Report for investigation but do not stop processing
                logger.exception(
                    "Failed to populate_tree. Investigate. Contining execution.", extra=extra
                )

            if connection_error_count >= MAX_CONNECTION_ERRORS:
                logger.warning(
                    "Falling back to the cache because we've hit too many errors connecting to GitHub.",
                    extra=extra,
                )
                only_use_cache = True

        return trees

    def _populate_tree(
        self, repo_info: Dict[str, str], only_use_cache: bool, cache_seconds: int
    ) -> RepoTree:
        full_name = repo_info["full_name"]
        branch = repo_info["default_branch"]
        repo_files = self.get_cached_repo_files(
            full_name, branch, only_use_cache=only_use_cache, cache_seconds=cache_seconds
        )
        return RepoTree(Repo(full_name, branch), repo_files)

    def get_repositories(self, fetch_max_pages: bool = False) -> Sequence[JSONData]:
        """
        args:
         * fetch_max_pages - fetch as many repos as possible using pagination (slow)

        This fetches all repositories accessible to the Github App
        https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-app-installation

        It uses page_size from the base class to specify how many items per page.
        The upper bound of requests is controlled with self.page_number_limit to prevent infinite requests.
        """
        # XXX: In order to speed up this function we will need to parallelize this
        # Use ThreadPoolExecutor; see src/sentry/utils/snuba.py#L358
        # Explicitly typing to satisfy mypy.
        repos: JSONData = self.get_with_pagination(
            "/installation/repositories",
            response_key="repositories",
            page_number_limit=self.page_number_limit if fetch_max_pages else 1,
        )
        return [repo for repo in repos if not repo.get("archived")]

    # XXX: Find alternative approach
    def search_repositories(self, query: bytes) -> Mapping[str, Sequence[JSONData]]:
        """
        Find repositories matching a query.
        NOTE: This API is rate limited to 30 requests/minute

        https://docs.github.com/en/rest/search#search-repositories
        """
        # Explicitly typing to satisfy mypy.
        repositories: Mapping[str, Sequence[JSONData]] = self.get(
            "/search/repositories", params={"q": query}
        )
        return repositories

    def get_assignees(self, repo: str) -> Sequence[JSONData]:
        """
        https://docs.github.com/en/rest/issues/assignees#list-assignees
        """
        # Explicitly typing to satisfy mypy.
        assignees: Sequence[JSONData] = self.get_with_pagination(f"/repos/{repo}/assignees")
        return assignees

    def get_with_pagination(
        self, path: str, response_key: str | None = None, page_number_limit: int | None = None
    ) -> Sequence[JSONData]:
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
            description=f"{self.integration_type}.http_response.pagination.{self.name}",
        ):
            output = []

            page_number = 1
            logger.info(f"Page {page_number}: {path}?per_page={self.page_size}")
            resp = self.get(path, params={"per_page": self.page_size})
            logger.info(resp)
            output.extend(resp) if not response_key else output.extend(resp[response_key])
            next_link = get_next_link(resp)

            # XXX: Debugging code; remove afterward
            if (
                response_key
                and response_key == "repositories"
                and resp["total_count"] > 0
                and not output
            ):
                logger.info(f"headers: {resp.headers}")
                logger.info(f"output: {output}")
                logger.info(f"next_link: {next_link}")
                logger.error("No list of repos even when there's some. Investigate.")

            # XXX: In order to speed up this function we will need to parallelize this
            # Use ThreadPoolExecutor; see src/sentry/utils/snuba.py#L358
            while next_link and page_number < page_number_limit:
                resp = self.get(next_link)
                logger.info(resp)
                output.extend(resp) if not response_key else output.extend(resp[response_key])

                next_link = get_next_link(resp)
                logger.info(f"Page {page_number}: {next_link}")
                page_number += 1
            return output

    def get_issues(self, repo: str) -> Sequence[JSONData]:
        issues: Sequence[JSONData] = self.get(f"/repos/{repo}/issues")
        return issues

    def search_issues(self, query: str) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        """
        https://docs.github.com/en/rest/search?#search-issues-and-pull-requests
        """
        # Explicitly typing to satisfy mypy.
        issues: Mapping[str, Sequence[Mapping[str, Any]]] = self.get(
            "/search/issues", params={"q": query}
        )
        return issues

    def get_issue(self, repo: str, number: str) -> JSONData:
        """
        https://docs.github.com/en/rest/issues/issues#get-an-issue
        """
        return self.get(f"/repos/{repo}/issues/{number}")

    def create_issue(self, repo: str, data: Mapping[str, Any]) -> JSONData:
        """
        https://docs.github.com/en/rest/issues/issues#create-an-issue
        """
        endpoint = f"/repos/{repo}/issues"
        return self.post(endpoint, data=data)

    def create_comment(self, repo: str, issue_id: str, data: Mapping[str, Any]) -> JSONData:
        """
        https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
        """
        endpoint = f"/repos/{repo}/issues/{issue_id}/comments"
        return self.post(endpoint, data=data)

    def get_user(self, gh_username: str) -> JSONData:
        """
        https://docs.github.com/en/rest/users/users#get-a-user
        """
        return self.get(f"/users/{gh_username}")

    def check_file(self, repo: Repository, path: str, version: str) -> str | None:
        file: str = self.head_cached(
            path=f"/repos/{repo.name}/contents/{path}", params={"ref": version}
        )
        return file

    def get_file(self, repo: Repository, path: str, ref: str) -> str:
        """Get the contents of a file

        See https://docs.github.com/en/rest/reference/repos#get-repository-content
        """
        from base64 import b64decode

        contents = self.get(path=f"/repos/{repo.name}/contents/{path}", params={"ref": ref})
        encoded_content = contents["content"]
        return b64decode(encoded_content).decode("utf-8")

    def get_blame_for_file(
        self, repo: Repository, path: str, ref: str, lineno: int
    ) -> Sequence[Mapping[str, Any]]:
        [owner, name] = repo.name.split("/")
        query = f"""query {{
            repository(name: "{name}", owner: "{owner}") {{
                ref(qualifiedName: "{ref}") {{
                    target {{
                        ... on Commit {{
                            blame(path: "{path}") {{
                                ranges {{
                                        commit {{
                                            oid
                                            author {{
                                                name
                                                email
                                            }}
                                            message
                                            committedDate
                                        }}
                                    startingLine
                                    endingLine
                                    age
                                }}
                            }}
                        }}
                    }}
                }}
            }}
        }}"""

        contents = self.post(
            path="/graphql",
            data={"query": query},
        )

        try:
            results: Sequence[Mapping[str, Any]] = (
                contents.get("data", {})
                .get("repository", {})
                .get("ref", {})
                .get("target", {})
                .get("blame", {})
                .get("ranges", [])
            )
            return results
        except AttributeError as e:
            if contents.get("errors"):
                err_message = ", ".join(
                    [error.get("message", "") for error in contents.get("errors", [])]
                )
                raise ApiError(err_message)

            if contents.get("data", {}).get("repository", {}).get("ref", {}) is None:
                raise ApiError("Branch does not exist in GitHub.")

            sentry_sdk.capture_exception(e)

            return []


class GitHubAppsClient(GitHubClientMixin):
    def __init__(
        self,
        integration: Integration,
        org_integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        self.integration = integration
        super().__init__(
            org_integration_id=org_integration_id,
            verify_ssl=verify_ssl,
            logging_context=logging_context,
        )

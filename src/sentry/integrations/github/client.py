from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Sequence

import sentry_sdk

from sentry.integrations.client import ApiClient
from sentry.integrations.github.utils import get_jwt, get_next_link
from sentry.integrations.utils.code_mapping import Repo, RepoTree, filter_source_code_files
from sentry.models import Integration, Repository
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.utils import jwt
from sentry.utils.cache import cache
from sentry.utils.json import JSONData

logger = logging.getLogger("sentry.integrations.github")


class GithubRateLimitInfo:
    def __init__(self, info: Dict[str, int]) -> None:
        self.limit = info["limit"]
        self.remaining = info["remaining"]
        self.reset = info["reset"]
        self.used = info["used"]

    def next_window(self) -> str:
        return datetime.utcfromtimestamp(self.reset).strftime("%H:%M:%S")


class GitHubClientMixin(ApiClient):  # type: ignore
    allow_redirects = True

    base_url = "https://api.github.com"
    integration_name = "github"
    # Github gives us links to navigate, however, let's be safe in case we're fed garbage
    page_number_limit = 50  # With a default of 100 per page -> 5,000 items

    def get_jwt(self) -> str:
        return get_jwt()

    def get_last_commits(self, repo: str, end_sha: str) -> Sequence[JSONData]:
        """
        Return API request that fetches last ~30 commits
        see https://developer.github.com/v3/repos/commits/#list-commits-on-a-repository
        using end_sha as parameter.
        """
        # Explicitly typing to satisfy mypy.
        commits: Sequence[JSONData] = self.get_cached(
            f"/repos/{repo}/commits", params={"sha": end_sha}
        )
        return commits

    def compare_commits(self, repo: str, start_sha: str, end_sha: str) -> JSONData:
        """
        See https://developer.github.com/v3/repos/commits/#compare-two-commits
        where start sha is oldest and end is most recent.
        """
        # Explicitly typing to satisfy mypy.
        diff: JSONData = self.get_cached(f"/repos/{repo}/compare/{start_sha}...{end_sha}")
        return diff

    def repo_hooks(self, repo: str) -> Sequence[JSONData]:
        # Explicitly typing to satisfy mypy.
        hooks: Sequence[JSONData] = self.get(f"/repos/{repo}/hooks")
        return hooks

    def get_commits(self, repo: str) -> Sequence[JSONData]:
        # Explicitly typing to satisfy mypy.
        commits: Sequence[JSONData] = self.get(f"/repos/{repo}/commits")
        return commits

    def get_commit(self, repo: str, sha: str) -> JSONData:
        # Explicitly typing to satisfy mypy.
        commit: JSONData = self.get_cached(f"/repos/{repo}/commits/{sha}")
        return commit

    def get_repo(self, repo: str) -> JSONData:
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
        try:
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
        except ApiError as e:
            json_data: JSONData = e.json
            msg: str = json_data.get("message")
            # TODO: Add condition for  getsentry/DataForThePeople
            # e.g. getsentry/nextjs-sentry-example
            if msg == "Git Repository is empty.":
                logger.warning(f"{repo_full_name} is empty.")
            elif msg == "Not Found":
                logger.warning(f"The Github App does not have access to {repo_full_name}.")
            else:
                # Raise it so we can stop hammering the API
                raise (e)

        return tree

    def get_cached_repo_files(
        self,
        repo_full_name: str,
        tree_sha: str,
        only_source_code_files: bool = True,
        cache_seconds: int = 3600 * 24,
    ) -> List[str]:
        """It return all files for a repo or just source code files.

        repo_full_name: e.g. getsentry/sentry
        tree_sha: A branch or a commit sha
        only_source_code_files: Include all files or just the source code files
        """
        key = f"github:repo:{repo_full_name}:{'source-code' if only_source_code_files else 'all'}"
        repo_files: List[str] = cache.get(key, [])
        if not repo_files:
            tree = self.get_tree(repo_full_name, tree_sha)
            if tree is not None:
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

    def get_trees_for_org(
        self, cache_key: str, gh_org: str, cache_seconds: int = 3600 * 24
    ) -> Dict[str, RepoTree]:
        """
        This fetches tree representations of all repos for an org and saves its
        contents into the cache.
        """
        trees: Dict[str, RepoTree] = {}
        cache_key = f"githubtrees:repositories:{cache_key}:{gh_org}"
        repositories = cache.get(cache_key)
        extra = {"gh_org": gh_org}
        if not repositories:
            # Simply removing unnecessary fields from the response
            repositories = [
                {"full_name": repo["full_name"], "default_branch": repo["default_branch"]}
                for repo in self.get_repositories(fetch_max_pages=True)
            ]
            cache.set(cache_key, repositories, cache_seconds)
            next_time = datetime.now() + timedelta(seconds=cache_seconds)
            extra["next_time"] = str(next_time)
            logger.info("Caching trees for Github org.", extra=extra)

        # XXX: In order to speed up this function we will need to parallelize this
        # Use ThreadPoolExecutor; see src/sentry/utils/snuba.py#L358
        try:
            for repo_info in repositories:
                full_name = repo_info["full_name"]
                branch = repo_info["default_branch"]
                repo_files = self.get_cached_repo_files(full_name, branch)
                trees[full_name] = RepoTree(Repo(full_name, branch), repo_files)
            logger.info("Using cached trees for Github org.", extra=extra)
        except ApiError as e:
            json_data: JSONData = e.json
            msg: str = json_data.get("message")
            if msg.startswith("API rate limit exceeded for installation"):
                logger.exception("API rate limit exceeded. We will not hit it.")
        except Exception:
            # Reset the control cache in order to repopulate
            cache.delete(cache_key)
            logger.exception(f"We reset the cache for {cache_key}.")

        return trees

    def get_repositories(self, fetch_max_pages: bool = False) -> Sequence[JSONData]:
        """
        args:
         * fetch_max_pages - fetch as many repos as possible using pagination (slow)

        This fetches all repositories accessible to the Github App
        https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-app-installation
        """
        # Explicitly typing to satisfy mypy.
        repos: JSONData = self.get_with_pagination(
            "/installation/repositories",
            response_key="repositories",
            page_number_limit=self.page_number_limit if fetch_max_pages else 1,
        )
        return [repo for repo in repos if not repo.get("archived")]

    # XXX: Find alternative approach
    def search_repositories(self, query: bytes) -> Mapping[str, Sequence[JSONData]]:
        """Find repositories matching a query.
        NOTE: This API is rate limited to 30 requests/minute"""
        # Explicitly typing to satisfy mypy.
        repositories: Mapping[str, Sequence[JSONData]] = self.get(
            "/search/repositories", params={"q": query}
        )
        return repositories

    def get_assignees(self, repo: str) -> Sequence[JSONData]:
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
        with sentry_sdk.configure_scope() as scope:
            if scope.span is not None:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
            else:
                parent_span_id = None
                trace_id = None

        if page_number_limit is None or page_number_limit > self.page_number_limit:
            page_number_limit = self.page_number_limit

        with sentry_sdk.start_transaction(
            op=f"{self.integration_type}.http.pagination",
            name=f"{self.integration_type}.http_response.pagination.{self.name}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=True,
        ):
            output = []

            resp = self.get(path, params={"per_page": self.page_size})
            output.extend(resp) if not response_key else output.extend(resp[response_key])
            page_number = 1

            # XXX: In order to speed up this function we will need to parallelize this
            # Use ThreadPoolExecutor; see src/sentry/utils/snuba.py#L358
            while get_next_link(resp) and page_number < page_number_limit:
                resp = self.get(get_next_link(resp))
                output.extend(resp) if not response_key else output.extend(resp[response_key])
                page_number += 1
            return output

    def get_issues(self, repo: str) -> Sequence[JSONData]:
        issues: Sequence[JSONData] = self.get(f"/repos/{repo}/issues")
        return issues

    def search_issues(self, query: str) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        # Explicitly typing to satisfy mypy.
        issues: Mapping[str, Sequence[Mapping[str, Any]]] = self.get(
            "/search/issues", params={"q": query}
        )
        return issues

    def get_issue(self, repo: str, number: str) -> JSONData:
        return self.get(f"/repos/{repo}/issues/{number}")

    def create_issue(self, repo: str, data: Mapping[str, Any]) -> JSONData:
        endpoint = f"/repos/{repo}/issues"
        return self.post(endpoint, data=data)

    def create_comment(self, repo: str, issue_id: str, data: Mapping[str, Any]) -> JSONData:
        endpoint = f"/repos/{repo}/issues/{issue_id}/comments"
        return self.post(endpoint, data=data)

    def get_user(self, gh_username: str) -> JSONData:
        return self.get(f"/users/{gh_username}")

    # subclassing BaseApiClient request method
    def request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, Any] | None = None,
        data: Mapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
    ) -> JSONData:
        if headers is None:
            headers = {
                "Authorization": f"token {self.get_token()}",
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            }
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_token(self, force_refresh: bool = False) -> str:
        """
        Get token retrieves the active access token from the integration model.
        Should the token have expired, a new token will be generated and
        automatically persisted into the integration.
        """
        token: str | None = self.integration.metadata.get("access_token")
        expires_at: str | None = self.integration.metadata.get("expires_at")

        if (
            not token
            or not expires_at
            or (datetime.strptime(expires_at, "%Y-%m-%dT%H:%M:%S") < datetime.utcnow())
            or force_refresh
        ):
            res = self.create_token()
            token = res["token"]
            expires_at = datetime.strptime(res["expires_at"], "%Y-%m-%dT%H:%M:%SZ").isoformat()

            self.integration.metadata.update({"access_token": token, "expires_at": expires_at})
            self.integration.save()

        return token or ""

    def create_token(self) -> JSONData:
        headers = {
            # TODO(jess): remove this whenever it's out of preview
            "Accept": "application/vnd.github.machine-man-preview+json",
        }
        headers.update(jwt.authorization_header(self.get_jwt()))
        return self.post(
            f"/app/installations/{self.integration.external_id}/access_tokens",
            headers=headers,
        )

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
    def __init__(self, integration: Integration) -> None:
        self.integration = integration
        super().__init__()

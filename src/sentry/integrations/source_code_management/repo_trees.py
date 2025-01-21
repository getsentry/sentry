from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any, NamedTuple

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


# Read this to learn about file extensions for different languages
# https://github.com/github/linguist/blob/master/lib/linguist/languages.yml
# We only care about the ones that would show up in stacktraces after symbolication
SUPPORTED_EXTENSIONS = ["js", "jsx", "tsx", "ts", "mjs", "py", "rb", "rake", "php", "go", "cs"]
EXCLUDED_EXTENSIONS = ["spec.jsx"]
EXCLUDED_PATHS = ["tests/"]


class RepoAndBranch(NamedTuple):
    name: str
    branch: str


class RepoTree(NamedTuple):
    repo: RepoAndBranch
    files: list[str]


# Tasks which hit the API multiple connection errors should give up.
MAX_CONNECTION_ERRORS = 10

# When the number of remaining API requests is less than this value, it will
# fall back to the cache.
MINIMUM_REQUESTS_REMAINING = 200


class RepoTreesIntegration(ABC):
    """
    Base class for integrations that can get trees for an organization's repositories.
    It is used for finding files in repositories and deriving code mappings.
    """

    CACHE_SECONDS = 3600 * 24

    @abstractmethod
    def get_client(self) -> RepoTreesClient:
        """Returns the client for the integration. The client must be a subclass of RepositoryClient."""
        raise NotImplementedError

    @property
    def org_integration(self) -> OrganizationIntegration | None:
        raise NotImplementedError

    @property
    def org_slug(self) -> str:
        raise NotImplementedError

    def get_trees_for_org(self) -> dict[str, RepoTree]:
        trees = {}
        if not self.org_integration:
            raise IntegrationError("Organization Integration does not exist")
        repositories = self._populate_repositories()
        if not repositories:
            logger.warning("Fetching repositories returned an empty list.")
        else:
            trees = self._populate_trees(repositories)

        return trees

    def _populate_repositories(self) -> list[RepoAndBranch]:
        cache_key = f"githubtrees:repositories:{self.org_slug}"
        repositories: list[RepoAndBranch] = cache.get(cache_key, [])

        if not repositories:
            # XXX: Switch to the integration get_repositories to be more generic
            # Remove unnecessary fields from GitHub's API response
            repositories = [
                RepoAndBranch(name=repo["full_name"], branch=repo["default_branch"])
                for repo in self.get_client().get_repositories(fetch_max_pages=True)
            ]

        if repositories:
            cache.set(cache_key, repositories, self.CACHE_SECONDS)

        return repositories

    def _populate_trees_process_error(self, error: ApiError, extra: dict[str, str]) -> bool:
        """
        Log different messages based on the error received. Returns a boolean indicating whether
        the error should count towards the connection errors tally.
        """
        msg = "Continuing execution."
        should_count_error = False
        error_message = error.text
        if error.json:
            json_data: Any = error.json
            error_message = json_data.get("message")

        # TODO: Add condition for  getsentry/DataForThePeople
        # e.g. getsentry/nextjs-sentry-example
        if error_message == "Git Repository is empty.":
            logger.warning("The repository is empty. %s", msg, extra=extra)
        elif error_message == "Not Found":
            logger.warning("The app does not have access to the repo. %s", msg, extra=extra)
        elif error_message == "Repository access blocked":
            logger.warning("Github has blocked the repository. %s", msg, extra=extra)
        elif error_message == "Server Error":
            logger.warning("Github failed to respond. %s.", msg, extra=extra)
            should_count_error = True
        elif error_message == "Bad credentials":
            logger.warning("No permission granted for this repo. %s.", msg, extra=extra)
        elif error_message == "Connection reset by peer":
            logger.warning("Connection reset by GitHub. %s.", msg, extra=extra)
            should_count_error = True
        elif error_message == "Connection broken: invalid chunk length":
            logger.warning("Connection broken by chunk with invalid length. %s.", msg, extra=extra)
            should_count_error = True
        elif error_message and error_message.startswith("Unable to reach host:"):
            logger.warning("Unable to reach host at the moment. %s.", msg, extra=extra)
            should_count_error = True
        elif error_message and error_message.startswith(
            "Due to U.S. trade controls law restrictions, this GitHub"
        ):
            logger.warning("Github has blocked this org. We will not continue.", extra=extra)
            # Raising the error will about the task and be handled at the task level
            raise error
        else:
            # We do not raise the exception so we can keep iterating through the repos.
            # Nevertheless, investigate the error to determine if we should abort the processing
            logger.warning("Continuing execution. Investigate: %s", error_message, extra=extra)

        return should_count_error

    def _populate_trees(self, repositories: Sequence[RepoAndBranch]) -> dict[str, RepoTree]:
        """
        For every repository, fetch the tree associated and cache it.
        This function takes API rate limits into consideration to prevent exhaustion.
        """
        trees: dict[str, RepoTree] = {}
        use_cache = False
        connection_error_count = 0

        remaining_requests = MINIMUM_REQUESTS_REMAINING
        try:
            remaining_requests = self.get_client().get_remaining_api_requests()
        except ApiError:
            use_cache = True
            # Report so we can investigate
            logger.warning("Loading trees from cache. Execution will continue. Check logs.")

        for index, repo_and_branch in enumerate(repositories):
            repo_full_name = repo_and_branch.name
            extra = {"repo_full_name": repo_full_name}
            # Only use the cache if we drop below the lower ceiling
            # We will fetch after the limit is reset (every hour)
            if not use_cache and remaining_requests <= MINIMUM_REQUESTS_REMAINING:
                use_cache = True
            else:
                remaining_requests -= 1

            try:
                # The Github API rate limit is reset every hour
                # Spread the expiration of the cache of each repo across the day
                trees[repo_full_name] = self._populate_tree(
                    repo_and_branch, use_cache, 3600 * (index % 24)
                )
            except ApiError as error:
                if self._populate_trees_process_error(error, extra):
                    connection_error_count += 1
            except Exception:
                # Report for investigation but do not stop processing
                logger.exception(
                    "Failed to populate_tree. Investigate. Contining execution.", extra=extra
                )

            # This is a rudimentary circuit breaker
            if connection_error_count >= MAX_CONNECTION_ERRORS:
                logger.warning(
                    "Falling back to the cache because we've hit too many errors connecting to GitHub.",
                    extra=extra,
                )
                use_cache = True

        return trees

    def _populate_tree(
        self, repo_and_branch: RepoAndBranch, only_use_cache: bool, shifted_seconds: int
    ) -> RepoTree:
        full_name = repo_and_branch.name
        branch = repo_and_branch.branch
        repo_files = self.get_cached_repo_files(
            full_name, branch, shifted_seconds, only_use_cache=only_use_cache
        )
        return RepoTree(repo_and_branch, repo_files)

    # https://docs.github.com/en/rest/git/trees#get-a-tree
    def get_tree(self, repo_full_name: str, tree_sha: str) -> list[dict[str, Any]]:
        tree: list[dict[str, Any]] = []
        # We do not cache this call since it is a rather large object
        contents = self.get_client().get(
            f"/repos/{repo_full_name}/git/trees/{tree_sha}",
            # It will fetch all objects or subtrees referenced by the tree specified in :tree_sha
            params={"recursive": 1},
        )
        assert isinstance(contents, dict)
        # If truncated is true in the response then the number of items in the tree array exceeded our maximum limit.
        # If you need to fetch more items, use the non-recursive method of fetching trees, and fetch one sub-tree at a time.
        # Note: The limit for the tree array is 100,000 entries with a maximum size of 7 MB when using the recursive parameter.
        # XXX: We will need to improve this by iterating through trees without using the recursive parameter
        if contents.get("truncated"):
            # e.g. getsentry/DataForThePeople
            logger.warning(
                "The tree for %s has been truncated. Use different a approach for retrieving remaining contents of tree.",
                repo_full_name,
            )
        tree = contents["tree"]

        return tree

    def get_cached_repo_files(
        self,
        repo_full_name: str,
        tree_sha: str,
        shifted_seconds: int,
        only_source_code_files: bool = True,
        only_use_cache: bool = False,
    ) -> list[str]:
        """It return all files for a repo or just source code files.

        repo_full_name: e.g. getsentry/sentry
        tree_sha: A branch or a commit sha
        only_source_code_files: Include all files or just the source code files
        only_use_cache: Do not hit the network but use the value from the cache
            if any. This is useful if the remaining API requests are low
        """
        key = f"github:repo:{repo_full_name}:{'source-code' if only_source_code_files else 'all'}"
        repo_files: list[str] = cache.get(key, [])
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
                cache.set(key, repo_files, self.CACHE_SECONDS + shifted_seconds)

        return repo_files


# These are methods that the client for the integration must implement
class RepoTreesClient(ABC):
    @abstractmethod
    def get(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        raise NotImplementedError

    @abstractmethod
    def get_trees_for_org(self) -> dict[str, RepoTree]:
        raise NotImplementedError

    @abstractmethod
    def get_remaining_api_requests(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def get_repositories(
        self, query: str | None = None, fetch_max_pages: bool = False
    ) -> Sequence[Any]:
        raise NotImplementedError


def filter_source_code_files(files: list[str]) -> list[str]:
    """
    This takes the list of files of a repo and returns
    the file paths for supported source code files
    """
    supported_files = []
    # XXX: If we want to make the data structure faster to traverse, we could
    # use a tree where each leaf represents a file while non-leaves would
    # represent a directory in the path
    for file_path in files:
        try:
            extension = get_extension(file_path)
            if extension in SUPPORTED_EXTENSIONS and should_include(file_path):
                supported_files.append(file_path)
        except Exception:
            logger.exception("We've failed to store the file path.")

    return supported_files


def get_extension(file_path: str) -> str:
    extension = ""
    if file_path:
        ext_period = file_path.rfind(".")
        if ext_period >= 1:  # e.g. f.py
            extension = file_path.rsplit(".")[-1]

    return extension


def should_include(file_path: str) -> bool:
    include = True
    if any(file_path.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
        include = False
    if any(file_path.startswith(path) for path in EXCLUDED_PATHS):
        include = False
    return include

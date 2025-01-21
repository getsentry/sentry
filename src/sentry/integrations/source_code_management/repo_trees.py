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
                    repo_and_branch, use_cache, (3600 * 24) + (3600 * (index % 24))
                )
            except ApiError as error:
                if _process_api_error(error):
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
        self, repo_and_branch: RepoAndBranch, only_use_cache: bool, cache_seconds: int
    ) -> RepoTree:
        full_name = repo_and_branch.name
        branch = repo_and_branch.branch
        repo_files = self.get_cached_repo_files(
            full_name, branch, only_use_cache=only_use_cache, cache_seconds=cache_seconds
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
        only_source_code_files: bool = True,
        only_use_cache: bool = False,
        cache_seconds: int = 3600 * 24,
    ) -> list[str]:
        """It return all files for a repo or just source code files.

        repo_full_name: e.g. getsentry/sentry
        tree_sha: A branch or a commit sha
        only_source_code_files: Include all files or just the source code files
        only_use_cache: Do not hit the network but use the value from the cache
            if any. This is useful if the remaining API requests are low
        cache_seconds: How long to cache a value for
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
                cache.set(key, repo_files, cache_seconds)

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


def _process_api_error(error: ApiError) -> bool:
    """
    Determine if the error should be logged and if it should count towards the connection errors tally.
    Raise an error if you want to stop the task.
    """
    error_message = error.json.get("message") if error.json else error.text
    if not error_message:
        return False

    logger.warning(error_message)
    if error_message in (
        "Git Repository is empty.",
        "Not Found",
        "Repository access blocked",
        "Bad credentials",
    ):
        return False
    elif error_message in (
        "Server Error",
        "Bad credentials",
        "Connection reset by peer",
        "Connection broken: invalid chunk length",
        "Unable to reach host:",
    ):
        return True
    elif error_message.startswith("Due to U.S. trade controls"):
        # TODO: We should NOT call the task for this org for a number of days or months
        # Raising the error will cause the task to be handled at the task level
        raise error
    else:
        # We do not raise the exception so we can keep iterating through the repos.
        # Nevertheless, investigate the error to determine if we should abort the processing
        logger.warning("Continuing execution. Investigate: %s", error_message)

    return True


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

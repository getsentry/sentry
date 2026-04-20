from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Sequence
from concurrent.futures import TimeoutError as FutureTimeoutError
from typing import Any, NamedTuple

from sentry.integrations.services.integration import RpcOrganizationIntegration
from sentry.integrations.source_code_management.repository import RepositoryInfo
from sentry.issues.auto_source_code_config.utils.platform import get_supported_extensions
from sentry.shared_integrations.exceptions import ApiConflictError, ApiError, IntegrationError
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)

METRICS_KEY_PREFIX = "integrations.source_code_management"
EXCLUDED_EXTENSIONS = ["spec.jsx"]
EXCLUDED_PATHS = ["tests/"]

# Maximum number of parallel threads for fetching repo trees.
POPULATE_TREES_MAX_WORKERS = 10

# Per-repo timeout (seconds) when fetching from the GitHub API via the proxy.
# A single slow/hung GitHub response will not block the whole task beyond this.
REPO_TREE_FETCH_TIMEOUT_SECONDS = 30


class RepoAndBranch(NamedTuple):
    name: str
    branch: str


class RepoTree(NamedTuple):
    repo: RepoAndBranch
    files: Sequence[str]


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

    # This method must be implemented
    @abstractmethod
    def get_client(self) -> RepoTreesClient:
        """Returns the client for the integration. The client must be a subclass of RepositoryClient."""
        raise NotImplementedError

    @abstractmethod
    def get_repositories(self, query: str | None = None) -> list[RepositoryInfo]:
        raise NotImplementedError

    @property
    def org_integration(self) -> RpcOrganizationIntegration | None:
        raise NotImplementedError

    @property
    def integration_name(self) -> str:
        raise NotImplementedError

    def get_trees_for_org(self) -> dict[str, RepoTree]:
        trees = {}
        with metrics.timer(f"{METRICS_KEY_PREFIX}.populate_repositories.duration"):
            repositories = self._populate_repositories()
        if not repositories:
            logger.warning("Fetching repositories returned an empty list.")
        else:
            with metrics.timer(f"{METRICS_KEY_PREFIX}.populate_trees.duration"):
                trees = self._populate_trees(repositories)

        return trees

    def _populate_repositories(self) -> list[dict[str, str]]:
        if not self.org_integration:
            raise IntegrationError("Organization Integration does not exist")

        cache_key = (
            f"{self.integration_name}trees:repositories:{self.org_integration.organization_id}"
        )
        repositories: list[dict[str, str]] = cache.get(cache_key, [])

        use_cache = True
        if not repositories:
            use_cache = False
            repositories = [
                # Do not use RepoAndBranch so it stores in the cache as a simple dict
                {
                    "full_name": str(repo_info["identifier"]),
                    "default_branch": repo_info.get("default_branch") or "",
                }
                for repo_info in self.get_repositories()
                if not repo_info.get("archived")
            ]

        metrics.incr(
            f"{METRICS_KEY_PREFIX}.populate_repositories",
            tags={"cached": use_cache, "integration": self.integration_name},
        )

        if repositories:
            cache.set(cache_key, repositories, self.CACHE_SECONDS)

        return repositories

    def _populate_trees(self, repositories: Sequence[dict[str, str]]) -> dict[str, RepoTree]:
        """
        For every repository, fetch the tree associated and cache it.
        This function takes API rate limits into consideration to prevent exhaustion.

        Repositories are fetched in parallel using a bounded thread pool so that a
        single slow or hung GitHub response does not stall the entire task.
        """
        trees: dict[str, RepoTree] = {}
        use_cache = False
        connection_error_count = 0

        remaining_requests = MINIMUM_REQUESTS_REMAINING
        try:
            remaining_requests = self.get_client().get_remaining_api_requests()
        except Exception:
            use_cache = True
            # Report so we can investigate
            logger.warning(
                "Loading trees from cache. Execution will continue. Check logs.", exc_info=True
            )

        metrics.incr(
            f"{METRICS_KEY_PREFIX}.populate_trees",
            tags={"cached": use_cache, "integration": self.integration_name},
        )

        # Pre-calculate per-repo arguments serially so that the rate-limit
        # bookkeeping (remaining_requests decrement) stays race-free.
        repo_args: list[tuple[dict[str, str], bool, int]] = []
        for index, repo_info in enumerate(repositories):
            if not use_cache and remaining_requests <= MINIMUM_REQUESTS_REMAINING:
                use_cache = True
            else:
                remaining_requests -= 1
            # Spread cache expiry across the day to avoid a thundering-herd on
            # the next cycle (same logic as the original sequential loop).
            shifted_seconds = 3600 * (index % 24)
            repo_args.append((repo_info, use_cache, shifted_seconds))

        # Submit all tree fetches in parallel, then collect results.
        with ContextPropagatingThreadPoolExecutor(max_workers=POPULATE_TREES_MAX_WORKERS) as pool:
            future_to_repo = {
                pool.submit(
                    self._populate_tree,
                    RepoAndBranch(repo_info["full_name"], repo_info["default_branch"]),
                    repo_use_cache,
                    shifted,
                ): repo_info
                for repo_info, repo_use_cache, shifted in repo_args
            }

            for future, repo_info in future_to_repo.items():
                repo_full_name = repo_info["full_name"]
                extra = {"repo_full_name": repo_full_name}
                try:
                    trees[repo_full_name] = future.result(
                        timeout=REPO_TREE_FETCH_TIMEOUT_SECONDS
                    )
                except FutureTimeoutError:
                    logger.warning(
                        "Timed out fetching tree for repo. Skipping.",
                        extra=extra,
                    )
                except ApiError as error:
                    if self.get_client().should_count_api_error(error, extra):
                        connection_error_count += 1
                except Exception:
                    # Report for investigation but do not stop processing
                    logger.warning(
                        "Failed to populate_tree. Investigate. Contining execution.", extra=extra
                    )

                # Rudimentary circuit breaker: stop hitting the API once we've
                # seen too many connection errors.
                if connection_error_count >= MAX_CONNECTION_ERRORS:
                    logger.warning(
                        "Falling back to the cache because we've hit too many error connections.",
                        extra=extra,
                    )
                    # Cancel any futures that haven't started yet.
                    for remaining_future in future_to_repo:
                        remaining_future.cancel()
                    break

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

    def get_cached_repo_files(
        self,
        repo_full_name: str,
        tree_sha: str,
        shifted_seconds: int,
        only_source_code_files: bool = True,
        only_use_cache: bool = False,
    ) -> list[str]:
        """It returns all files for a repo or just source code files.

        repo_full_name: e.g. getsentry/sentry
        tree_sha: A branch or a commit sha
        only_source_code_files: Include all files or just the source code files
        only_use_cache: Do not hit the network but use the value from the cache
            if any. This is useful if the remaining API requests are low
        """
        key = f"{self.integration_name}:repo:{repo_full_name}:{'source-code' if only_source_code_files else 'all'}"
        cache_hit = cache.has_key(key)
        use_api = not cache_hit and not only_use_cache
        repo_files: list[str] = cache.get(key, [])
        if use_api:
            # Cache miss – fetch from API
            try:
                tree = self.get_client().get_tree(repo_full_name, tree_sha)
            except ApiConflictError:
                # Empty repos return 409 — cache the empty result so we don't
                # keep burning API calls on repos we know have no files.
                logger.info(
                    "Caching empty files result for repo",
                    extra={"repo": repo_full_name},
                )
                cache.set(key, [], self.CACHE_SECONDS + shifted_seconds)
                tree = None
            if tree:
                # Keep files; discard directories
                repo_files = [node["path"] for node in tree if node["type"] == "blob"]
                if only_source_code_files:
                    repo_files = filter_source_code_files(files=repo_files)
                # The backend's caching will skip silently if the object size greater than 5MB
                # (due to Memcached's max value size limit).
                # The trees API does not return structures larger than 7MB
                # As an example, all file paths in Sentry is about 1.3MB
                # Larger customers may have larger repositories, however,
                # the cost of not having the files cached
                # repositories is a single API network request, thus,
                # being acceptable to sometimes not having everything cached
                cache.set(key, repo_files, self.CACHE_SECONDS + shifted_seconds)

            metrics.incr(
                f"{METRICS_KEY_PREFIX}.get_tree",
                tags={"fetched": tree is not None, "integration": self.integration_name},
            )

        metrics.incr(
            f"{METRICS_KEY_PREFIX}.get_repo_files",
            tags={
                "cached": not use_api,
                "only_source_code_files": only_source_code_files,
                "integration": self.integration_name,
            },
        )

        return repo_files


# These are methods that the client for the integration must implement
class RepoTreesClient(ABC):
    @abstractmethod
    def get_remaining_api_requests(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def get_tree(self, repo_full_name: str, tree_sha: str) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def should_count_api_error(self, error: ApiError, extra: dict[str, str]) -> bool:
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
            if should_include(file_path):
                supported_files.append(file_path)
        except Exception:
            logger.warning("We've failed to store the file path.")

    return supported_files


def get_extension(file_path: str) -> str:
    extension = ""
    if file_path:
        ext_period = file_path.rfind(".")
        if ext_period >= 1:  # e.g. f.py
            extension = file_path.rsplit(".")[-1]

    return extension


def should_include(file_path: str) -> bool:
    extension = get_extension(file_path)
    if extension not in get_supported_extensions():
        return False
    if any(file_path.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
        return False
    if any(file_path.startswith(path) for path in EXCLUDED_PATHS):
        return False
    return True

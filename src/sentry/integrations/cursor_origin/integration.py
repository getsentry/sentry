from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote, unquote, urlparse

from sentry.integrations.cursor_origin.client import CursorOriginApiClient
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.source_code_management.repo_trees import RepoTreesIntegration
from sentry.integrations.source_code_management.repository import (
    HaltReason,
    RepositoryInfo,
    RepositoryIntegration,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError, ApiPaginationTruncated

logger = logging.getLogger("sentry.integrations.cursor_origin")


class CursorOriginIntegration(RepositoryIntegration[CursorOriginApiClient], RepoTreesIntegration):
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return IntegrationProviderSlug.CURSOR_ORIGIN.value

    @property
    def repo_search(self) -> bool:
        return False

    def get_client(self) -> CursorOriginApiClient:
        return CursorOriginApiClient(
            integration=self.model, org_integration_id=self.org_integration.id
        )

    def get_repo_external_id(self, repo: Mapping[str, Any]) -> str:
        return str(repo["id"])

    def get_repositories(
        self,
        query: str | None = None,
        page_number_limit: int | None = None,
        accessible_only: bool = False,
        use_cache: bool = False,
        raise_on_page_limit: bool = False,
        parallel: bool = False,
    ) -> list[RepositoryInfo]:
        """Repositories this installation can see.

        The remaining keyword arguments exist for base-class compatibility. Origin has no
        search endpoint, so `query` filters locally.
        """

        def to_repository_info(raw: list[dict[str, Any]]) -> list[RepositoryInfo]:
            return [
                {
                    "name": repo["fullName"],
                    "identifier": repo["fullName"],
                    "external_id": self.get_repo_external_id(repo),
                    "default_branch": repo["defaultBranch"],
                }
                for repo in raw
            ]

        try:
            raw_repos = self.get_client().get_repositories()
        except ApiPaginationTruncated as e:
            if raise_on_page_limit:
                raise ApiPaginationTruncated(to_repository_info(e.partial_data)) from e
            raw_repos = e.partial_data
        except ApiError as e:
            logger.info("cursor_origin.get_repositories.error", extra={"error": str(e)})
            self.raise_error(e)

        repos = to_repository_info(raw_repos)

        if query:
            lowered = query.lower()
            repos = [repo for repo in repos if lowered in repo["name"].lower()]

        return repos

    def has_repo_access(self, repo: RpcRepository) -> bool:
        try:
            self.get_client().get_repo(repo.name)
        except ApiError:
            return False
        return True

    def is_rate_limited_error(self, exc: ApiError) -> bool:
        return exc.code == 429

    def is_broken_integration_error(self, exc: Exception) -> HaltReason | None:
        if isinstance(exc, ApiError) and exc.url and "access_tokens" in exc.url:
            if self.is_rate_limited_error(exc):
                return "rate_limited"
            if exc.code in (401, 403, 404):
                return "installation_suspended"

        return super().is_broken_integration_error(exc)

    def source_url_matches(self, url: str) -> bool:
        domain = self.model.metadata["domain_name"]
        return url == domain or url.startswith(f"{domain}/")

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        branch = branch or repo.config["default_branch"]
        return (
            f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/blob/"
            f"{quote(branch, safe='')}/{quote(filepath)}"
        )

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        return unquote(self._split_blob_url(repo, url)[0])

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        return unquote(self._split_blob_url(repo, url)[1])

    def _split_blob_url(self, repo: Repository, url: str) -> tuple[str, str]:
        prefix = f"{urlparse(CURSOR_ORIGIN_WEB_BASE_URL).path}/{repo.name}/blob/"
        path = urlparse(url).path
        if not path.startswith(prefix):
            return "", ""
        branch, _, filepath = path[len(prefix) :].partition("/")
        return branch, filepath

from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.cursor_origin.integration import CursorOriginIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

logger = logging.getLogger("sentry.integrations.cursor_origin")


class CursorOriginRepositoryProvider(IntegrationRepositoryProvider[CursorOriginIntegration]):
    name = "Cursor Origin"
    repo_provider = IntegrationProviderSlug.CURSOR_ORIGIN.value

    def get_repository_data(
        self, organization: Organization, config: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        installation = self.get_installation(config.get("installation"), organization.id)

        repo_name = config["identifier"]
        try:
            repo = installation.get_client().get_repo(repo_name)
        except ApiError as e:
            raise IntegrationError(f"Could not read {repo_name} from Cursor Origin: {e}")

        config["external_id"] = str(repo["id"])
        config["name"] = repo["fullName"]
        config["default_branch"] = repo["defaultBranch"]
        config["integration_id"] = installation.model.id
        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        name = data["name"]
        return {
            "name": name,
            "external_id": data["external_id"],
            "url": f"{CURSOR_ORIGIN_WEB_BASE_URL}/{name}",
            "config": {"name": name, "default_branch": data["default_branch"]},
            "integration_id": data["integration_id"],
        }

    def repository_external_slug(self, repo: Repository) -> str:
        return repo.name

    def compare_commits(
        self, repo: Repository, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        # Origin does expose List Commits and Compare Commits, but wiring release commit
        # tracking to them is its own change. Raising rather than returning [] keeps this
        # visible in Sentry's own errors: an empty list is indistinguishable from a
        # repository that genuinely has no new commits.
        raise NotImplementedError("Cursor Origin commit tracking is not implemented yet")

    def pull_request_url(self, repo: Repository, pull_request: PullRequest) -> str:
        return f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/pull/{pull_request.key}"

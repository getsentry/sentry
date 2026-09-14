from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.cursor_origin.integration import CursorOriginIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

logger = logging.getLogger(__name__)


class CursorOriginRepositoryProvider(IntegrationRepositoryProvider[CursorOriginIntegration]):
    name = "Cursor Origin"
    repo_provider = "cursor_origin"

    def get_repository_data(
        self, organization: Organization, config: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        installation = self.get_installation(config.get("installation"), organization.id)

        # `identifier` is the fullName ("owner/repo") chosen in the repo picker.
        repo_name = config["identifier"]
        try:
            repo = installation.get_client().get_repo(repo_name)
        except ApiError as e:
            raise IntegrationError(f"Could not read {repo_name} from Cursor Origin: {e}")

        config["external_id"] = str(repo["id"])
        config["name"] = repo["fullName"]
        config["default_branch"] = repo.get("defaultBranch")
        # build_repository_config reads this back out; without it repo creation
        # fails with a bare KeyError after the API calls have already succeeded.
        config["integration_id"] = installation.model.id
        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        # Two callers with different shapes reach this. The repo picker goes through
        # get_repository_data, which sets "name" from the API's fullName. link_all_repos
        # -- scheduled by post_install -- instead calls this directly with only
        # {external_id, integration_id, identifier} from get_repo_config, so "name" is
        # absent and a bare data["name"] raised KeyError for every repository on every
        # install. Prefer the canonical name where we have it, fall back to the
        # identifier, which holds the same "owner/repo" fullName.
        # GitHub reads "identifier" for this reason; GitLab reads "name" and gets away
        # with it only because nothing bulk-links its repositories.
        name = data.get("name") or data["identifier"]
        return {
            "name": name,
            "external_id": data["external_id"],
            "url": f"{CURSOR_ORIGIN_WEB_BASE_URL}/{name}",
            "config": {
                "name": name,
                "default_branch": data.get("default_branch"),
            },
            "integration_id": data["integration_id"],
        }

    def repository_external_slug(self, repo: Repository) -> str:
        return repo.name

    def compare_commits(
        self, repo: Repository, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        """Not implemented yet -- commit tracking arrives with webhook support."""
        return []

    def pull_request_url(self, repo: Repository, pull_request: Any) -> str:
        return f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/pulls/{pull_request.key}"

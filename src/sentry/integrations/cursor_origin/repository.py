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

# A first release has no previous sha to compare against, so associate a recent
# slice of history rather than walking back forever.
RECENT_COMMIT_LIMIT = 20

# Each commit in the range costs an extra request for its changed files, since
# Origin has no endpoint giving files across a range. Bound the work.
MAX_COMPARE_COMMITS = 100


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
        """Commits to associate with a release.

        No start sha means this is the first release for the repository, so fall
        back to recent history rather than walking to the beginning of time.
        """
        installation = self._installation_for(repo)
        client = installation.get_client()
        # config["name"] is the one kept in sync, matching how GitHub does it.
        name = repo.config.get("name") or repo.name

        try:
            if start_sha is None:
                commits = client.get_commits(name, sha=end_sha, limit=RECENT_COMMIT_LIMIT)
            else:
                commits = client.compare_commits(
                    name, start_sha, end_sha, limit=MAX_COMPARE_COMMITS
                )
            return self._format_commits(client, name, commits)
        except Exception as e:
            installation.raise_error(e)

    def _installation_for(self, repo: Repository) -> CursorOriginIntegration:
        if repo.integration_id is None:
            raise IntegrationError("Cursor Origin repositories require an integration id.")
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        assert isinstance(installation, CursorOriginIntegration)
        return installation

    def _format_commits(
        self, client: Any, repo_name: str, commits: Sequence[Mapping[str, Any]]
    ) -> Sequence[Mapping[str, Any]]:
        """Convert Origin commits into Sentry's internal shape.

        Origin's commit payload matches GitHub's, but the changed files live on a
        separate route, so each commit costs one extra request. See
        sentry.models.Release.set_commits.
        """
        return [
            {
                "id": commit["sha"],
                "repository": repo_name,
                "author_email": commit["commit"]["author"].get("email"),
                "author_name": commit["commit"]["author"].get("name"),
                "message": commit["commit"]["message"],
                "timestamp": self.format_date(commit["commit"]["author"].get("date")),
                "patch_set": self._transform_patchset(
                    client.get_commit_files(repo_name, commit["sha"])
                ),
            }
            for commit in commits
        ]

    def _transform_patchset(
        self, files: Sequence[Mapping[str, Any]]
    ) -> Sequence[Mapping[str, Any]]:
        changes: list[dict[str, str]] = []
        for change in files:
            status = change.get("status")
            filename = change.get("filename")
            if not filename:
                continue
            if status == "modified":
                changes.append({"path": filename, "type": "M"})
            elif status == "added":
                changes.append({"path": filename, "type": "A"})
            elif status == "removed":
                changes.append({"path": filename, "type": "D"})
            elif status == "renamed":
                # A rename is recorded as a delete plus an add.
                if previous := change.get("previous_filename"):
                    changes.append({"path": previous, "type": "D"})
                changes.append({"path": filename, "type": "A"})
        return changes

    def pull_request_url(self, repo: Repository, pull_request: Any) -> str:
        # `/pull/{n}`, not `/pulls/` -- confirmed against Origin's web UI. The
        # REST route is `/pulls`, which makes this easy to get wrong.
        return f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/pull/{pull_request.key}"

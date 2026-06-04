from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

if TYPE_CHECKING:
    from sentry.integrations.github.integration import GitHubIntegration  # NOQA

WEBHOOK_EVENTS = ["push", "pull_request"]
MAX_COMPARE_COMMITS_OPTION_KEY = "github-app.fetch-commits.max-compare-commits"
logger = logging.getLogger(__name__)


class GitHubRepositoryProvider(IntegrationRepositoryProvider["GitHubIntegration"]):
    name = "GitHub"
    repo_provider = IntegrationProviderSlug.GITHUB.value

    def _validate_repo(self, client: Any, installation: IntegrationInstallation, repo: str) -> Any:
        try:
            repo_data = client.get_repo(repo)
        except Exception as e:
            raise installation.raise_error(e)

        try:
            # make sure installation has access to this specific repo
            # use hooks endpoint since we explicitly ask for those permissions
            # when installing the app (commits can be accessed for public repos)
            # https://docs.github.com/en/rest/webhooks/repo-config#list-hooks
            client.repo_hooks(repo)
        except ApiError:
            raise IntegrationError(f"You must grant Sentry access to {repo}")

        return repo_data

    def get_repository_data(
        self, organization: Organization, config: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()

        repo = self._validate_repo(client, installation, config["identifier"])
        config["external_id"] = installation.get_repo_external_id(repo)
        config["integration_id"] = installation.model.id

        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        return {
            "name": data["identifier"],
            "external_id": data["external_id"],
            "url": "https://github.com/{}".format(data["identifier"]),
            "config": {"name": data["identifier"]},
            "integration_id": data["integration_id"],
        }

    def _get_installation_and_client(self, repo: Repository) -> tuple[IntegrationInstallation, Any]:
        integration_id = repo.integration_id
        if integration_id is None:
            raise NotImplementedError("GitHub apps requires an integration id to fetch commits")
        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if integration is None:
            raise NotImplementedError(
                "GitHub apps requires a valid active integration to fetch commits"
            )

        installation = integration.get_installation(organization_id=repo.organization_id)
        return installation, installation.get_client()

    def fetch_recent_commits(
        self, repo: Repository, end_sha: str, *, actor: Any | None = None
    ) -> Sequence[Mapping[str, Any]]:
        installation, client = self._get_installation_and_client(repo)
        # use config name because that is kept in sync via webhooks
        name = repo.config["name"]

        try:
            commits = client.get_last_commits(name, end_sha, per_page=20)
            return self._format_commits(client, name, commits)
        except Exception as e:
            installation.raise_error(e)

    def fetch_commits_for_compare_range(
        self,
        repo: Repository,
        start_sha: str,
        end_sha: str,
        *,
        actor: Any | None = None,
    ) -> Sequence[Mapping[str, Any]]:
        installation, client = self._get_installation_and_client(repo)
        # use config name because that is kept in sync via webhooks
        name = repo.config["name"]

        try:
            commits = client.compare_commits(name, start_sha, end_sha)
            max_compare_commits = options.get(MAX_COMPARE_COMMITS_OPTION_KEY)
            if max_compare_commits and len(commits) > max_compare_commits:
                logger.info(
                    "fetch_commits.truncated",
                    extra={
                        "organization_id": repo.organization_id,
                        "repository": repo.name,
                        "start_sha": start_sha,
                        "end_sha": end_sha,
                        "original_count": len(commits),
                        "truncated_count": max_compare_commits,
                    },
                )
                commits = commits[-max_compare_commits:]
            return self._format_commits(client, name, commits)
        except Exception as e:
            installation.raise_error(e)

    def compare_commits(
        self, repo: Repository, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        if start_sha is None:
            return self.fetch_recent_commits(repo, end_sha)
        return self.fetch_commits_for_compare_range(repo, start_sha, end_sha)

    def _format_commits(
        self,
        client: Any,
        repo_name: str,
        commit_list: Any,
    ) -> Sequence[Mapping[str, Any]]:
        """Convert GitHub commits into our internal format

        For each commit in the list we have to fetch patch data, as the
        compare API gives us all of the files changed in the commit
        range but not which files changed in each commit. Without this
        we cannot know which specific commit changed a given file.

        See sentry.models.Release.set_commits
        """
        return [
            {
                "id": c["sha"],
                "repository": repo_name,
                "author_email": c["commit"]["author"].get("email"),
                "author_name": c["commit"]["author"].get("name"),
                "message": c["commit"]["message"],
                "timestamp": self.format_date(c["commit"]["author"].get("date")),
                "patch_set": self._get_patchset(client, repo_name, c["sha"]),
            }
            for c in commit_list
        ]

    def _get_patchset(self, client: Any, repo_name: str, sha: str) -> Sequence[Mapping[str, Any]]:
        """Get the modified files for a commit"""
        commit = client.get_commit(repo_name, sha)
        return self._transform_patchset(commit["files"])

    def _transform_patchset(self, diff: Sequence[Mapping[str, Any]]) -> Sequence[Mapping[str, Any]]:
        """Convert the patch data from GitHub into our internal format

        See sentry.models.Release.set_commits
        """
        changes = []
        for change in diff:
            if change["status"] == "modified":
                changes.append({"path": change["filename"], "type": "M"})
            if change["status"] == "added":
                changes.append({"path": change["filename"], "type": "A"})
            if change["status"] == "removed":
                changes.append({"path": change["filename"], "type": "D"})
            if change["status"] == "renamed":
                changes.append({"path": change["previous_filename"], "type": "D"})
                changes.append({"path": change["filename"], "type": "A"})
        return changes

    def pull_request_url(self, repo: Repository, pull_request: PullRequest) -> str:
        return f"{repo.url}/pull/{pull_request.key}"

    def repository_external_slug(self, repo: Repository) -> str:
        return repo.name

from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.utils import timezone

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.client import (
    CursorOriginApiClient,
    OriginCommit,
    OriginCommitFile,
)
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.cursor_origin.integration import CursorOriginIntegration
from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import (
    CommitData,
    CommitPatchFile,
    RepositoryConfig,
)
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

logger = logging.getLogger("sentry.integrations.cursor_origin")

MAX_COMPARE_COMMITS_OPTION_KEY = "cursor-origin-app.fetch-commits.max-compare-commits"
RECENT_COMMIT_COUNT = 20


def active_repositories(
    external_id: str, org_integrations: Sequence[RpcOrganizationIntegration]
) -> Sequence[Repository]:
    return list(
        Repository.objects.filter(
            organization_id__in=[oi.organization_id for oi in org_integrations],
            provider=f"integrations:{IntegrationProviderSlug.CURSOR_ORIGIN.value}",
            external_id=external_id,
            status=ObjectStatus.ACTIVE,
        )
    )


def file_changes_from(files: Sequence[OriginCommitFile]) -> list[CommitPatchFile]:
    """Origin's file statuses as Sentry's change types."""
    changes: list[CommitPatchFile] = []
    for file in files:
        status = file["status"]
        if status == "modified":
            changes.append({"path": file["filename"], "type": "M"})
        elif status in ("added", "copied"):
            changes.append({"path": file["filename"], "type": "A"})
        elif status == "removed":
            changes.append({"path": file["filename"], "type": "D"})
        elif status == "renamed":
            changes.append({"path": file["previousFilename"], "type": "D"})
            changes.append({"path": file["filename"], "type": "A"})
    return changes


class CursorOriginRepositoryProvider(IntegrationRepositoryProvider[CursorOriginIntegration]):
    name = "Cursor Origin"
    repo_provider = IntegrationProviderSlug.CURSOR_ORIGIN.value
    can_transfer_repositories = True

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
    ) -> Sequence[CommitData]:
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        name = repo.config["name"]

        try:
            if start_sha is None:
                commits = client.get_commits(name, sha=end_sha, limit=RECENT_COMMIT_COUNT)
            else:
                commits = self._commits_in_range(client, repo, name, start_sha, end_sha)
            return [self._format_commit(client, name, commit) for commit in reversed(commits)]
        except Exception as e:
            installation.raise_error(e)

    def _commits_in_range(
        self,
        client: CursorOriginApiClient,
        repo: Repository,
        name: str,
        start_sha: str,
        end_sha: str,
    ) -> list[OriginCommit]:
        """Return commits in the range, newest first"""
        comparison = client.compare_commits(name, start_sha, end_sha)
        ahead_by = comparison["aheadBy"]
        if ahead_by <= 0:
            return []

        max_commits = options.get(MAX_COMPARE_COMMITS_OPTION_KEY)
        if max_commits and ahead_by > max_commits:
            logger.info(
                "cursor_origin.fetch_commits.truncated",
                extra={
                    "organization_id": repo.organization_id,
                    "repository": repo.name,
                    "start_sha": start_sha,
                    "end_sha": end_sha,
                    "ahead_by": ahead_by,
                    "truncated_count": max_commits,
                },
            )
            ahead_by = max_commits

        return client.get_commits(name, sha=end_sha, limit=ahead_by)

    def _format_commit(
        self, client: CursorOriginApiClient, name: str, commit: OriginCommit
    ) -> CommitData:
        author = commit["commit"]["author"]
        return {
            "id": commit["sha"],
            "repository": name,
            "author_email": author["email"],
            "author_name": author["name"][:128],
            "message": commit["commit"]["message"],
            # `format_date` gives None for an empty date, and `set_commits` sorts on this.
            "timestamp": self.format_date(author["date"]) or timezone.now(),
            "patch_set": self._patch_set(client.get_commit_files(name, commit["sha"])),
        }

    def _patch_set(self, files: Sequence[OriginCommitFile]) -> list[CommitPatchFile]:
        """File changes in the shape `Release.set_commits` expects."""
        return file_changes_from(files)

    def pull_request_url(self, repo: Repository, pull_request: PullRequest) -> str:
        return f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/pull/{pull_request.key}"

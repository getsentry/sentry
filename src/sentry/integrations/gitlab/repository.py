from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict, cast

from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import CommitPatchFile, RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError

if TYPE_CHECKING:
    from sentry.integrations.gitlab.client import GitLabApiClient
    from sentry.integrations.gitlab.integration import GitlabIntegration  # NOQA

logger = logging.getLogger("sentry.integrations.gitlab")


class GitLabProject(TypedDict):
    id: str | int
    path_with_namespace: str
    name_with_namespace: str
    web_url: str


class GitLabRepositorySetupConfig(TypedDict):
    installation: int
    identifier: str | int


class GitLabCommit(TypedDict):
    id: str
    author_email: str
    author_name: str
    title: str
    created_at: str
    message: NotRequired[str | None]


class GitLabDiff(TypedDict):
    old_path: str
    new_path: str
    new_file: bool
    deleted_file: bool
    renamed_file: bool


class GitLabCommitData(TypedDict):
    id: str
    repository: str
    author_email: str
    author_name: str
    message: str
    timestamp: datetime | None
    patch_set: list[CommitPatchFile]


class GitlabRepositoryProvider(IntegrationRepositoryProvider["GitlabIntegration"]):
    name = "Gitlab"
    repo_provider = IntegrationProviderSlug.GITLAB.value

    def get_repository_data(
        self, organization: Organization, config: MutableMapping[str, object]
    ) -> MutableMapping[str, object]:
        # justification: repository setup config is validated by the provider.
        setup_config = cast(GitLabRepositorySetupConfig, config)
        installation = self.get_installation(setup_config["installation"], organization.id)
        client = installation.get_client()

        repo_id = setup_config["identifier"]
        # justification: integration metadata is written by the install pipeline.
        instance = cast(str, installation.model.metadata["instance"])

        try:
            # justification: GitLab project responses carry these keys.
            project = cast(GitLabProject, client.get_project(repo_id))
        except Exception as e:
            raise installation.raise_error(e)
        config.update(
            {
                "instance": instance,
                "path": project["path_with_namespace"],
                "name": project["name_with_namespace"],
                "external_id": installation.get_repo_external_id(project),
                "project_id": project["id"],
                "url": project["web_url"],
            }
        )
        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        return {
            "name": data["name"],
            "external_id": data["external_id"],
            "url": data["url"],
            "config": {
                "instance": data["instance"],
                "path": data["path"],
                "project_id": data["project_id"],
            },
            "integration_id": data["installation"],
        }

    def on_create_repository(self, repo: RpcRepository, organization: RpcOrganization) -> None:
        # Namespaced under "gitlab.repository." so these attributes group together in the
        # Sentry Logs UI.
        log_extra = {
            "gitlab.repository.organization_id": repo.organization_id,
            "gitlab.repository.integration_id": repo.integration_id,
            "gitlab.repository.repository_id": repo.id,
            "gitlab.repository.project_id": repo.config["project_id"],
        }
        # Emitted on every invocation so we can gauge how often this path runs
        # (and therefore how many webhook create calls we make to GitLab).
        logger.info(
            "gitlab.repository.on_create_repository",
            extra={
                **log_extra,
                "gitlab.repository.has_existing_webhook": bool(repo.config.get("webhook_id")),
            },
        )
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        project_id = repo.config["project_id"]
        existing_webhook_id = repo.config.get("webhook_id")
        try:
            hook_id = client.ensure_project_webhook(project_id, existing_webhook_id)
        except Exception as e:
            raise installation.raise_error(e)
        if hook_id != existing_webhook_id:
            if not repository_service.update_repository_config(
                organization_id=organization.id,
                id=repo.id,
                config_updates={"webhook_id": hook_id},
                expected_integration_id=repo.integration_id,
                expected_config={"webhook_id": existing_webhook_id},
            ):
                # The repository changed while we talked to GitLab, so nothing would
                # ever reference or delete the new hook.
                logger.info(
                    "gitlab.repository.webhook_discarded",
                    extra={**log_extra, "gitlab.repository.webhook_id": hook_id},
                )
                # The repository itself was linked fine, so a failed cleanup only leaves the
                # hook orphaned; raising would report the link as failed.
                try:
                    client.delete_project_webhook(project_id, hook_id)
                except ApiError as e:
                    if e.code != 404:
                        logger.warning(
                            "gitlab.repository.webhook_discard_failed",
                            extra={
                                **log_extra,
                                "gitlab.repository.webhook_id": hook_id,
                                "gitlab.repository.status_code": e.code,
                            },
                        )
                return
            repo.config["webhook_id"] = hook_id
            event = (
                "gitlab.repository.webhook_recreated"
                if existing_webhook_id
                else "gitlab.repository.webhook_created"
            )
        else:
            event = "gitlab.repository.webhook_updated"
        logger.info(event, extra={**log_extra, "gitlab.repository.webhook_id": hook_id})

    def on_delete_repository(self, repo: Repository) -> None:
        """Clean up the attached webhook"""
        webhook_id = repo.config.get("webhook_id")
        # A repository whose hook creation failed has no webhook_id. There is no hook to
        # clean up then, and raising would only stop the user from deleting the repository.
        if not webhook_id:
            return
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        try:
            client.delete_project_webhook(repo.config["project_id"], webhook_id)
        except ApiError as e:
            if e.code == 404:
                return
            raise installation.raise_error(e)

    def compare_commits(
        self, repo: Repository, start_sha: str | None, end_sha: str
    ) -> list[GitLabCommitData]:
        """Fetch the commit list and diffed files between two SHAs"""
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        try:
            if start_sha is None:
                # justification: GitLab commit list responses are JSON arrays.
                commits = cast(
                    Sequence[GitLabCommit],
                    client.get_last_commits(repo.config["project_id"], end_sha),
                )
                return self._format_commits(client, repo, commits)
            else:
                # justification: GitLab comparison responses are JSON objects.
                comparison = cast(
                    Mapping[str, object],
                    client.compare_commits(repo.config["project_id"], start_sha, end_sha),
                )
                # justification: GitLab comparison commits are JSON arrays.
                commits = cast(Sequence[GitLabCommit], comparison["commits"])
                return self._format_commits(client, repo, commits)
        except Exception as e:
            raise installation.raise_error(e)

    def _format_commits(
        self,
        client: GitLabApiClient,
        repo: Repository,
        commit_list: Sequence[GitLabCommit],
    ) -> list[GitLabCommitData]:
        """Convert GitLab commits into our internal format"""
        return [
            {
                "id": c["id"],
                "repository": repo.name,
                "author_email": c["author_email"],
                "author_name": c["author_name"],
                "message": c.get("message") or c["title"],
                "timestamp": self.format_date(c["created_at"]),
                "patch_set": self._get_patchset(client, repo, c["id"]),
            }
            for c in commit_list
        ]

    def _get_patchset(
        self, client: GitLabApiClient, repo: Repository, sha: str
    ) -> list[CommitPatchFile]:
        """GitLab commit lists don't come with diffs so we have
        to make additional round trips.
        """
        # justification: GitLab diff responses are JSON arrays.
        diffs = cast(Sequence[GitLabDiff], client.get_diff(repo.config["project_id"], sha))
        return self._transform_patchset(diffs)

    def _transform_patchset(self, patch_set: Sequence[GitLabDiff]) -> list[CommitPatchFile]:
        file_changes: list[CommitPatchFile] = []
        for changed_file in patch_set:
            if changed_file["new_file"]:
                file_changes.append({"path": changed_file["new_path"], "type": "A"})
            elif changed_file["deleted_file"]:
                file_changes.append({"path": changed_file["old_path"], "type": "D"})
            elif changed_file["renamed_file"]:
                file_changes.append({"path": changed_file["old_path"], "type": "D"})
                file_changes.append({"path": changed_file["new_path"], "type": "A"})
            else:
                file_changes.append({"path": changed_file["new_path"], "type": "M"})

        return file_changes

    def pull_request_url(self, repo: Repository, pull_request: PullRequest) -> str:
        return f"{repo.url}/merge_requests/{pull_request.key}"

    def repository_external_slug(self, repo: Repository) -> str | None:
        project_id: str | None = repo.config["project_id"]
        return project_id

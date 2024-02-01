from __future__ import annotations

from typing import Any, Mapping, MutableMapping, Sequence

from sentry.integrations import IntegrationInstallation
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.organization.model import RpcOrganization
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.json import JSONData

WEBHOOK_EVENTS = ["push", "pull_request"]


class GitHubRepositoryProvider(IntegrationRepositoryProvider):
    name = "GitHub"
    repo_provider = "github"

    def _validate_repo(
        self, client: Any, installation: IntegrationInstallation, repo: str
    ) -> JSONData:
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
    ) -> Mapping[str, Any]:
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()

        repo = self._validate_repo(client, installation, config["identifier"])
        config["external_id"] = str(repo["id"])
        config["integration_id"] = installation.model.id

        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> Mapping[str, Any]:
        return {
            "name": data["identifier"],
            "external_id": data["external_id"],
            "url": "https://github.com/{}".format(data["identifier"]),
            "config": {"name": data["identifier"]},
            "integration_id": data["integration_id"],
        }

    def compare_commits(
        self, repo: Repository, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        def eval_commits(client: Any) -> Sequence[Mapping[str, Any]]:
            # use config name because that is kept in sync via webhooks
            name = repo.config["name"]
            if start_sha is None:
                res = client.get_last_commits(name, end_sha)
                return self._format_commits(client, name, res[:20])
            else:
                res = client.compare_commits(name, start_sha, end_sha)
                return self._format_commits(client, name, res["commits"])

        integration_id = repo.integration_id
        if integration_id is None:
            raise NotImplementedError("GitHub apps requires an integration id to fetch commits")
        integration = integration_service.get_integration(integration_id=integration_id)
        installation = integration.get_installation(organization_id=repo.organization_id)
        client = installation.get_client()

        try:
            return eval_commits(client)
        except Exception as e:
            installation.raise_error(e)
            return []

    def _format_commits(
        self,
        client: Any,
        repo_name: str,
        commit_list: JSONData,
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

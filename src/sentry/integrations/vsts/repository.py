import logging
from typing import Any, Mapping, MutableMapping, Optional, Sequence

from sentry.integrations import IntegrationInstallation
from sentry.models import Commit, Integration, Organization, Repository
from sentry.plugins import providers
from sentry.shared_integrations.exceptions import IntegrationError

MAX_COMMIT_DATA_REQUESTS = 90


class VstsRepositoryProvider(providers.IntegrationRepositoryProvider):  # type: ignore
    name = "Azure DevOps"
    logger = logging.getLogger("sentry.integrations.vsts")

    def get_installation(
        self, integration_id: Optional[int], organization_id: int
    ) -> IntegrationInstallation:
        if integration_id is None:
            raise IntegrationError(f"{self.name} requires an integration id.")

        integration_model = Integration.objects.get(
            id=integration_id, organizations=organization_id, provider="vsts"
        )

        # Explicitly typing to satisfy mypy.
        installation: IntegrationInstallation = integration_model.get_installation(organization_id)
        return installation

    def get_repository_data(
        self, organization: Organization, config: MutableMapping[str, Any]
    ) -> Mapping[str, str]:
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()
        instance = installation.instance

        repo_id = config["identifier"]

        try:
            repo = client.get_repo(instance, repo_id)
        except Exception as e:
            installation.raise_error(e)
        config.update(
            {
                "instance": instance,
                "project": repo["project"]["name"],
                "name": repo["name"],
                "external_id": str(repo["id"]),
                "url": repo["_links"]["web"]["href"],
            }
        )
        return config

    def build_repository_config(
        self, organization: Organization, data: Mapping[str, str]
    ) -> Mapping[str, Any]:
        return {
            "name": data["name"],
            "external_id": data["external_id"],
            "url": data["url"],
            "config": {
                "instance": data["instance"],
                "project": data["project"],
                "name": data["name"],
            },
            "integration_id": data["installation"],
        }

    def transform_changes(
        self, patch_set: Sequence[Mapping[str, Any]]
    ) -> Sequence[Mapping[str, str]]:
        type_mapping = {"add": "A", "delete": "D", "edit": "M"}
        file_changes = []
        # https://docs.microsoft.com/en-us/rest/api/vsts/git/commits/get%20changes#versioncontrolchangetype
        for change in patch_set:
            change_type = type_mapping.get(change["changeType"])

            if change_type and change.get("item") and change["item"]["gitObjectType"] == "blob":
                file_changes.append({"path": change["item"]["path"], "type": change_type})

        return file_changes

    def zip_commit_data(
        self, repo: Repository, commit_list: Sequence[Commit], organization_id: int
    ) -> Sequence[Commit]:
        installation = self.get_installation(repo.integration_id, organization_id)
        client = installation.get_client()
        n = 0
        for commit in commit_list:
            # Azure will truncate commit comments to only the first line.
            # We need to make an additional API call to get the full commit message.
            # This is important because issue refs could be anywhere in the commit
            # message.
            if commit.get("commentTruncated", False):
                full_commit = client.get_commit(
                    repo.config["instance"], repo.external_id, commit["commitId"]
                )
                commit["comment"] = full_commit["comment"]

            commit["patch_set"] = self.transform_changes(
                client.get_commit_filechanges(
                    repo.config["instance"], repo.external_id, commit["commitId"]
                )
            )
            # We only fetch patch data for 90 commits.
            n += 1
            if n > MAX_COMMIT_DATA_REQUESTS:
                break

        return commit_list

    def compare_commits(
        self, repo: Repository, start_sha: Optional[str], end_sha: str
    ) -> Sequence[Mapping[str, str]]:
        """TODO(mgaeta): This function is kinda a mess."""
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        instance = repo.config["instance"]

        try:
            if start_sha is None:
                res = client.get_commits(instance, repo.external_id, commit=end_sha, limit=10)
            else:
                res = client.get_commit_range(instance, repo.external_id, start_sha, end_sha)
        except Exception as e:
            installation.raise_error(e)

        commits = self.zip_commit_data(repo, res["value"], repo.organization_id)
        return self._format_commits(repo, commits)

    def _format_commits(
        self, repo: Repository, commit_list: Sequence[Mapping[str, Any]]
    ) -> Sequence[Mapping[str, Any]]:
        return [
            {
                "id": c["commitId"],
                "repository": repo.name,
                "author_email": c["author"]["email"],
                "author_name": c["author"]["name"],
                "message": c["comment"],
                "patch_set": c.get("patch_set"),
                "timestamp": self.format_date(c["author"]["date"]),
            }
            for c in commit_list
        ]

    def repository_external_slug(self, repo: Repository) -> str:
        # Explicitly typing to satisfy mypy.
        external_id: str = repo.external_id
        return external_id

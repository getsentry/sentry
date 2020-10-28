from __future__ import absolute_import

import logging
import six

from sentry.plugins import providers
from sentry.models import Integration
from sentry.shared_integrations.exceptions import IntegrationError

MAX_COMMIT_DATA_REQUESTS = 90


class VstsRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = "Azure DevOps"
    logger = logging.getLogger("sentry.integrations.vsts")

    def get_installation(self, integration_id, organization_id):
        if integration_id is None:
            raise IntegrationError("%s requires an integration id." % self.name)

        integration_model = Integration.objects.get(
            id=integration_id, organizations=organization_id, provider="vsts"
        )

        return integration_model.get_installation(organization_id)

    def get_repository_data(self, organization, config):
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
                "external_id": six.text_type(repo["id"]),
                "url": repo["_links"]["web"]["href"],
            }
        )
        return config

    def build_repository_config(self, organization, data):
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

    def transform_changes(self, patch_set):
        type_mapping = {"add": "A", "delete": "D", "edit": "M"}
        file_changes = []
        # https://docs.microsoft.com/en-us/rest/api/vsts/git/commits/get%20changes#versioncontrolchangetype
        for change in patch_set:
            change_type = type_mapping.get(change["changeType"])

            if change_type and change.get("item") and change["item"]["gitObjectType"] == "blob":
                file_changes.append({"path": change["item"]["path"], "type": change_type})

        return file_changes

    def zip_commit_data(self, repo, commit_list, organization_id):
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

    def compare_commits(self, repo, start_sha, end_sha):
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

    def _format_commits(self, repo, commit_list):
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

    def repository_external_slug(self, repo):
        return repo.external_id

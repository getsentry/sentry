import logging
from datetime import datetime

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone

from sentry.models.integration import Integration
from sentry.plugins.providers.integration_repository import IntegrationRepositoryProvider
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.hashlib import md5_text
from sentry.utils.http import absolute_uri


class BitbucketServerRepositoryProvider(IntegrationRepositoryProvider):
    name = "Bitbucket Server"
    logger = logging.getLogger("sentry.integrations.bitbucket_server")

    def get_installation(self, integration_id, organization_id):
        if integration_id is None:
            raise IntegrationError("Bitbucket Server requires an integration id.")
        integration_model = Integration.objects.get(
            id=integration_id, organizations=organization_id, provider="bitbucket_server"
        )

        return integration_model.get_installation(organization_id)

    def get_repository_data(self, organization, config):
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()
        try:
            project, repo = config["identifier"].split("/", 1)
            repo = client.get_repo(project, repo)
        except Exception as e:
            installation.raise_error(e)
        else:
            config["external_id"] = str(repo["id"])
            config["name"] = repo["project"]["key"] + "/" + repo["name"]
            config["project"] = repo["project"]["key"]
            config["repo"] = repo["name"]
        return config

    def build_repository_config(self, organization, data):
        installation = self.get_installation(data.get("installation"), organization.id)
        client = installation.get_client()

        try:
            resp = client.create_hook(
                data["project"],
                data["repo"],
                {
                    "name": "sentry-bitbucket-server-repo-hook",
                    "url": absolute_uri(
                        reverse(
                            "sentry-extensions-bitbucketserver-webhook",
                            kwargs={
                                "organization_id": organization.id,
                                "integration_id": data.get("installation"),
                            },
                        )
                    ),
                    "active": True,
                    "events": ["repo:refs_changed", "pr:merged"],
                },
            )
        except Exception as e:
            installation.raise_error(e)
        else:
            return {
                "name": data["identifier"],
                "external_id": data["external_id"],
                "url": installation.model.metadata["base_url"]
                + "/projects/{project}/repos/{repo}/browse".format(
                    project=data["project"], repo=data["repo"]
                ),
                "config": {
                    "name": data["identifier"],
                    "project": data["project"],
                    "repo": data["repo"],
                    "webhook_id": resp["id"],
                },
                "integration_id": data["installation"],
            }

    def on_delete_repository(self, repo):
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()

        try:
            client.delete_hook(
                repo.config["project"], repo.config["repo"], repo.config["webhook_id"]
            )
        except ApiError as exc:
            if exc.code == 404:
                return
            raise

    def _format_commits(self, client, repo, commit_list):
        return [
            {
                "id": c["id"],
                "repository": repo.name,
                "author_email": c["author"]["emailAddress"],
                "author_name": c["author"].get("displayName", c["author"]["name"]),
                "message": c["message"],
                "timestamp": datetime.fromtimestamp(c["authorTimestamp"] / 1000, timezone.utc),
                "patch_set": self._get_patchset(
                    client, repo.config["project"], repo.config["repo"], c["id"]
                ),
            }
            for c in commit_list
        ]

    def compare_commits(self, repo, start_sha, end_sha):
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()

        try:
            if "0" * 40 == start_sha or start_sha is None:
                commit_list = client.get_last_commits(repo.config["project"], repo.config["repo"])
            else:
                commit_list = client.get_commits(
                    repo.config["project"], repo.config["repo"], start_sha, end_sha
                )
            return self._format_commits(client, repo, commit_list)
        except Exception as e:
            installation.raise_error(e)

    def repository_external_slug(self, repo):
        return repo.name

    def _get_patchset(self, client, project, repo, sha):
        """
        Get the modified files for a commit
        """

        key = f"get_changelist:{md5_text(project + repo).hexdigest()}:{sha}"
        commit_files = cache.get(key)
        if commit_files is None:
            commit_files = client.get_commit_filechanges(project, repo, sha)
            cache.set(key, commit_files, 900)

        return self._transform_patchset(commit_files)

    def _transform_patchset(self, values):
        """Convert the patch data from Bitbucket into our internal format

        See sentry.models.Release.set_commits
        """
        changes = []
        for change in values:
            if change["type"] == "MODIFY":
                changes.append({"path": change["path"]["toString"], "type": "M"})
            if change["type"] == "ADD":
                changes.append({"path": change["path"]["toString"], "type": "A"})
            if change["type"] == "DELETE":
                changes.append({"path": change["path"]["toString"], "type": "D"})
            if change["type"] == "MOVE":
                changes.append({"path": change["srcPath"]["toString"], "type": "D"})
                changes.append({"path": change["path"]["toString"], "type": "A"})
        return changes

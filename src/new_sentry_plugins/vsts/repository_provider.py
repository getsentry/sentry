from __future__ import absolute_import

import six

from sentry.plugins import providers
from six.moves.urllib.parse import urlparse

from .mixins import VisualStudioMixin

MAX_COMMIT_DATA_REQUESTS = 90


class VisualStudioRepositoryProvider(VisualStudioMixin, providers.RepositoryProvider):
    name = "Visual Studio Team Services"
    auth_provider = "visualstudio"

    def get_config(self):
        return [
            {
                "name": "url",
                "label": "Repository URL",
                "type": "text",
                "placeholder": "e.g. https://example.visualstudio.com/_git/MyFirstProject",
                "required": True,
            },
            {
                "name": "project",
                "label": "Project Name",
                "type": "text",
                "placeholder": "e.g. MyFirstProject",
                "help": "Optional project name if it does not match the repository name",
                "required": False,
            },
        ]

    def validate_config(self, organization, config, actor=None):
        if config.get("url"):
            client = self.get_client(actor)
            # parse out the repo name and the instance
            parts = urlparse(config["url"])
            instance = parts.netloc
            name = parts.path.rsplit("_git/", 1)[-1]
            project = config.get("project") or name

            try:
                repo = client.get_repo(instance, name, project)
            except Exception as e:
                self.raise_error(e, identity=client.auth)
            config.update(
                {
                    "instance": instance,
                    "project": project,
                    "name": repo["name"],
                    "external_id": six.text_type(repo["id"]),
                    "url": repo["_links"]["web"]["href"],
                }
            )
        return config

    def create_repository(self, organization, data, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot create a repository anonymously")

        return {
            "name": data["name"],
            "external_id": data["external_id"],
            "url": data["url"],
            "config": {
                "instance": data["instance"],
                "project": data["project"],
                "name": data["name"],
            },
        }

    def delete_repository(self, repo, actor=None):
        pass

    def transform_changes(self, patch_set):
        type_mapping = {"add": "A", "delete": "D", "edit": "M"}
        file_changes = []
        # https://docs.microsoft.com/en-us/rest/api/vsts/git/commits/get%20changes#versioncontrolchangetype
        for change in patch_set:
            change_type = type_mapping.get(change["changeType"])

            if change_type and change.get("item") and change["item"]["gitObjectType"] == "blob":
                file_changes.append({"path": change["item"]["path"], "type": change_type})

        return file_changes

    def zip_commit_data(self, repo, commit_list, actor):
        client = self.get_client(actor)
        n = 0
        for commit in commit_list:
            commit.update(
                {
                    "patch_set": self.transform_changes(
                        client.get_commit_filechanges(
                            repo.config["instance"], repo.external_id, commit["commitId"]
                        )
                    )
                }
            )

            n += 1
            if n > MAX_COMMIT_DATA_REQUESTS:
                break

        return commit_list

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot fetch commits anonymously")

        client = self.get_client(actor)
        instance = repo.config["instance"]

        try:
            if start_sha is None:
                res = client.get_commits(instance, repo.external_id, commit=end_sha, limit=10)
            else:
                res = client.get_commit_range(instance, repo.external_id, start_sha, end_sha)
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        commits = self.zip_commit_data(repo, res["value"], actor)
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
            }
            for c in commit_list
        ]

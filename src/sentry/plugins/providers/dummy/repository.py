from __future__ import absolute_import

from sentry.plugins.providers.repository import RepositoryProvider


class DummyRepositoryProvider(RepositoryProvider):
    name = "Example"
    auth_provider = "dummy"

    def get_config(self):
        return [
            {
                "name": "name",
                "label": "Repository Name",
                "type": "text",
                "placeholder": "e.g. getsentry/sentry",
                "help": "Enter your repository name.",
                "required": True,
            }
        ]

    def create_repository(self, organization, data, actor=None):
        return {"name": data["name"]}

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        return [
            {"id": "62de626b7c7cfb8e77efb4273b1a3df4123e6216", "repository": repo.name},
            {"id": "58de626b7c7cfb8e77efb4273b1a3df4123e6345", "repository": repo.name},
            {"id": end_sha, "repository": repo.name},
        ]

    def repository_external_slug(self, repo):
        return repo.external_id

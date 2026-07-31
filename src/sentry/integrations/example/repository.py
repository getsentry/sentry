from collections.abc import Mapping, MutableMapping
from typing import Any

from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig


class ExampleRepositoryProvider(IntegrationRepositoryProvider):
    name = "Example"
    repo_provider = "example"

    def get_repository_data(
        self, organization: Any, config: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        installation = self.get_installation(config.get("installation"), organization.id)
        config["external_id"] = config.get("name", config.get("identifier", ""))
        config["integration_id"] = installation.model.id
        return config

    def compare_commits(self, repo, start_sha, end_sha):
        return [
            {"id": "62de626b7c7cfb8e77efb4273b1a3df4123e6216", "repository": repo.name},
            {"id": "58de626b7c7cfb8e77efb4273b1a3df4123e6345", "repository": repo.name},
            {"id": end_sha, "repository": repo.name},
        ]

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        return {
            "name": data.get("name", data.get("identifier", "")),
            "external_id": data.get("external_id", data.get("identifier", "")),
            "url": "https://example.com/{}".format(data.get("name", "")),
            "config": {"name": data.get("name", data.get("identifier", ""))},
            "integration_id": int(data.get("integration_id", -1)),
        }

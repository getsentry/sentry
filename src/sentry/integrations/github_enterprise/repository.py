from typing import Any

from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

WEBHOOK_EVENTS = ["push", "pull_request"]


class GitHubEnterpriseRepositoryProvider(GitHubRepositoryProvider):
    name = "GitHub Enterprise"
    repo_provider = IntegrationProviderSlug.GITHUB_ENTERPRISE.value

    def _validate_repo(self, client, installation, repo):
        try:
            repo_data = client.get_repo(repo)
        except Exception as e:
            raise installation.raise_error(e)

        try:
            # make sure installation has access to this specific repo
            client.get_commits(repo)
        except ApiError:
            raise IntegrationError(f"You must grant Sentry access to {repo}")

        return repo_data

    def build_repository_config(
        self, organization: RpcOrganization, data: dict[str, Any]
    ) -> RepositoryConfig:
        integration = integration_service.get_integration(
            integration_id=data["integration_id"], provider=self.repo_provider
        )
        if integration is None:
            raise IntegrationError("Could not find the requested GitHub Enterprise integration")

        base_url = integration.metadata["domain_name"].split("/")[0]
        return {
            "name": data["identifier"],
            "external_id": data["external_id"],
            "url": "https://{}/{}".format(base_url, data["identifier"]),
            "config": {"name": data["identifier"]},
            "integration_id": data["integration_id"],
        }

from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationError


class ExampleRepositoryProvider(IntegrationRepositoryProvider):
    name = "Example"
    repo_provider = "example"

    def compare_commits(self, repo, start_sha, end_sha):
        installation = integration_service.get_integration(
            integration_id=repo.integration_id
        ).get_installation(organization_id=repo.organization_id)

        try:
            raise IntegrationError("{'error': 'Repository not found'}")
        except Exception as e:
            installation.raise_error(e)

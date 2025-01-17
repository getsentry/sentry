from sentry.integrations.services.integration import integration_service
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.shared_integrations.exceptions import IntegrationError


class ExampleRepositoryProvider(IntegrationRepositoryProvider):
    name = "Example"
    repo_provider = "example"

    def compare_commits(self, repo, start_sha, end_sha):
        integration = integration_service.get_integration(integration_id=repo.integration_id)

        assert integration is not None

        installation = integration.get_installation(organization_id=repo.organization_id)

        try:
            raise IntegrationError("{'error': 'Repository not found'}")
        except Exception as e:
            installation.raise_error(e)

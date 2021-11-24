from sentry.models import Integration
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.shared_integrations.exceptions import IntegrationError


class ExampleRepositoryProvider(IntegrationRepositoryProvider):
    name = "Example"
    repo_provider = "example"

    def compare_commits(self, repo, start_sha, end_sha):
        installation = Integration.objects.get(id=repo.integration_id).get_installation(
            repo.organization_id
        )

        try:
            raise IntegrationError("{'error': 'Repository not found'}")
        except Exception as e:
            installation.raise_error(e)

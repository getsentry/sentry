from __future__ import absolute_import

from sentry.integrations.exceptions import IntegrationError
from sentry.models import Integration
from sentry.plugins import providers


class ExampleRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'Example'

    def compare_commits(self, repo, start_sha, end_sha):
        installation = Integration.objects.get(
            id=repo.integration_id,
        ).get_installation(repo.organization_id)

        try:
            raise IntegrationError("{'error': 'Repository not found'}")
        except Exception as e:
            installation.raise_error(e)

from __future__ import absolute_import

import logging

from sentry.models import Integration
from sentry.integrations.github.repository import GitHubRepositoryProvider


WEBHOOK_EVENTS = ['push', 'pull_request']


class GitHubEnterpriseRepositoryProvider(GitHubRepositoryProvider):
    name = 'GitHub Enterprise'
    logger = logging.getLogger('sentry.plugins.github_enterprise')
    repo_provider = 'github-enterprise'

    def create_repository(self, organization, data, actor=None):
        integration = Integration.objects.get(
            id=data['integration_id'], provider=self.repo_provider)

        base_url = integration.metadata.get('domain_name')
        return {
            'name': data['name'],
            'external_id': data['external_id'],
            'url': 'https://{}/{}'.format(base_url, data['name']),
            'config': {
                'name': data['name'],
            },
            'integration_id': data['integration_id']
        }

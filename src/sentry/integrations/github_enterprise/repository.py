from __future__ import absolute_import

import logging

from sentry.models import Integration
from sentry.integrations.github.repository import GitHubRepositoryProvider


WEBHOOK_EVENTS = ['push', 'pull_request']


class GitHubEnterpriseRepositoryProvider(GitHubRepositoryProvider):
    name = 'GitHub Enterprise'
    logger = logging.getLogger('sentry.plugins.github_enterprise')
    repo_provider = 'github_enterprise'

    def create_repository(self, organization, data):
        integration = Integration.objects.get(
            id=data['integration_id'], provider=self.repo_provider)

        base_url = integration.metadata['domain_name'].split('/')[0]
        return {
            'name': data['identifier'],
            'external_id': data['external_id'],
            'url': u'https://{}/{}'.format(base_url, data['identifier']),
            'config': {
                'name': data['identifier'],
            },
            'integration_id': data['integration_id']
        }

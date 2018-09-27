from __future__ import absolute_import

import six

from sentry.plugins import providers
from sentry.models import Integration

MAX_COMMIT_DATA_REQUESTS = 90


class GitlabRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'Gitlab'

    def get_installation(self, integration_id, organization_id):
        if integration_id is None:
            raise ValueError('%s requires an integration_id' % self.name)

        try:
            integration_model = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist as error:
            self.handle_api_error(error)

        return integration_model.get_installation(organization_id)

    def validate_config(self, organization, config):
        installation = self.get_installation(config['installation'], organization.id)
        client = installation.get_client()

        repo_id = config['identifier']
        instance = installation.model.metadata['domain_name']

        try:
            repo = client.get_project(six.text_type(repo_id))
        except Exception as e:
            installation.raise_error(e)
        config.update({
            'instance': instance,
            'path': repo['path_with_namespace'],
            'name': repo['name_with_namespace'],
            'repo_id': repo['id'],
            'external_id': '%s:%s' % (instance, repo['path']),
            'url': repo['web_url'],
        })
        return config

    def create_repository(self, organization, data):
        return {
            'name': data['name'],
            'external_id': data['external_id'],
            'url': data['url'],
            'config': {
                'instance': data['instance'],
                'repo_id': data['repo_id'],
                'path': data['path']
            },
            'integration_id': data['installation'],
        }

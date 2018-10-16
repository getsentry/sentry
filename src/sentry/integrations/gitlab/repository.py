from __future__ import absolute_import

import six

from sentry.integrations.exceptions import ApiError
from sentry.plugins import providers
from sentry.models import Integration


class GitlabRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'Gitlab'

    def get_installation(self, integration_id, organization_id):
        if integration_id is None:
            raise ValueError('%s requires an integration_id' % self.name)

        try:
            integration_model = Integration.objects.get(
                id=integration_id,
                organizations=organization_id,
            )
        except Integration.DoesNotExist as error:
            self.handle_api_error(error)

        return integration_model.get_installation(organization_id)

    def get_repository_data(self, organization, config):
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

    def build_repository_config(self, organization, data):
        installation = self.get_installation(data['installation'],
                                             organization.id)
        client = installation.get_client()
        hook_id = None
        try:
            hook_id = client.create_project_webhook(
                six.text_type(data['repo_id']))
        except Exception as e:
            installation.raise_error(e)
        return {
            'name': data['name'],
            'external_id': data['external_id'],
            'url': data['url'],
            'config': {
                'instance': data['instance'],
                'repo_id': data['repo_id'],
                'path': data['path'],
                'webhook_id': hook_id,
            },
            'integration_id': data['installation'],
        }

    def on_delete_repository(self, repo):
        """Clean up the attached webhook"""
        installation = self.get_installation(repo.integration_id,
                                             repo.organization_id)
        client = installation.get_client()
        try:
            client.delete_project_webhook(
                six.text_type(repo.config['repo_id']),
                repo.config['webhook_id'])
        except ApiError as e:
            if e.code == 404:
                return
            installation.raise_error(e)

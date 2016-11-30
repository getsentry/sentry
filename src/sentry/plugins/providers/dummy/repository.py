from __future__ import absolute_import

from sentry.plugins.providers.repository import RepositoryProvider


class DummyRepositoryProvider(RepositoryProvider):
    name = 'Example'

    def get_config(self):
        return [{
            'name': 'name',
            'label': 'Repository Name',
            'type': 'text',
            'placeholder': 'e.g. getsentry/sentry',
            'help': 'Enter your repository name.',
            'required': True,
        }]

    def create_repository(self, organization, data, actor=None):
        return {
            'name': data['name'],
        }

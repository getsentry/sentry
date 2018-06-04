from __future__ import absolute_import

import logging
import six

from sentry.models import Integration
from sentry.plugins import providers

WEBHOOK_EVENTS = ['push', 'pull_request']


class GitHubRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'GitHub'
    logger = logging.getLogger('sentry.plugins.github')

    def get_config(self, organization):
        choices = []
        for i in Integration.objects.filter(organizations=organization, provider='github'):
            choices.append((i.id, i.name))

        if not choices:
            choices = [('', '')]

        return [
            {
                'name': 'installation',
                'label': 'GitHub Installation',
                'type': 'choice',
                'choices': choices,
                'initial': choices[0][0],
                'help': 'Select which GitHub installation to authenticate with.',
                'required': True,
            },
            {
                'name': 'name',
                'label': 'Repository Name',
                'type': 'text',
                'placeholder': 'e.g. getsentry/sentry',
                'help': 'Enter your repository name, including the owner.',
                'required': True,
            }
        ]

    def _get_repo(self, client, installation, repo):
        try:
            repo = client.get_repo(repo)
        except Exception as e:
            installation.raise_error(e)

        try:
            # make sure installation has access to this specific repo
            client.get_commits(repo)
        except Exception as e:
            installation.raise_error(e)

        return repo

    def validate_config(self, organization, config, actor=None):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        if config.get('name') and config.get('installation'):
            integration = Integration.objects.get(
                id=config['installation'], organizations=organization)
            installation = integration.get_installation()
            client = installation.get_client()

            repo = self._get_repo(client, installation, config['name'])
            config['external_id'] = six.text_type(repo['id'])
            config['integration_id'] = integration.id

        return config

    def create_repository(self, organization, data, actor=None):
        return {
            'name': data['name'],
            'external_id': data['external_id'],
            'url': 'https://github.com/{}'.format(data['name']),
            'config': {
                'name': data['name'],
            },
            'integration_id': data['integration_id']
        }

    def _format_commits(self, repo, commit_list):
        return [
            {
                'id': c['sha'],
                'repository': repo.name,
                'author_email': c['commit']['author'].get('email'),
                'author_name': c['commit']['author'].get('name'),
                'message': c['commit']['message'],
            } for c in commit_list
        ]

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        integration_id = repo.integration_id
        if integration_id is None:
            raise NotImplementedError('GitHub apps requires an integration id to fetch commits')
        integration = Integration.objects.get(id=integration_id)
        installation = integration.get_installation()
        client = installation.get_client()

        # use config name because that is kept in sync via webhooks
        name = repo.config['name']
        if start_sha is None:
            try:
                res = client.get_last_commits(name, end_sha)
            except Exception as e:
                installation.raise_error(e)
            else:
                return self._format_commits(repo, res[:10])
        else:
            try:
                res = client.compare_commits(name, start_sha, end_sha)
            except Exception as e:
                installation.raise_error(e)
            else:
                return self._format_commits(repo, res['commits'])

        def get_pr_commits(self, repo, number, actor=None):
            # (not currently used by sentry)
            integration_id = repo.integration_id
            if integration_id is None:
                raise NotImplementedError('GitHub apps requires an integration id to fetch commits')
            integration = Integration.objects.get(id=integration_id)
            installation = integration.get_installation()
            client = installation.get_client()

            # use config name because that is kept in sync via webhooks
            name = repo.config['name']
            try:
                res = client.get_pr_commits(name, number)
            except Exception as e:
                installation.raise_error(e)
            else:
                return self._format_commits(repo, res)

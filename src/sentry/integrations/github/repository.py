from __future__ import absolute_import

import logging
import six

from sentry.models import Integration, Organization
from sentry.plugins import providers

WEBHOOK_EVENTS = ['push', 'pull_request']


class GitHubRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'GitHub Apps'
    auth_provider = 'github'
    logger = logging.getLogger('sentry.plugins.github')

    def get_config(self, organization):
        choices = []
        for i in Integration.objects.filter(organizations=organization, provider='github'):
            choices.append((i.id, i.name))

        return [
            {
                'name': 'installation',
                'label': 'Github Installation',
                'type': 'choice',
                'choices': choices,
                'initial': choices[0][0],
                'placeholder': 'i dk yet',
                'help': 'Enter your repository name, including the owner.',
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

    def validate_config(self, organization, config, actor=None):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        if config.get('name') and config.get('installation'):
            # this doesn't work yet, need github client
            client = self.get_client()
            try:
                repo = client.get_repo(config['name'])
            except Exception as e:
                self.raise_error(e)
            else:
                config['external_id'] = six.text_type(repo['id'])
        return config

    def create_repository(self, organization, data, actor=None):
        return {
            'name': data['name'],
            'external_id': data['external_id'],
            'url': 'https://github.com/{}'.format(data['name']),
            'config': {
                'name': data['name'],
            }
        }

    # TODO(dcramer): let's make this core functionality and move the actual database
    # updates into Sentry core
    def update_repository(self, repo, actor=None):
        if actor is None:
            raise NotImplementedError('Cannot update a repository anonymously')

        client = self.get_client(actor)
        org = Organization.objects.get(id=repo.organization_id)
        webhook_id = repo.config.get('webhook_id')
        if not webhook_id:
            resp = self._create_webhook(client, org, repo.config['name'])
        else:
            resp = self._update_webhook(
                client,
                org,
                repo.config['name'],
                repo.config['webhook_id'])
        repo.config.update({
            'webhook_id': resp['id'],
            'webhook_events': resp['events'],
        })
        repo.update(config=repo.config)

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
        if actor is None:
            raise NotImplementedError('Cannot fetch commits anonymously')
        client = self.get_client(actor)

        # use config name because that is kept in sync via webhooks
        name = repo.config['name']
        if start_sha is None:
            try:
                res = client.get_last_commits(name, end_sha)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res[:10])
        else:
            try:
                res = client.compare_commits(name, start_sha, end_sha)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res['commits'])

        def get_pr_commits(self, repo, number, actor=None):
            # (not currently used by sentry)
            if actor is None:
                raise NotImplementedError('Cannot fetch commits anonymously')
            client = self.get_client(actor)

            # use config name because that is kept in sync via webhooks
            name = repo.config['name']
            try:
                res = client.get_pr_commits(name, number)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res)

from __future__ import absolute_import

import logging
import six

from sentry.app import locks
from sentry.models import Integration, Organization, OrganizationOption
from sentry.plugins import providers
from sentry.utils.http import absolute_uri
from uuid import uuid4

WEBHOOK_EVENTS = ['push', 'pull_request']


class GitHubRepositoryProvider(providers.RepositoryProvider):
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
        if config.get('name'):
            client = self.get_client(actor)
            try:
                repo = client.get_repo(config['name'])
            except Exception as e:
                self.raise_error(e)
            else:
                config['external_id'] = six.text_type(repo['id'])
        return config

    def get_webhook_secret(self, organization):
        lock = locks.get('github:webhook-secret:{}'.format(organization.id), duration=60)
        with lock.acquire():
            # TODO(dcramer): get_or_create would be a useful native solution
            secret = OrganizationOption.objects.get_value(
                organization=organization,
                key='github:webhook_secret',
            )
            if secret is None:
                secret = uuid4().hex + uuid4().hex
                OrganizationOption.objects.set_value(
                    organization=organization,
                    key='github:webhook_secret',
                    value=secret,
                )
        return secret

    def _build_webhook_config(self, organization):
        return {
            'name': 'web',
            'active': True,
            'events': WEBHOOK_EVENTS,
            'config': {
                'url': absolute_uri(
                    '/plugins/github/organizations/{}/webhook/'.format(organization.id)
                ),
                'content_type': 'json',
                'secret': self.get_webhook_secret(organization),
            },
        }

    def _create_webhook(self, client, organization, repo_name):
        return client.create_hook(
            repo_name, self._build_webhook_config(organization)
        )

    def _update_webhook(self, client, organization, repo_name, webhook_id):
        return client.update_hook(
            repo_name, webhook_id, self._build_webhook_config(organization)
        )

    def create_repository(self, organization, data, actor=None):
        if actor is None:
            raise NotImplementedError('Cannot create a repository anonymously')

        client = self.get_client(actor)

        try:
            resp = self._create_webhook(client, organization, data['name'])
        except Exception as e:
            self.logger.exception('github.webhook.create-failure', extra={
                'organization_id': organization.id,
                'repository': data['name'],
                'status_code': getattr(e, 'code', None),
            })

            self.raise_error(e)
        else:
            return {
                'name': data['name'],
                'external_id': data['external_id'],
                'url': 'https://github.com/{}'.format(data['name']),
                'config': {
                    'name': data['name'],
                    'webhook_id': resp['id'],
                    'webhook_events': resp['events'],
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

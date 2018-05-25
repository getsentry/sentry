from __future__ import absolute_import

import six

from uuid import uuid4

from sentry.app import locks
from sentry.models import OrganizationOption
from sentry.plugins import providers
from sentry.models import Integration
from sentry.utils.http import absolute_uri

from sentry.integrations.exceptions import ApiError

from .webhook import parse_raw_user_email, parse_raw_user_name


class BitbucketRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'Bitbucket v2'

    def raise_error(self, error, identity):
        # TODO(LB): This used to do a lot more. Not sure it's important to handle atm
        raise error

    def get_client(self, integration_id):
        if integration_id is None:
            raise ValueError('Bitbucket version 2 requires an integration id.')

        try:
            integration_model = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExistError as error:
            self.raise_error(error)

        return integration_model.get_installation().get_client()

    def get_config(self, organization):
        choices = []
        for i in Integration.objects.filter(organizations=organization, provider='bitbucket'):
            choices.append((i.id, i.name))

        if not choices:
            choices = [('', '')]
        return [
            {
                'name': 'integration_id',
                'label': 'Bitbucket Integration',
                'type': 'choice',
                'choices': choices,
                'initial': choices[0][0],
                'help': 'Select which Bitbucket integration to authenticate with.',
                'required': True,
            },
            {
                'name': 'name',
                'label': 'Repository Name',
                'type': 'text',
                'placeholder': 'e.g. getsentry/sentry',
                'help': 'Enter your repository name, including the owner.',
                'required': True,
            },
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
            client = self.get_client(config['integration_id'])
            try:
                repo = client.get_repo(config['name'])
            except Exception as e:
                self.raise_error(e)
            else:
                config['external_id'] = six.text_type(repo['uuid'])
        return config

    def get_webhook_secret(self, organization):
        # TODO(LB): Revisit whether Integrations V3 should be using OrganizationOption for storage
        lock = locks.get('bitbucket:webhook-secret:{}'.format(organization.id), duration=60)
        with lock.acquire():
            secret = OrganizationOption.objects.get_value(
                organization=organization,
                key='bitbucket:webhook_secret',
            )
            if secret is None:
                secret = uuid4().hex + uuid4().hex
                OrganizationOption.objects.set_value(
                    organization=organization,
                    key='bitbucket:webhook_secret',
                    value=secret,
                )
        return secret

    def create_repository(self, organization, data, actor=None):
        client = self.get_client(data['integration_id'])
        try:
            resp = client.create_hook(
                data['name'], {
                    'description': 'sentry-bitbucket-repo-hook',
                    'url': absolute_uri(
                        '/extensions/bitbucket/organizations/{}/webhook/'.format(organization.id)
                    ),
                    'active': True,
                    'events': ['repo:push'],
                }
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)
        else:
            return {
                'name': data['name'],
                'external_id': data['external_id'],
                'url': 'https://bitbucket.org/{}'.format(data['name']),
                'config': {
                    'name': data['name'],
                    'webhook_id': resp['uuid'],
                },
                'integration_id': data['integration_id'],
            }

    def delete_repository(self, repo, actor=None):
        client = self.get_client(repo.integration_id)

        try:
            client.delete_hook(repo.config['name'], repo.config['webhook_id'])
        except ApiError as exc:
            if exc.code == 404:
                return
            raise

    def _format_commits(self, repo, commit_list):
        return [
            {
                'id': c['hash'],
                'repository': repo.name,
                'author_email': parse_raw_user_email(c['author']['raw']),
                'author_name': parse_raw_user_name(c['author']['raw']),
                'message': c['message'],
                'patch_set': c.get('patch_set'),
            } for c in commit_list
        ]

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        client = self.get_client(repo.integration_id)
        # use config name because that is kept in sync via webhooks
        name = repo.config['name']
        if start_sha is None:
            try:
                res = client.get_last_commits(name, end_sha)
            except Exception as e:
                self.raise_error(e, identity=client.auth)
            else:
                return self._format_commits(repo, res[:10])
        else:
            try:
                res = client.compare_commits(name, start_sha, end_sha)
            except Exception as e:
                self.raise_error(e, identity=client.auth)
            else:
                return self._format_commits(repo, res)

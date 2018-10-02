from __future__ import absolute_import

import dateutil.parser
import logging
import six

from django.utils import timezone

from sentry.integrations.exceptions import ApiError, IntegrationError
from sentry.models import Integration
from sentry.plugins import providers

WEBHOOK_EVENTS = ['push', 'pull_request']


class GitHubRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'GitHub'
    logger = logging.getLogger('sentry.plugins.github')
    repo_provider = 'github'

    def _validate_repo(self, client, installation, repo):
        try:
            repo_data = client.get_repo(repo)
        except Exception as e:
            installation.raise_error(e)

        try:
            # make sure installation has access to this specific repo
            # use hooks endpoint since we explicity ask for those permissions
            # when installing the app (commits can be accessed for public repos)
            # https://developer.github.com/v3/repos/hooks/#list-hooks
            client.repo_hooks(repo)
        except ApiError as e:
            raise IntegrationError(u'You must grant Sentry access to {}'.format(repo))

        return repo_data

    def add_repository_data(self, organization, config):
        integration = Integration.objects.get(
            id=config['installation'], organizations=organization)
        installation = integration.get_installation(organization.id)
        client = installation.get_client()

        repo = self._validate_repo(client, installation, config['identifier'])
        config['external_id'] = six.text_type(repo['id'])
        config['integration_id'] = integration.id

        return config

    def build_repository_config(self, organization, data):
        return {
            'name': data['identifier'],
            'external_id': data['external_id'],
            'url': u'https://github.com/{}'.format(data['identifier']),
            'config': {
                'name': data['identifier'],
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
                'timestamp': dateutil.parser.parse(
                    c['commit']['author'].get('date'),
                ).astimezone(timezone.utc) if c['commit']['author'].get('date') else None,
            } for c in commit_list
        ]

    def compare_commits(self, repo, start_sha, end_sha):
        integration_id = repo.integration_id
        if integration_id is None:
            raise NotImplementedError('GitHub apps requires an integration id to fetch commits')
        integration = Integration.objects.get(id=integration_id)
        installation = integration.get_installation(repo.organization_id)
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
            installation = integration.get_installation(repo.organization_id)
            client = installation.get_client()

            # use config name because that is kept in sync via webhooks
            name = repo.config['name']
            try:
                res = client.get_pr_commits(name, number)
            except Exception as e:
                installation.raise_error(e)
            else:
                return self._format_commits(repo, res)

from __future__ import absolute_import

import responses

from exam import fixture
from mock import patch
from sentry.models import Integration, Repository
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry.integrations.github.client import GitHubAppsClient
from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.integrations.github.testutils import COMPARE_COMMITS_EXAMPLE


class GitHubAppsProviderTest(PluginTestCase):
    @fixture
    def provider(self):
        return GitHubRepositoryProvider('integrations:github')

    @responses.activate
    def test_create_repository(self):
        organization = self.create_organization()
        integration = Integration.objects.create(
            provider='github',
            name='Example Github',
        )
        integration.add_organization(organization.id)
        data = {
            'name': 'getsentry/example-repo',
            'external_id': '654321',
            'integration_id': integration.id,
        }
        data = self.provider.create_repository(organization, data)
        assert data == {
            'config': {
                'name': 'getsentry/example-repo',
            },
            'external_id': '654321',
            'integration_id': integration.id,
            'name': 'getsentry/example-repo',
            'url': 'https://github.com/getsentry/example-repo',
        }

    @patch.object(
        GitHubAppsClient,
        'get_last_commits',
        return_value=[]
    )
    def test_compare_commits_no_start(self, mock_get_last_commits):
        organization = self.create_organization()
        integration = Integration.objects.create(
            provider='integrations:github',
            external_id='1',
        )
        repo = Repository.objects.create(
            name='example-repo',
            provider='integrations:github',
            organization_id=organization.id,
            integration_id=integration.id,
            config={'name': 'example-repo'},
        )

        self.provider.compare_commits(repo, None, 'a' * 40)

        assert mock_get_last_commits.called

    @patch.object(
        GitHubAppsClient,
        'compare_commits',
        return_value={'commits': []}
    )
    def test_compare_commits(self, mock_compare_commits):
        organization = self.create_organization()
        integration = Integration.objects.create(
            provider='integrations:github',
            external_id='1',
        )
        repo = Repository.objects.create(
            name='example-repo',
            provider='integrations:github',
            organization_id=organization.id,
            integration_id=integration.id,
            config={'name': 'example-repo'},
        )

        res = self.provider._format_commits(repo, json.loads(COMPARE_COMMITS_EXAMPLE)['commits'])

        assert res == [
            {
                'author_email': 'support@github.com',
                'author_name': 'Monalisa Octocat',
                'message': 'Fix all the bugs',
                'id': '6dcb09b5b57875f334f61aebed695e2e4193db5e',
                'repository': 'example-repo'
            }
        ]

        self.provider.compare_commits(repo, 'b' * 40, 'a' * 40)

        assert mock_compare_commits.called

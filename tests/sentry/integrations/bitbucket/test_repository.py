from __future__ import absolute_import

import responses

from exam import fixture
from sentry.models import Integration, Repository
from sentry.testutils import TestCase
from sentry.integrations.bitbucket.repository import BitbucketRepositoryProvider
from .testutils import COMPARE_COMMITS_EXAMPLE, COMMIT_DIFF_PATCH, REPO


class BitbucketRepositoryProviderTest(TestCase):
    def setUp(self):
        self.base_url = 'https://api.bitbucket.org'
        self.shared_secret = '234567890'
        self.subject = 'connect:1234567'
        self.integration = Integration.objects.create(
            provider='bitbucket',
            external_id=self.subject,
            name='MyBitBucket',
            metadata={
                'base_url': self.base_url,
                'shared_secret': self.shared_secret,
                'subject': self.subject,
            }
        )
        self.integration.add_organization(self.organization, self.user)
        self.repo = Repository.objects.create(
            provider='bitbucket',
            name='sentryuser/newsdiffs',
            organization_id=self.organization.id,
            config={
                'name': 'sentryuser/newsdiffs',
            },
            integration_id=self.integration.id,
        )

    @fixture
    def provider(self):
        return BitbucketRepositoryProvider('bitbucket')

    def test_get_client(self):
        installation = self.integration.get_installation(self.repo.organization_id)
        client = installation.get_client()
        assert client.base_url == self.base_url
        assert client.shared_secret == self.shared_secret
        assert client.subject == self.subject

    @responses.activate
    def test_compare_commits(self):
        responses.add(
            responses.GET,
            'https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301',
            body=COMPARE_COMMITS_EXAMPLE,
        )
        responses.add(
            responses.GET,
            'https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301',
            body=COMMIT_DIFF_PATCH,
        )

        res = self.provider.compare_commits(
            self.repo, None, 'e18e4e72de0d824edfbe0d73efe34cbd0d01d301')

        assert res == [
            {
                'author_email': 'sentryuser@getsentry.com',
                'author_name': 'Sentry User',
                'message': 'README.md edited online with Bitbucket',
                'id': 'e18e4e72de0d824edfbe0d73efe34cbd0d01d301',
                'repository': 'sentryuser/newsdiffs',
                'patch_set': [{'path': u'README.md', 'type': 'M'}]
            }
        ]

    @responses.activate
    def test_create_repository(self):
        full_repo_name = 'laurynsentry/helloworld'
        webhook_id = 'web-hook-id'
        responses.add(
            responses.GET,
            'https://api.bitbucket.org/2.0/repositories/%s' % full_repo_name,
            json=REPO,
        )
        responses.add(
            responses.POST,
            'https://api.bitbucket.org/2.0/repositories/%s/hooks' % full_repo_name,
            json={'uuid': webhook_id},
            status=201,
        )

        organization = self.create_organization()
        integration = Integration.objects.create(
            provider='bitbucket',
            external_id='bitbucket_external_id',
            name='Hello world',
            metadata={
                'base_url': 'https://api.bitbucket.org',
                'shared_secret': '23456789',
            }
        )
        data = {
            'provider': 'integrations:bitbucket',
            'identifier': full_repo_name,
            'installation': integration.id,
        }
        data = self.provider.validate_config(organization, data)
        assert data == {
            'provider': 'integrations:bitbucket',
            'identifier': full_repo_name,
            'installation': integration.id,
            'external_id': REPO['uuid'],
            'name': full_repo_name,
        }
        data = self.provider.create_repository(organization, data)

        assert data == {
            'name': full_repo_name,
            'external_id': REPO['uuid'],
            'url': 'https://bitbucket.org/laurynsentry/helloworld',
            'integration_id': integration.id,
            'config': {
                'name': full_repo_name,
                'webhook_id': webhook_id,
            }
        }

from __future__ import absolute_import

import responses

from exam import fixture
from sentry.models import Integration, Repository
from sentry.testutils import TestCase
from sentry.integrations.bitbucket.repository import BitbucketRepositoryProvider
from .testutils import COMPARE_COMMITS_EXAMPLE, COMMIT_DIFF_PATCH


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
        self.integration.add_organization(self.organization.id)
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
        client = self.provider.get_client(self.repo.integration_id)
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

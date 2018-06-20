from __future__ import absolute_import

import responses

from exam import fixture
from time import time

from sentry.testutils import TestCase
from sentry.models import Identity, IdentityProvider, Integration, Repository
from sentry.integrations.vsts.repository import VstsRepositoryProvider

from .testutils import (
    COMPARE_COMMITS_EXAMPLE, FILE_CHANGES_EXAMPLE
)


class VisualStudioRepositoryProviderTest(TestCase):
    @fixture
    def provider(self):
        return VstsRepositoryProvider('integrations:vsts')

    @responses.activate
    def test_compare_commits(self):

        responses.add(
            responses.POST,
            'https://visualstudio.com/DefaultCollection/_apis/git/repositories/None/commitsBatch',
            body=COMPARE_COMMITS_EXAMPLE,
        )
        responses.add(
            responses.GET,
            'https://visualstudio.com/DefaultCollection/_apis/git/repositories/None/commits/6c36052c58bde5e57040ebe6bdb9f6a52c906fff/changes',
            body=FILE_CHANGES_EXAMPLE,
        )
        integration = Integration.objects.create(
            provider='vsts',
            external_id='vsts_external_id',
            name='Hello world',
        )
        default_auth = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type='vsts',
                config={},
            ),
            user=self.user,
            external_id='123',
            data={
                'access_token': '123456789',
                'expires': int(time()) + 3600,
                'refresh_token': 'rxxx-xxxx',
                'token_type': 'jwt-bearer',
            },
        )
        integration.add_organization(self.organization.id, default_auth.id)
        repo = Repository.objects.create(
            provider='visualstudio',
            name='example',
            organization_id=self.organization.id,
            config={
                'instance': 'visualstudio.com',
                'project': 'project-name',
                'name': 'example',
            },
            integration_id=integration.id,
        )

        res = self.provider.compare_commits(repo, "a", "b", organization_id=self.organization.id)

        assert res == [{
            'patch_set': [{'path': u'/README.md',
                           'type': 'M'}],
            'author_email': 'max@sentry.io',
            'author_name': 'max bittker',
            'message': 'Updated README.md',
            'id': '6c36052c58bde5e57040ebe6bdb9f6a52c906fff',
            'repository': 'example'
        }]

    @responses.activate
    def test_create_repository(self):
        organization = self.create_organization()
        integration = Integration.objects.create(
            provider='vsts',
            external_id='vsts_external_id',
            name='Hello world',
        )
        data = {
            'name': 'MyFirstProject',
            'external_id': '654321',
            'url': 'https://mbittker.visualstudio.com/_git/MyFirstProject/',
            'instance': 'https://visualstudio.com',
            'project': 'MyFirstProject',
            'integration_id': integration.id,
        }
        data = self.provider.create_repository(organization, data)

        assert data == {
            'name': 'MyFirstProject',
            'external_id': '654321',
            'url': 'https://mbittker.visualstudio.com/_git/MyFirstProject/',

            'config': {
                'project': 'MyFirstProject',
                'name': 'MyFirstProject',
                'instance': 'https://visualstudio.com'

            },
            'integration_id': integration.id,
        }

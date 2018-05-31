from __future__ import absolute_import

import responses

from exam import fixture

from sentry.testutils import TestCase
from sentry.models import Repository
from sentry.integrations.vsts.repository import VstsRepositoryProvider

from .testutils import (
    COMPARE_COMMITS_EXAMPLE, FILE_CHANGES_EXAMPLE
)


class VisualStudioRepositoryProviderPluginTest(TestCase):
    @fixture
    def provider(self):
        return VstsRepositoryProvider('visualstudio')

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

        repo = Repository.objects.create(
            provider='visualstudio',
            name='example',
            organization_id=1,
            config={
                'instance': 'visualstudio.com',
                'project': 'project-name',
                'name': 'example',
            }
        )

        user = self.create_user()

        res = self.provider.compare_commits(repo, "a", "b", user)

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

        user = self.create_user()
        organization = self.create_organization()

        data = {
            'name': 'MyFirstProject',
            'external_id': '654321',
            'url': 'https://mbittker.visualstudio.com/_git/MyFirstProject/',
            'instance': 'https://visualstudio.com',
            'project': 'MyFirstProject'
        }
        data = self.provider.create_repository(organization, data, user)

        assert data == {
            'name': 'MyFirstProject',
            'external_id': '654321',
            'url': 'https://mbittker.visualstudio.com/_git/MyFirstProject/',

            'config': {
                'project': 'MyFirstProject',
                'name': 'MyFirstProject',
                'instance': 'https://visualstudio.com'

            },
        }

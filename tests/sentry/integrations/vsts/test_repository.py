from __future__ import absolute_import

import responses

from exam import fixture

from sentry.testutils import TestCase
from sentry.models import Repository
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

        repo = Repository.objects.create(
            provider='visualstudio',
            name='example',
            organization_id=self.organization.id,
            config={
                'instance': 'visualstudio.com',
                'project': 'project-name',
                'name': 'example',
            }
        )

        res = self.provider.compare_commits(repo, "a", "b")

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

        data = {
            'name': 'MyFirstProject',
            'external_id': '654321',
            'url': 'https://mbittker.visualstudio.com/_git/MyFirstProject/',
            'instance': 'https://visualstudio.com',
            'project': 'MyFirstProject'
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
        }

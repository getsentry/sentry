from __future__ import absolute_import

import responses
from .test_client_utils import COMPARE_COMMITS_EXAMPLE, COMMIT_DIFF_PATCH

from sentry.testutils import APITestCase
from sentry.integrations.bitbucket.client import BitbucketAPI, BitbucketAPIPath


class TestBitbucketClient(APITestCase):
    key = 'bitbucket'
    base_url = 'https://api.bitbucket.org'
    shared_secret = 'G12332434SDfsjkdfgsd'

    def setUp(self):
        super(TestBitbucketClient, self).setUp()
        self.username = 'sentryuser'
        self.repo_slug = 'sentryrepo'
        self.commit_sha = 'e18e4e72de0d824edfbe0d73efe34cbd0d01d301'
        self.client = BitbucketAPI(self.base_url, self.shared_secret)

    def test_transform_patchset(self):
        pass

    def test_get_commit_filechanges(self):
        pass

    def test_zip_commit_data(self):
        pass

    def test_get_last_commits(self):
        pass

    @responses.activate
    def test_compare_commits(self):
        commits_url = self.base_url + BitbucketAPIPath.repository_commits.format(
            username=self.username,
            repo_slug=self.repo_slug,
            revision=self.commit_sha,
        )
        repo_diff_url = self.base_url + BitbucketAPIPath.repository_diff.format(
            username=self.username,
            repo_slug=self.repo_slug,
            spec=self.commit_sha,
        )
        responses.add(
            responses.GET,
            commits_url,
            body=COMPARE_COMMITS_EXAMPLE,
        )
        responses.add(
            responses.GET,
            repo_diff_url,
            body=COMMIT_DIFF_PATCH,
        )

        result = self.client.compare_commits(
            username=self.username,
            repo_slug=self.repo_slug,
            start_sha=None,
            end_sha=self.commit_sha
        )

        assert result == [
            {
                'author_email': 'sentryuser@getsentry.com',
                'author_name': 'Sentry User',
                'message': 'README.md edited online with Bitbucket',
                'id': 'e18e4e72de0d824edfbe0d73efe34cbd0d01d301',
                'repository': 'sentryuser/newsdiffs',
                'patch_set': [{'path': u'README.md', 'type': 'M'}]
            }
        ]

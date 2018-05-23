from __future__ import absolute_import

import responses

from mock import Mock
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


class TestRealBitbucketClient(APITestCase):
    def setUp(self):
        self.integration = Mock()
        self.integration.name = 'laurynsentry'
        self.integration.metadata = {
            u'public_key': u'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCBFq+6Iq5J9AZzTZQfZEba9udHTIJToJnoDvWVHk8jKZIrMrVT1oJoAec84+nBhiO/8neqvbTlD7MeIb5aTDZo8YVhBKmQuEJ5RY56EakoR4x5oILsz/Ki5O4nGWSeTCCG1hj4heVsUi77umkYG5sZyHKNO+P+SwctTH1GEBDwswIDAQAB',
            u'icon': u'https://bitbucket.org/account/laurynsentry/avatar/32/',
            u'domain_name': u'bitbucket.org/laurynsentry/',
            u'shared_secret': u'cygeH67wplcmRkEN5ZiNNUMeCdiEZCtiWp52wA59E8A',
            u'base_url': u'https://api.bitbucket.org'
        }

        self.repo_slug = 'helloworld'
        self.client = BitbucketAPI(
            self.integration.metadata['base_url'],
            self.integration.metadata['shared_secret'])

    def test_get_issue(self):
        issue = self.client.get_issue(
            username=self.integration.name,
            repo_slug=self.repo_slug,
            issue_id='#1'
        )['values'][0]
        assert issue['type']
        assert issue['id']
        assert issue['repository']['name'] == 'HelloWorld'

    def test_create_issue(self):
        pass

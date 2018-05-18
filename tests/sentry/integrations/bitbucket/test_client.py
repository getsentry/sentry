from __future__ import absolute_import

# import responses
# from .test_client_utils import COMPARE_COMMITS_EXAMPLE, COMMIT_DIFF_PATCH
from sentry.testutils import IntegrationTestCase
# from sentry.integrations.bitbucket.client import BitbucketAPI


class TestBitbucketClient(IntegrationTestCase):
    def test_transform_patchset(self, patch_set):
        pass

    def test_get_commit_filechanges(self, repo, sha):
        pass

    def test_zip_commit_data(self, repo, commit_list):
        pass

    def test_get_last_commits(self, repo, end_sha):
        pass

    def test_compare_commits(self, repo, start_sha, end_sha):
        pass

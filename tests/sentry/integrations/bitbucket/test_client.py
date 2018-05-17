from __future__ import absolute_import

from sentry.testutils import APITestCase
# from sentry.integrations.bitbucket.descriptor import BitbucketAPI


class TestClient(APITestCase):

    def test_get_issue(self, issue_id):
        pass

    def test_create_issue(self, repo, data):
        pass

    def test_search_issues(self, repo, query):
        pass

    def test_create_comment(self, repo, issue_id, data):
        pass

    def test_get_repo(self, repo):
        pass

    def test_create_hook(self, repo, data):
        pass

    def test_delete_hook(self, repo, id):
        pass

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

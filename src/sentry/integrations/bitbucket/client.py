from __future__ import absolute_import


from six.moves.urllib.parse import urlparse

from sentry.utils.http import absolute_uri
from sentry.integrations.atlassian_connect import integration_request

BITBUCKET_KEY = '%s.bitbucket' % urlparse(absolute_uri()).hostname


class BitbucketAPI(object):
    ALL_REPO_URL = '/2.0/repositories/%s'

    def __init__(self, base_url, shared_secret):
        self.base_url = base_url
        self.shared_secret = shared_secret

    def get_all_repositories(self, account):
        # Account can be either Team or User
        return integration_request(
            method='GET',
            path=self.ALL_REPO_URL % account,
            app_key=BITBUCKET_KEY,
            base_url=self.base_url,
            shared_secret=self.shared_secret,
        )
    # TODO(LB): do has_auth and bind_auth belong here?

    def get_issue(self, issue_id):
        pass

    def create_issue(self, repo, data):
        pass

    def search_issues(self, repo, query):
        pass

    def create_comment(self, repo, issue_id, data):
        pass

    def get_repo(self, repo):
        pass

    def create_hook(self, repo, data):
        pass

    def delete_hook(self, repo, id):
        pass

    def transform_patchset(self, patch_set):
        pass

    def get_commit_filechanges(self, repo, sha):
        pass

    def zip_commit_data(self, repo, commit_list):
        pass

    def get_last_commits(self, repo, end_sha):
        pass

    def compare_commits(self, repo, start_sha, end_sha):
        pass

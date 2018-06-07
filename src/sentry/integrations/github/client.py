from __future__ import absolute_import

import datetime

from sentry.integrations.github.utils import get_jwt
from sentry.integrations.client import ApiClient


class GitHubClientMixin(ApiClient):
    allow_redirects = True

    base_url = 'https://api.github.com'

    def get_last_commits(self, repo, end_sha):
        # return api request that fetches last ~30 commits
        # see https://developer.github.com/v3/repos/commits/#list-commits-on-a-repository
        # using end_sha as parameter
        return self.get(
            '/repos/{}/commits'.format(
                repo,
            ),
            params={'sha': end_sha},
        )

    def compare_commits(self, repo, start_sha, end_sha):
        # see https://developer.github.com/v3/repos/commits/#compare-two-commits
        # where start sha is oldest and end is most recent
        return self.get('/repos/{}/compare/{}...{}'.format(
            repo,
            start_sha,
            end_sha,
        ))

    def get_pr_commits(self, repo, num):
        # see https://developer.github.com/v3/pulls/#list-commits-on-a-pull-request
        # Max: 250 Commits
        return self.get('/repos/{}/pulls/{}/commits'.format(
            repo,
            num
        ))

    def get_commits(self, repo):
        return self.get('/repos/{}/commits'.format(repo))

    def get_repo(self, repo):
        return self.get('/repos/{}'.format(repo))


class GitHubAppsClient(GitHubClientMixin):

    def __init__(self, external_id):
        self.external_id = external_id
        self.token = None
        self.expires_at = None
        super(GitHubAppsClient, self).__init__()

    def get_token(self):
        if not self.token or self.expires_at < datetime.datetime.utcnow():
            res = self.create_token()
            self.token = res['token']
            self.expires_at = datetime.datetime.strptime(
                res['expires_at'],
                '%Y-%m-%dT%H:%M:%SZ',
            )

        return self.token

    def request(self, method, path, headers=None, data=None, params=None):
        if headers is None:
            headers = {
                'Authorization': 'token %s' % self.get_token(),
                # TODO(jess): remove this whenever it's out of preview
                'Accept': 'application/vnd.github.machine-man-preview+json',
            }
        return self._request(method, path, headers=headers, data=data, params=params)

    def create_token(self):
        return self.post(
            '/installations/{}/access_tokens'.format(
                self.external_id,
            ),
            headers={
                'Authorization': 'Bearer %s' % get_jwt(),
                # TODO(jess): remove this whenever it's out of preview
                'Accept': 'application/vnd.github.machine-man-preview+json',
            },
        )

    def get_repositories(self):
        return self.get(
            '/installation/repositories',
        )

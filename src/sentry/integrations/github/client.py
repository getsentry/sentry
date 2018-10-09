from __future__ import absolute_import

from datetime import datetime

from sentry.integrations.github.utils import get_jwt
from sentry.integrations.client import ApiClient, ClientTokenRefresh


class GitHubClientMixin(ApiClient):
    allow_redirects = True

    base_url = 'https://api.github.com'

    def get_jwt(self):
        return get_jwt()

    def get_last_commits(self, repo, end_sha):
        # return api request that fetches last ~30 commits
        # see https://developer.github.com/v3/repos/commits/#list-commits-on-a-repository
        # using end_sha as parameter
        return self.get(
            u'/repos/{}/commits'.format(
                repo,
            ),
            params={'sha': end_sha},
        )

    def compare_commits(self, repo, start_sha, end_sha):
        # see https://developer.github.com/v3/repos/commits/#compare-two-commits
        # where start sha is oldest and end is most recent
        return self.get(u'/repos/{}/compare/{}...{}'.format(
            repo,
            start_sha,
            end_sha,
        ))

    def get_pr_commits(self, repo, num):
        # see https://developer.github.com/v3/pulls/#list-commits-on-a-pull-request
        # Max: 250 Commits
        return self.get(u'/repos/{}/pulls/{}/commits'.format(
            repo,
            num
        ))

    def repo_hooks(self, repo):
        return self.get(u'/repos/{}/hooks'.format(repo))

    def get_commits(self, repo):
        return self.get(u'/repos/{}/commits'.format(repo))

    def get_repo(self, repo):
        return self.get(u'/repos/{}'.format(repo))

    def get_repositories(self):
        repositories = self.get(
            '/installation/repositories',
            params={'per_page': 100},
        )
        return repositories['repositories']

    def search_repositories(self, query):
        return self.get(
            '/search/repositories',
            params={'q': query},
        )

    def get_assignees(self, repo):
        return self.get(u'/repos/{}/assignees'.format(repo))

    def get_issues(self, repo):
        return self.get(u'/repos/{}/issues'.format(repo))

    def search_issues(self, query):
        return self.get(
            '/search/issues',
            params={'q': query},
        )

    def get_issue(self, repo, number):
        return self.get(u'/repos/{}/issues/{}'.format(repo, number))

    def create_issue(self, repo, data):
        endpoint = u'/repos/{}/issues'.format(repo)
        return self.post(endpoint, data=data)

    def create_comment(self, repo, issue_id, data):
        endpoint = u'/repos/{}/issues/{}/comments'.format(repo, issue_id)
        return self.post(endpoint, data=data)

    def get_user(self, gh_username):
        return self.get(u'/users/{}'.format(gh_username))

    def request(self, method, path, headers=None, data=None, params=None):
        headers_merged = {
            # TODO(jess): remove this whenever it's out of preview
            'Accept': 'application/vnd.github.machine-man-preview+json',
        }

        if headers is not None:
            headers_merged.update(headers)

        if 'Authorization' not in headers_merged:
            headers_merged['Authorization'] = 'Token %s' % self.get_token()

        return self._request(method, path, headers=headers_merged, data=data, params=params)

    def get_token(self):
        """
        Get token retrieves the active access token from the integration model.
        Should the token have expried, a new token will be generated and
        automatically presisted into the integration.
        """
        def gh_refresh_strategy(integration, **kwargs):
            res = self.create_token()
            token = res['token']
            expires_at = datetime.strptime(res['expires_at'], '%Y-%m-%dT%H:%M:%SZ')

            # TODO(epurkhsier): Most other integrations simply store the
            # timestamp, not a string representation. We may want to migrate
            # this later.
            integration.metadata.update({
                'access_token': token,
                'expires_at': expires_at.isoformat(),
            })
            integration.save()

            return integration

        token = self.integration.metadata.get('access_token')
        expires_at = self.integration.metadata.get('expires_at')

        if expires_at is not None:
            expires_at = datetime.strptime(expires_at, '%Y-%m-%dT%H:%M:%S')

        ClientTokenRefresh.check_auth(
            self.integration,
            refresh_strategy=gh_refresh_strategy,
            force_refresh=(not token or expires_at < datetime.utcnow()),
        )

        return self.integration.metadata.get('access_token')

    def create_token(self):
        return self.post(
            u'/installations/{}/access_tokens'.format(
                self.integration.external_id,
            ),
            headers={
                'Authorization': 'Bearer %s' % self.get_jwt(),
            },
        )


class GitHubAppsClient(GitHubClientMixin):

    def __init__(self, integration):
        self.integration = integration
        super(GitHubAppsClient, self).__init__()

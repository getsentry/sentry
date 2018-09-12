from __future__ import absolute_import

from six.moves.urllib.parse import quote

from sentry.integrations.client import ApiClient, OAuth2RefreshMixin
from sentry.integrations.exceptions import ApiError


class GitLabApiClient(ApiClient, OAuth2RefreshMixin):
    api_version = '/v4/'

    def __init__(self, base_url, access_token):
        self.base_url = base_url
        self.access_token = access_token

    def request(self, method, path, data=None, params=None, api_preview=False):
        self.check_auth(redirect_url=self.oauth_redirect_url)
        headers = {
            'Authorization': u'Bearer {}'.format(self.identity.data['access_token'])
        }
        return self._request(method, '%s%s' % (self.api_version, path),
                             headers=headers, data=data, params=params)

    def get_user(self):
        return self.request('GET', '/user')

    def get_project(self, repo):
        return self.request('GET', '/projects/{}'.format(quote(repo, safe='')))

    def get_issue(self, repo, issue_id):
        try:
            return self.request(
                'GET',
                '/projects/{}/issues/{}'.format(
                    quote(repo, safe=''),
                    issue_id
                )
            )
        except IndexError:
            raise ApiError('Issue not found with ID', 404)

    def create_issue(self, repo, data):
        return self.request(
            'POST',
            '/projects/{}/issues'.format(quote(repo, safe='')),
            data=data,
        )

    def create_note(self, repo, issue_iid, data):
        return self.request(
            'POST',
            '/projects/{}/issues/{}/notes'.format(
                quote(repo, safe=''),
                issue_iid,
            ),
            data=data,
        )

    def list_project_members(self, repo):
        return self.request(
            'GET',
            '/projects/{}/members'.format(quote(repo, safe='')),
        )

    def search_repositories(self, repo):
        pass

    def search_issues(self, repo):
        pass

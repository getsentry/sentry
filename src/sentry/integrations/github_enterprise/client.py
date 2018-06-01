from __future__ import absolute_import

import datetime

from sentry.integrations.github.utils import get_jwt
from sentry.integrations.github.client import GitHubClientMixin


class GitHubEnterpriseAppsClient(GitHubClientMixin):
    base_url = None

    def __init__(self, base_url, external_id, private_key):
        self.base_url = "https://{}".format(base_url)
        self.external_id = external_id
        self.private_key = private_key
        self.token = None
        self.expires_at = None
        super(GitHubEnterpriseAppsClient, self).__init__()

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
        return self._request(method, path, headers=headers, data=data, params=params,
                             )

    def create_token(self):
        return self.post(
            '/api/v3/installations/{}/access_tokens'.format(
                self.external_id,
            ),
            headers={
                'Authorization': 'Bearer %s' % get_jwt(github_id=self.external_id, github_private_key=self.private_key),
                # TODO(jess): remove this whenever it's out of preview
                'Accept': 'application/vnd.github.machine-man-preview+json',
            },
        )

    def get_repositories(self):
        return self.get(
            '/installation/repositories',
        )

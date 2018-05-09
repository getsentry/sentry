from __future__ import absolute_import

from sentry import http
from sentry import options
from sentry.identity.oauth2 import OAuth2Provider


def get_user_info(access_token):
    session = http.build_session()
    resp = session.get(
        'https://api.github.com/user',
        params={'access_token': access_token},
        headers={'Accept': 'application/vnd.github.machine-man-preview+json'}
    )
    resp.raise_for_status()
    resp = resp.json()

    return resp


class GitHubEnterpriseIdentityProvider(OAuth2Provider):
    key = 'github-enterprise'
    name = 'GitHub Enterprise'

    # oauth_access_token_url = 'https://github.com/login/oauth/access_token'
    # oauth_authorize_url = 'https://github.com/login/oauth/authorize'

    oauth_scopes = ()

    def get_oauth_client_id(self):
        return options.get('github-app.client-id')

    def get_oauth_client_secret(self):
        return options.get('github-app.client-secret')

    def build_identity(self, data):
        import ipdb;
        ipdb.set_trace()
        data = data['data']
        user = get_user_info(data['access_token'])

        return {
            'type': 'github-enterprise',
            'id': user['id'],
            'email': user['email'],
            'scopes': [],  # GitHub apps do not have user scopes
            'data': self.get_oauth_data(data),
        }

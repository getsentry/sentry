from __future__ import absolute_import

from sentry import options
from sentry.identity.oauth2 import OAuth2Provider


class GitHubIdentityProvider(OAuth2Provider):
    key = 'github'
    name = 'GitHub'

    oauth_access_token_url = 'https://github.com/login/oauth/access_token'
    oauth_authorize_url = 'https://github.com/login/oauth/authorize'

    oauth_scopes = ()

    def get_oauth_client_id(self):
        return options.get('github.client-id')

    def get_oauth_client_secret(self):
        return options.get('github.client-secret')

    def build_identity(self, data):
        data = data['data']

        return {
            'type': 'github',
            'id': data['user']['id'],
            'email': data['user']['email'],
            'scopes': sorted(data['scope'].split(',')),
            'data': self.get_oauth_data(data),
        }

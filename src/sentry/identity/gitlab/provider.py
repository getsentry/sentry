from __future__ import absolute_import

from sentry.identity.oauth2 import OAuth2Provider


class GitlabIdentityProvider(OAuth2Provider):
    key = 'gitlab'
    name = 'Gitlab'

    oauth_scopes = (
        'api',
        'sudo',
    )

    def build_identity(self, data):
        data = data['data']

        return {
            'type': 'gitlab',
            'id': data['user']['id'],
            'email': data['user']['email'],
            'scopes': sorted(data['scope'].split(',')),
            'data': self.get_oauth_data(data),
        }

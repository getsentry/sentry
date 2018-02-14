from __future__ import absolute_import

from sentry import options
from sentry.options.manager import FLAG_PRIORITIZE_DISK
from sentry.identity.oauth2 import OAuth2Provider

options.register('gitlab.client-id', flags=FLAG_PRIORITIZE_DISK)
options.register('gitlab.client-secret', flags=FLAG_PRIORITIZE_DISK)
options.register('gitlab.url', flags=FLAG_PRIORITIZE_DISK)


class GitLabIdentityProvider(OAuth2Provider):

    key = 'gitlab'
    name = 'Gitlab'

    oauth_scopes = (
        'read_user',
        'api',
    )

    def get_oauth_client_id(self):
        return options.get('gitlab.client-id')

    def get_oauth_client_secret(self):
        return options.get('gitlab.client-secret')

    def get_oauth_access_token_url(self):
        return '{}/oauth/token'.format(options.get('gitlab.url'))

    def get_oauth_authorize_url(self):
        return '{}/oauth/authorize'.format(options.get('gitlab.url'))

    def get_oauth_refresh_token_url(self):
        pass

    def build_identity(self, data):
        data = data['data']
#        TODO: (iSDP) fix this
        return {
            'type': 'gitlab',
            'id': data['user']['id'],
            'email': data['user']['email'],
            'scopes': sorted(data['scope'].split(',')),
            'data': self.get_oauth_data(data),
        }

    def get_pipeline(self):
        pass

    def refresh_identity(self, auth_identity):
        pass
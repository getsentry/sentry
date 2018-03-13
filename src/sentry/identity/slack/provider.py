from __future__ import absolute_import

from sentry import options
from sentry.options.manager import FLAG_PRIORITIZE_DISK
from sentry.identity.oauth2 import OAuth2Provider

options.register('slack.client-id', flags=FLAG_PRIORITIZE_DISK)
options.register('slack.client-secret', flags=FLAG_PRIORITIZE_DISK)
options.register('slack.verification-token', flags=FLAG_PRIORITIZE_DISK)


class SlackIdentityProvider(OAuth2Provider):
    key = 'slack'
    name = 'Slack'

    oauth_access_token_url = 'https://slack.com/api/oauth.access'
    oauth_authorize_url = 'https://slack.com/oauth/authorize'

    oauth_scopes = (
        'identity.basic',
        'identity.email',
    )

    def get_oauth_client_id(self):
        return options.get('slack.client-id')

    def get_oauth_client_secret(self):
        return options.get('slack.client-secret')

    def build_identity(self, data):
        data = data['data']

        return {
            'type': 'slack',
            'id': data['user']['id'],
            'email': data['user']['email'],
            'scopes': sorted(data['scope'].split(',')),
            'data': self.get_oauth_data(data),
        }

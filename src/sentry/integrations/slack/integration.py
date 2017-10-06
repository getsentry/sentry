from __future__ import absolute_import

from sentry import options
from sentry.integrations import OAuth2Integration

options.register('slack.client-id')
options.register('slack.client-secret')
options.register('slack.verification-token')


class SlackIntegration(OAuth2Integration):
    id = 'slack'
    name = 'Slack'

    oauth_access_token_url = 'https://slack.com/api/oauth.access'
    oauth_authorize_url = 'https://slack.com/oauth/authorize'
    oauth_scopes = tuple(sorted((
        'bot',
        'chat:write:bot',
        'commands',
        'links:read',
        'links:write',
        'team:read',
    )))

    def get_oauth_client_id(self):
        return options.get('slack.client-id')

    def get_oauth_client_secret(self):
        return options.get('slack.client-secret')

    def get_config(self):
        return [{
            'name': 'unfurl_urls',
            'label': 'Unfurl URLs',
            'type': 'bool',
            'help': 'Unfurl any URLs which reference a Sentry issue.',
        }]

    def build_integration(self, state):
        data = state['data']
        assert data['ok']
        return {
            'external_id': data['team_id'],
            'name': data['team_name'],
            # TODO(dcramer): we should probably store an Identity for the bot,
            # and just skip associating them with a user?
            'metadata': {
                'bot_access_token': data['bot']['bot_access_token'],
                'bot_user_id': data['bot']['bot_user_id'],
                # XXX: should this be stored with OrganizationIntegration?
                # is there any concern of access?
                'access_token': data['access_token'],
                'scopes': sorted(data['scope'].split(',')),
            },
            'identity': self.build_identity(state)
        }

    def build_identity(self, state):
        data = state['data']
        return {
            'type': 'slack',
            'instance': 'slack.com',
            'external_id': data['user_id'],
            'scopes': sorted(data['scope'].split(',')),
            'data': {
                'access_token': data['access_token'],
            },
        }

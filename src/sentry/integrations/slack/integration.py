from __future__ import absolute_import

from sentry.integrations import Integration, IntegrationMetadata
from sentry.utils.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri

DESCRIPTION = """
Define a relationship between Sentry and your Slack workspace(s).

 * Unfurls Sentry URLs in slack, providing context and actionability on issues
   directly within your Slack workspace.
 * Resolve, ignore, and assign issues with minimal context switching.
 * Configure rule based Slack notifications to automatically be posted into the
   specified channel.
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Slack%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack'
)


class SlackIntegration(Integration):
    key = 'slack'
    name = 'Slack'
    metadata = metadata

    identity_oauth_scopes = frozenset([
        'bot',
        'channels:read',
        'chat:write:bot',
        'commands',
        'links:read',
        'links:write',
        'team:read',
    ])

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': self.identity_oauth_scopes,
            'redirect_url': absolute_uri('/extensions/slack/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='slack',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def build_integration(self, state):
        data = state['identity']['data']
        assert data['ok']

        scopes = sorted(data['scope'].split(','))

        return {
            'name': data['team_name'],
            'external_id': data['team_id'],
            'metadata': {
                'access_token': data['access_token'],
                'bot_access_token': data['bot']['bot_access_token'],
                'bot_user_id': data['bot']['bot_user_id'],
                'scopes': scopes,
            },
            'user_identity': {
                'type': 'slack',
                'external_id': data['user_id'],
                'scopes': scopes,
                'data': {
                    'access_token': data['access_token'],
                },
            },
        }

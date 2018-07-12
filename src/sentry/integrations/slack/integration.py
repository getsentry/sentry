from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _

from sentry import http
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations import (
    IntegrationFeatures, IntegrationMetadata, IntegrationProvider,
)
from sentry.pipeline import NestedPipelineView
from sentry.utils.http import absolute_uri

DESCRIPTION = """
Connect your Sentry organization to one or more Slack workspaces, and start
getting errors right in front of you where all the action happens in your
office!

 * Unfurls Sentry URLs directly within Slack, providing you context and
   actionability on issues right at your fingertips.
 * Resolve, ignore, and assign issues with minimal context switching.
 * Configure rule based Slack notifications to automatically be posted into a
   specific channel. Want any error that's happening more than 100 times a
   minute to be posted in `#critical-errors`? Setup a rule for it!
"""

setup_alert = {
    'type': 'info',
    'text': 'The Slack integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to Slack you must create a rule using the slack workspace action in your project settings.',
}

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    author='The Sentry Team',
    noun=_('Workspace'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Slack%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack',
    aspects={
        'alerts': [setup_alert],
    }
)


class SlackIntegrationProvider(IntegrationProvider):
    key = 'slack'
    name = 'Slack'
    metadata = metadata
    features = frozenset([
        IntegrationFeatures.NOTIFICATION,
        IntegrationFeatures.CHAT_UNFURL,
    ])

    identity_oauth_scopes = frozenset([
        'channels:read',
        'groups:read',
        'users:read',
        'chat:write',
        'links:read',
        'links:write',
        'team:read',
    ])

    setup_dialog_config = {
        'width': 600,
        'height': 900,
    }

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

    def get_team_info(self, access_token):
        payload = {
            'token': access_token,
        }

        session = http.build_session()
        resp = session.get('https://slack.com/api/team.info', params=payload)
        resp.raise_for_status()
        resp = resp.json()

        return resp['team']

    def build_integration(self, state):
        data = state['identity']['data']
        assert data['ok']

        scopes = sorted(self.identity_oauth_scopes)
        team_data = self.get_team_info(data['access_token'])

        return {
            'name': data['team_name'],
            'external_id': data['team_id'],
            'metadata': {
                'access_token': data['access_token'],
                'scopes': scopes,
                'icon': team_data['icon']['image_132'],
                'domain_name': team_data['domain'] + '.slack.com',
            },
            'user_identity': {
                'type': 'slack',
                'external_id': data['authorizing_user_id'],
                'scopes': [],
                'data': {},
            },
        }

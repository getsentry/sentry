from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _

from sentry import http
from sentry.integrations import IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView
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

alert_link = {
    'text': 'Looking to send Sentry alerts to Slack? Add an **Alert Rule** for this project.',
    'link': '/settings/{orgId}/{projectId}/alerts/rules/'
}

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Workspace'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Slack%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack',
    aspects={
        'alert_link': alert_link,
    }
)


class SlackIntegrationProvider(IntegrationProvider):
    key = 'slack'
    name = 'Slack'
    metadata = metadata

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

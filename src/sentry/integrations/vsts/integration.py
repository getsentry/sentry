from __future__ import absolute_import
from sentry.integrations import Integration, IntegrationMetadata
from sentry.utils.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri
DESCRIPTION = """
VSTS
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    issue_url='https://github.com/getsentry/sentry/issues/new?title=VSTS%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vsts',
    aspects={},
)


class VSTSIntegration(Integration):
    key = 'vsts'
    name = 'VSTS'
    metadata = metadata

    setup_dialog_config = {
        'width': 600,
        'height': 800,
    }

    identity_oauth_scopes = frozenset([
        'vso.code_full',
        'vso.identity_manage',
        'vso.work_full',
    ])

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': self.identity_oauth_scopes,
            'redirect_url': absolute_uri('/extensions/vsts/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='vsts',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def get_config(self):
        return [{
            'name': 'name',
            'label': 'Name',
            'type': 'text',
            'required': True,
        }]

    def build_integration(self, state):
        data = state['identity']['data']

        scopes = sorted(self.identity_oauth_scopes)
        team_data = self.get_team_info(data['access_token'])

        return {
            'name': data['team_name'],
            'external_id': state['team_id'],
            'metadata': {
                'access_token': data['access_token'],
                'scopes': scopes,
                'icon': team_data['icon'],
                'domain_name': team_data['domain'],
            },
            'user_identity': {
                'type': 'vsts',
                'external_id': data['installer_user_id'],
                'scopes': [],
                'data': {},
            },
        }

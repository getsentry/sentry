from __future__ import absolute_import

from sentry.integrations import Integration
from sentry.integrations.gitlab.repository_provider import GitLabRepositoryProvider
from sentry.utils.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri


class GitLabIntegration(Integration):
    key = 'gitlab'
    name = 'GitLab'
    identity_oauth_scopes = (
        'read_user',
        'api',
    )

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': self.identity_oauth_scopes,
            'redirect_url': absolute_uri('/extensions/gitlab/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='gitlab',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def build_integration(self, state):
        data = state['identity']['data']
        assert data['ok']

        scopes = sorted(data['scope'].split(','))
#       TODO: (iSDP) Fix this so it shows actual values
        return {
            'name': data['team_name'],
            'external_id': data['team_id'],
            'metadata': {
                'access_token': data['access_token'],
                'scopes': scopes,
            },
            'user_identity': {
                'type': 'gitlab',
                'external_id': data['user_id'],
                'scopes': scopes,
                'data': {
                    'access_token': data['access_token'],
                },
            },
        }

#    TODO: (iSDP) Bindings is undefined for now
#    def setup(self):
#        bindings.add('repository.provider', GitLabRepositoryProvider, key='gitlab')

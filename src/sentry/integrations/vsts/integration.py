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

    identity_oauth_scopes = frozenset([
        # there are more and this is probably the wrong format. jsut putting it down here.
        'vso.build_execute',
        'vso.code_manage',
        'vso.project_manage',
    ])

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': self.identity_oauth_scopes,
            'redirect_url': absolute_uri('/extensions/vsts/setup/'),  # where does this go?
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='vsts',
            pipeline_cls=IdentityProviderPipeline,  # how do we get to the VSTS provider?
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def build_integration(self, state):
        return {
            'external_id': state['name'],
        }

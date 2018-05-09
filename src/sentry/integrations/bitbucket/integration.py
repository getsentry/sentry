from __future__ import absolute_import

from sentry.integrations import IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext_lazy as _
DESCRIPTION = """
Bitbucket for Sentry.io
"""
metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Repository'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
    aspects={},
)


class BitbucketIntegrationProvider(IntegrationProvider):
    key = 'bitbucket'
    name = 'Bitbucket'
    metadata = metadata

    def get_pipeline_views(self):
        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='bitbucket',
            pipeline_cls=IdentityProviderPipeline,
        )

        return [
            identity_pipeline_view,
        ]

    def build_integration(self, state):
        user_data = state['user']
        user_links = user_data['links']['self']
        return {
            'provider': 'bitbucket',
            'external_id': state['clientKey'],
            'name': 'Bitbucket',
            'metadata': {
                'public_key': state['publicKey'],
                'shared_secret': state['sharedSecret'],
                'base_url': state['baseUrl'],
                'domain_name': state['baseUrl'].replace('https://', ''),
            },
            'user_identity': {
                'type': 'bitbucket',
                'name': user_data['username'],
                'display_name': user_data['display_name'],
                'account_id': user_data['account_id'],
                'icon': user_links['avatar'],
            }
        }

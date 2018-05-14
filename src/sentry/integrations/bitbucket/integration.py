from __future__ import absolute_import

from sentry.integrations import IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext_lazy as _
from sentry.utils.http import absolute_uri
from sentry.models import Integration
DESCRIPTION = """
Bitbucket for Sentry.io
"""
metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Bitbucket Account'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
    aspects={},
)


class BitbucketIntegrationProvider(IntegrationProvider):
    key = 'bitbucket'
    name = 'Bitbucket'
    metadata = metadata

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'redirect_url': absolute_uri('/extensions/bitbucket/setup/'),
        }
        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='bitbucket',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [
            identity_pipeline_view,
        ]

    def build_integration(self, state):
        if state.get('publicKey'):
            user_data = state['user']
            return {
                'provider': 'bitbucket',
                'external_id': state['clientKey'],
                'name': user_data['display_name'],
                'metadata': {
                    'public_key': state['publicKey'],
                    'shared_secret': state['sharedSecret'],
                    'base_url': state['baseUrl'],
                    'domain_name': user_data['links']['html']['href'].replace('https://', ''),
                    'icon': user_data['links']['avatar']['href'],
                },
                'user_identity': {
                    'type': 'bitbucket',
                    'name': user_data['username'],
                    'display_name': user_data['display_name'],
                    'account_id': user_data['account_id'],
                    'icon': user_data['links']['avatar']['href'],
                }
            }

        integration = Integration.objects.get(
            provider='bitbucket',
            external_id=state['identity']['bitbucket_client_id']
        )
        return {
            'provider': 'bitbucket',
            'external_id': integration.external_id,
            'name': integration.name,
            'metadata': {
                'public_key': integration.metadata['public_key'],
                'shared_secret': integration.metadata['shared_secret'],
                'base_url': integration.metadata['base_url'],
                'domain_name': integration.metadata['domain_name'],
            },
        }

from __future__ import absolute_import

from sentry.integrations import Integration, IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext_lazy as _
from sentry.utils.http import absolute_uri

from .repository import BitbucketRepositoryProvider
from .client import BitbucketApiClient

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
scopes = (
    'account',
    'issue:write',
    'repository',
    'team',
    'webhook',
)


class BitbucketIntegration(Integration):
    def get_client(self):
        return BitbucketApiClient(
            self.model.metadata['base_url'],
            self.model.metadata['shared_secret'],
            self.model.external_id,
        )


class BitbucketIntegrationProvider(IntegrationProvider):
    key = 'bitbucket'
    name = 'Bitbucket'
    metadata = metadata
    scopes = scopes
    integration_cls = BitbucketIntegration

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
        return [identity_pipeline_view]

    def build_integration(self, state):
        # TODO(LB): Add verification for clientKey
        if state.get('publicKey'):
            principal_data = state['principal']
            return {
                'provider': 'bitbucket',
                'external_id': state['clientKey'],
                'name': principal_data['username'],
                'metadata': {
                    'public_key': state['publicKey'],
                    'shared_secret': state['sharedSecret'],
                    'base_url': state['baseApiUrl'],
                    'domain_name': principal_data['links']['html']['href'].replace('https://', ''),
                    'icon': principal_data['links']['avatar']['href'],
                    'scopes': self.scopes,
                    'uuid': principal_data['uuid'],
                    'type': principal_data['type'],  # team or user account
                },
            }
        return {
            'provider': 'bitbucket',
            'external_id': state['identity']['bitbucket_client_key'],
            'expect_exists': True,
        }

    def setup(self):
        from sentry.plugins import bindings
        bindings.add(
            'integration-repository.provider',
            BitbucketRepositoryProvider,
            id='integrations:bitbucket',
        )

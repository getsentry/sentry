from __future__ import absolute_import

from sentry.integrations import IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext_lazy as _
DESCRIPTION = """
BitBucket for Sentry.io
"""
metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Repository'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
    aspects={},
)


class BitBucketIntegrationProvider(IntegrationProvider):
    key = 'bitbucket'
    name = 'BitBucket'
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
        raise NotImplementedError

from __future__ import absolute_import

from sentry.integrations import Integration, IntegrationMetadata
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
DESCRIPTION = """
BitBucket
"""
# TODO(LB): Put something real in here
metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun='bitbucket?',
    issue_url='',
    source_url='',
    aspects={},
)


class BitBucketIntegration(Integration):
    """
    Description
    """
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
        return {
            'external_id': state['name'],
        }

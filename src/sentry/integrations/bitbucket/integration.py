from __future__ import absolute_import

from sentry.integrations import Integration, IntegrationMetadata
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

    def build_integration(self, state):
        return {
            'external_id': state['name'],
        }

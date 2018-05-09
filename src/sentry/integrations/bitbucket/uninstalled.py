from __future__ import absolute_import

from sentry.integrations.atlassian_connect import AtlassianConnectUninstalledEndpoint
from .integration import BitbucketIntegrationProvider


class BitbucketUninstalledEndpoint(AtlassianConnectUninstalledEndpoint):
    def get_key(self):
        return 'bitbucket'

    def get_integration_provider(self):
        return BitbucketIntegrationProvider()

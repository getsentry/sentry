from __future__ import absolute_import

from sentry.integrations.atlassian_connect import AtlassianConnectInstalledEndpoint
from .integration import BitbucketIntegrationProvider


class BitbucketInstalledEndpoint(AtlassianConnectInstalledEndpoint):
    def get_key(self):
        return 'bitbucket'

    def get_integration_provider(self):
        return BitbucketIntegrationProvider()

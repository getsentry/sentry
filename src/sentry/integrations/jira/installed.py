from __future__ import absolute_import

from sentry.integrations.atlassian_connect import AtlassianConnectInstalledEndpoint
from .integration import JiraIntegrationProvider


class JiraInstalledEndpoint(AtlassianConnectInstalledEndpoint):
    def get_key(self):
        return 'jira'

    def get_integration_provider(self):
        return JiraIntegrationProvider()

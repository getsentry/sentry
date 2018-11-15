from __future__ import absolute_import

from sentry.integrations.jira_server import JiraServerIntegrationProvider
from sentry.identity.jira_server import JiraServerIdentityProvider
from sentry.testutils import IntegrationTestCase


class JiraServerIntegrationTest(IntegrationTestCase):
    provider = JiraServerIntegrationProvider

    def test_temporary_identity_provider(self):
        provider = JiraServerIdentityProvider()
        state = {'id': 'identity-id'}
        assert provider.build_identity(state) == {
            'type': 'jira_server',
            'id': state['id'],
            'name': 'Jira Server',
        }

    def test_temporary_integration_provider(self):
        provider = JiraServerIntegrationProvider()
        state = {
            'identity': {'data': {'id': 'user-id'}},
            'base_url': 'https://jira-server.com/',
            'id': 'integration-id',
        }
        assert provider.build_integration(state) == {
            'provider': 'jira_server',
            'external_id': '%s:%s' % (state['base_url'], state['id']),
            'user_identity': {
                'type': 'jira_server',
                'external_id': '%s:%s' % (state['base_url'], state['identity']['data']['id'])
            }
        }

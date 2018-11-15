from __future__ import absolute_import

from sentry.identity.base import Provider


class JiraServerIdentityProvider(Provider):
    name = 'Jira Server'
    key = 'jira_server'

    def build_identity(self, state):
        # TODO(lb): This is wrong. Not currently operational.
        # this should be implemented.
        return {
            'type': 'jira_server',
            'id': state['id'],
            'name': 'Jira Server',
        }

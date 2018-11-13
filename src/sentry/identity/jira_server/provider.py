from __future__ import absolute_import

# from sentry.pipeline import PipelineView
# from sentry.utils.http import absolute_uri
from sentry.identity.base import Provider


class JiraServerIdentityProvider(Provider):
    name = 'Jira Server'
    key = 'jira_server'

    # oauth_scopes = ('api', )

    # def build_identity(self, data):
    #     data = data['data']

    #     return {
    #         'type': 'gitlab',
    #         'id': data['user']['id'],
    #         'email': data['user']['email'],
    #         'scopes': sorted(data['scope'].split(',')),
    #         'data': self.get_oauth_data(data),
    #     }

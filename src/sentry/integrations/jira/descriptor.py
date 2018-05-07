from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.utils.http import absolute_uri

from .client import JIRA_KEY


class JiraDescriptorEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        return self.respond(
            {
                'name': 'Sentry',
                'description': 'Sentry',
                'key': JIRA_KEY,
                'baseUrl': absolute_uri(),
                'vendor': {
                    'name': 'Sentry',
                    'url': 'https://sentry.io'
                },
                'authentication': {
                    'type': 'jwt'
                },
                'lifecycle': {
                    'installed': '/extensions/jira/installed/',
                    'uninstalled': '/extensions/jira/uninstalled/',
                },
                'apiVersion': 1,
                'modules': {
                    'configurePage': {
                        'url': '/extensions/jira/configure',
                        'name': {
                            'value': 'Configure Sentry Add-on'
                        },
                        'key': 'configure-sentry'
                    },
                },
                'scopes': [
                    'read',
                    'write',
                    'act_as_user',
                ]
            }
        )

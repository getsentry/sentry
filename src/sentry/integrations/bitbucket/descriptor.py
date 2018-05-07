from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.utils.http import absolute_uri


class BitBucketDescriptorEndpoint(Endpoint):
    def get(self, request):
        self.respond(
            {
                'key': 'sentry-bitbucket',
                'name': 'Sentry Bitbucket',
                'description': 'A sentry integration',
                'vendor': {
                    'name': 'Sentry.io',
                    'url': 'https://sentry.io/'
                },
                'baseUrl': absolute_uri(),
                'authentication': {
                    'type': 'jwt'
                },
                'lifecycle': {
                    'installed': '/extensions/bitbucket/installed/',
                    'uninstalled': '/extensions/bitbucket/uninstalled/'
                },
                'scopes': ['account', 'repository'],
                'contexts': ['account']
            }
        )

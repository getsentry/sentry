from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.utils.http import absolute_uri
from .client import BITBUCKET_KEY


class BitbucketDescriptorEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        return self.respond(
            {
                'key': BITBUCKET_KEY,
                'name': 'Sentry for Bitbucket',
                'description': 'A Sentry integration',
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

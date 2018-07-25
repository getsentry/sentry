from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.utils.http import absolute_uri

from .client import BITBUCKET_KEY
from sentry.integrations.bitbucket.integration import scopes


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
                    'type': 'JWT',
                },
                'lifecycle': {
                    'installed': '/extensions/bitbucket/installed/',
                    'uninstalled': '/extensions/bitbucket/uninstalled/'
                },
                'scopes': scopes,
                'contexts': ['account'],
                # When the user is redirected the URL will become:
                # https://sentry.io/extensions/bitbucket/installed/done?account=%7B23232323%7D&jwt=1212121212
                # Where the account parameter is a UUID and the jwt parameter is what
                # you'll use to verify the URL
                'modules': {
                    'postInstallRedirect': {
                        'url': '/extensions/bitbucket/installed/done?account={target_user.username}',
                        'key': 'redirect'
                    }
                }
            }
        )

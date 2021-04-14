from sentry.api.base import Endpoint
from sentry.integrations.bitbucket.integration import scopes
from sentry.utils.http import absolute_uri

from .client import BITBUCKET_KEY


class BitbucketDescriptorEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        return self.respond(
            {
                "key": BITBUCKET_KEY,
                "name": "Sentry for Bitbucket",
                "description": "A Sentry integration",
                "vendor": {"name": "Sentry.io", "url": "https://sentry.io/"},
                "baseUrl": absolute_uri(),
                "authentication": {"type": "JWT"},
                "lifecycle": {
                    "installed": "/extensions/bitbucket/installed/",
                    "uninstalled": "/extensions/bitbucket/uninstalled/",
                },
                "scopes": scopes,
                "contexts": ["account"],
                # When the user is redirected the URL will become:
                # https://sentry.io/extensions/bitbucket/setup/?jwt=1212121212
                "modules": {
                    "postInstallRedirect": {
                        "url": "/extensions/bitbucket/setup/",
                        "key": "redirect",
                    }
                },
            }
        )

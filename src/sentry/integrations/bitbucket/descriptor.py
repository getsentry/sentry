from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.integrations.bitbucket.integration import scopes
from sentry.utils.http import absolute_uri

from .client import BITBUCKET_KEY


@control_silo_endpoint
class BitbucketDescriptorEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request: Request) -> Response:
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

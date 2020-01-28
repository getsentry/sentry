from __future__ import absolute_import

from django.conf import settings
from social_core.backends.asana import AsanaOAuth2 as _AsanaOAuth2


class AsanaOAuth2(_AsanaOAuth2):
    def get_key_and_secret(self):
        # TODO(joshuarli): maybe read from AUTH_PROVIDERS instead of here
        return settings.ASANA_CLIENT_ID, settings.ASANA_CLIENT_SECRET

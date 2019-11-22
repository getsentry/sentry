from __future__ import absolute_import

import logging

from sentry.exceptions import PluginError

from sentry_plugins.base import CorePluginMixin

from .client import BitbucketClient


class BitbucketMixin(CorePluginMixin):
    logger = logging.getLogger("sentry.plugins.bitbucket")

    title = "Bitbucket"

    def get_client(self, user):
        auth = self.get_auth(user=user)
        if auth is None:
            raise PluginError("You still need to associate an identity with Bitbucket.")
        return BitbucketClient(auth)

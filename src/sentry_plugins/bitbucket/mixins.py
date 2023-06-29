from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry.exceptions import PluginError
from sentry_plugins.base import CorePluginMixin

from .client import BitbucketClient

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise


class BitbucketMixin(CorePluginMixin):
    logger = logging.getLogger("sentry.plugins.bitbucket")

    title: str | _StrPromise = "Bitbucket"

    def get_client(self, user):
        auth = self.get_auth(user=user)
        if auth is None:
            raise PluginError("You still need to associate an identity with Bitbucket.")
        return BitbucketClient(auth)

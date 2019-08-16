from __future__ import absolute_import

from sentry.utils.services import Service


class RateLimiter(Service):
    __all__ = ("is_limited", "validate")

    window = 60

    def is_limited(self, key, limit, project=None, window=None):
        return False

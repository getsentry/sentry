import time
from collections.abc import Mapping

import pymemcache
from django.core.cache.backends.memcached import PyMemcacheCache

from sentry.utils import metrics


class ReconnectingMemcache(PyMemcacheCache):
    """
    A django cache adapter adds periodic reconnecting
    to PyMemcacheCache.

    Periodically this adapter will close and reconnect the underlying
    cache adapter to help even out load on Twemproxy.
    """

    _class: pymemcache.Client
    _options: Mapping[str, str] | None = None

    def __init__(self, server, params) -> None:
        self._reconnect_age: int = params.get("OPTIONS", {}).pop("reconnect_age", 300)
        self._last_reconnect_at: float = time.time()
        self._backend: pymemcache.Client | None = None

        super().__init__(server, params)

    @property
    def _cache(self) -> pymemcache.Client | None:
        """
        Overload PyMemcacheCache._cache with periodic reconnections.
        """
        age = time.time() - self._last_reconnect_at
        if age >= self._reconnect_age and self._backend:
            # Close the underlying cache connection if we haven't done that recently.
            metrics.incr("cache.memcache.reconnect")
            self._backend.close()
            self._backend = None

        if not self._backend:
            self._backend = self._class(self.client_servers, **self._options)
            self._last_reconnect_at = time.time()

        return self._backend

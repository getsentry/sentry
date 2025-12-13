import time

from django.core.cache.backends.base import DEFAULT_TIMEOUT, BaseCache
from django.core.cache.backends.memcached import PyMemcacheCache

from sentry.utils import metrics


class ReconnectingMemcache(BaseCache):
    """
    A django cache adapter that wraps a Pymemcache adapter.
    Periodically, this adapter will close and reconnect the underlying
    cache adapter to help even out load on Twemproxy.
    """

    def __init__(self, server, params) -> None:
        self._reconnect_age: int = params.get("OPTIONS", {}).pop("reconnect_age", 300)

        super().__init__(params)
        self._server = server
        self._params = params
        self._backend: BaseCache | None = None
        self._last_reconnect_at: float = time.time()

    def _get_backend(self) -> BaseCache:
        """
        Get the wrapped backend. Will close the wrapped connection
        if it has reached the `reconnect_age`.
        """
        age = time.time() - self._last_reconnect_at
        if age >= self._reconnect_age and self._backend:
            # Close the underlying cache connection if we haven't done that recently.
            metrics.incr("cache.memcache.reconnect")
            self._backend.close()
            self._backend = None

        if not self._backend:
            self._backend = PyMemcacheCache(self._server, self._params)
            self._last_reconnect_at = time.time()

        return self._backend

    def add(self, key, value, timeout=DEFAULT_TIMEOUT, version=None):
        return self._get_backend().add(key, value, timeout=timeout, version=version)

    def get(self, key, default=None, version=None):
        return self._get_backend().get(key, default=default, version=version)

    def set(self, key, value, timeout=DEFAULT_TIMEOUT, version=None):
        return self._get_backend().set(key, value, timeout=timeout, version=version)

    def delete(self, key, version=None):
        return self._get_backend().delete(key, version=version)

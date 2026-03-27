import contextvars
import threading
import time
from collections.abc import Mapping
from typing import NamedTuple

import pymemcache
from django.core.cache.backends.memcached import PyMemcacheCache

from sentry.utils import metrics


class _BackendState(NamedTuple):
    thread_id: int
    created_at: float
    client: pymemcache.Client


class ReconnectingMemcache(PyMemcacheCache):
    """
    A django cache adapter adds periodic reconnecting
    to PyMemcacheCache.

    Periodically this adapter will close and reconnect the underlying
    cache adapter to help even out load on Twemproxy.

    Each thread gets its own pymemcache client instance. This is
    necessary because pymemcache's HashClient is not thread-safe for
    concurrent access (e.g. the _retry_dead method races on a shared
    dict). Cross-thread sharing can happen when contextvars are
    copied via copy_context(), since Django's CacheHandler stores
    connections in a contextvar. We detect this by checking the
    thread ID and creating a fresh client when a copied context is
    accessed from a different thread.
    """

    _class: pymemcache.Client
    _options: Mapping[str, str] | None = None

    def __init__(self, server, params) -> None:
        self._reconnect_age: int = params.get("OPTIONS", {}).pop("reconnect_age", 300)
        self._backend_var: contextvars.ContextVar[_BackendState | None] = contextvars.ContextVar(
            f"reconnecting_memcache_{id(self)}", default=None
        )

        super().__init__(server, params)

    @property
    def _cache(self) -> pymemcache.Client:
        """
        Return a per-thread pymemcache client, reconnecting periodically
        to distribute load across Twemproxy instances.
        """
        current_tid = threading.get_ident()
        state = self._backend_var.get()

        if state is not None:
            # Context was copied to a different thread (e.g. via
            # ContextPropagatingThreadPoolExecutor). pymemcache's
            # HashClient isn't thread-safe, so create a new client.
            if state.thread_id != current_tid:
                state = None
            elif time.time() - state.created_at >= self._reconnect_age:
                state.client.close()
                metrics.incr("cache.memcache.reconnect")
                state = None

        if state is None:
            client = self._class(self.client_servers, **self._options)
            state = _BackendState(
                thread_id=current_tid,
                created_at=time.time(),
                client=client,
            )
            self._backend_var.set(state)

        return state.client

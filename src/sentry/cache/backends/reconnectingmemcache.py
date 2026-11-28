import socket
import threading
import time
from collections.abc import Mapping, Sequence
from typing import Any, NamedTuple, cast

import pymemcache
from django.core.cache.backends.memcached import PyMemcacheCache  # noqa: S018

from sentry.utils import metrics


class _ThreadClient(NamedTuple):
    created_at: float
    client: pymemcache.Client


class _ThreadClients(threading.local):
    def __init__(self) -> None:
        self.by_key: dict[str, _ThreadClient] = {}


_thread_clients = _ThreadClients()


def _is_unusable(sock: socket.socket) -> bool:
    timeout = sock.gettimeout()
    sock.settimeout(0)
    try:
        # memcached only sends replies, so an idle socket has nothing to read
        # unless the server closed it.
        sock.recv(1, socket.MSG_PEEK)
    except BlockingIOError:
        return False
    except OSError:
        return True
    finally:
        sock.settimeout(timeout)
    return True


def _close_dropped_connections(client: pymemcache.Client) -> None:
    for server_client in client.clients.values():
        sock = getattr(server_client, "sock", None)
        if sock is not None and _is_unusable(sock):
            server_client.close()
            metrics.incr("cache.memcache.dropped_connection")


class ReconnectingMemcache(PyMemcacheCache):
    """
    A PyMemcacheCache that closes and reconnects its client periodically
    to help even out load on Twemproxy.

    pymemcache's HashClient isn't thread-safe, so each thread keeps its own
    client, shared by every backend with the same servers and options.
    """

    _class: pymemcache.Client
    _options: Mapping[str, str] | None = None

    def __init__(self, server: str | Sequence[str], params: dict[str, object]) -> None:
        # Django passes every backend of an alias the same OPTIONS dict.
        options = dict(cast("dict[str, Any]", params.get("OPTIONS") or {}))
        self._reconnect_age: int = options.pop("reconnect_age", 300)

        super().__init__(server, {**params, "OPTIONS": options})

        # repr copes with option values that can't be hashed.
        self._client_key = repr((self.client_servers, sorted((self._options or {}).items())))

    @property
    def _cache(self) -> pymemcache.Client:
        """
        Return this thread's client, replacing it once it reaches reconnect_age.
        Connections the server closed are dropped, so the command reconnects.
        """
        clients = _thread_clients.by_key
        state = clients.get(self._client_key)

        if state is not None and time.time() - state.created_at >= self._reconnect_age:
            state.client.close()
            metrics.incr("cache.memcache.reconnect")
            state = None

        if state is None:
            client = self._class(self.client_servers, **(self._options or {}))
            state = clients[self._client_key] = _ThreadClient(time.time(), client)
        else:
            _close_dropped_connections(state.client)

        return state.client

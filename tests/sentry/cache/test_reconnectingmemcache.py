import contextvars
import time
from concurrent.futures import ThreadPoolExecutor  # noqa: S016
from unittest.mock import MagicMock, patch

from sentry.cache.backends.reconnectingmemcache import ReconnectingMemcache
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


def _make_cache(reconnect_age=300):
    """Create a ReconnectingMemcache with a mocked pymemcache client class."""
    with patch.object(
        ReconnectingMemcache,
        "__init__",
        lambda self, *a, **kw: None,
    ):
        cache = ReconnectingMemcache.__new__(ReconnectingMemcache)

    cache._reconnect_age = reconnect_age
    cache._backend_var = contextvars.ContextVar(f"reconnecting_memcache_{id(cache)}", default=None)
    cache._servers = [("localhost", 11211)]
    cache._options = {}
    cache._class = MagicMock(side_effect=lambda *a, **kw: MagicMock())
    return cache


def test_each_thread_gets_own_client():
    """Plain ThreadPoolExecutor workers should each get their own client."""
    cache = _make_cache()
    parent_client = cache._cache

    results = []

    def check():
        worker_client = cache._cache
        results.append(worker_client is parent_client)

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(check) for _ in range(3)]
        for f in futures:
            f.result()

    # No worker should share the parent's client
    assert results == [False, False, False]


def test_context_propagating_executor_isolates_clients():
    """ContextPropagatingThreadPoolExecutor must not share the parent's
    pymemcache client across threads, even though it copies contextvars."""
    cache = _make_cache()
    parent_client = cache._cache

    results = []

    def check():
        worker_client = cache._cache
        results.append(worker_client is parent_client)

    with ContextPropagatingThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(check) for _ in range(3)]
        for f in futures:
            f.result()

    # Workers must NOT share the parent's client
    assert results == [False, False, False]


def test_same_thread_reuses_client():
    """Repeated accesses on the same thread should return the same client."""
    cache = _make_cache()

    client1 = cache._cache
    client2 = cache._cache

    assert client1 is client2
    # Should only have created one client
    assert cache._class.call_count == 1


def test_reconnects_after_age():
    """Client should be replaced after reconnect_age seconds."""
    cache = _make_cache(reconnect_age=10)

    client1 = cache._cache
    assert cache._class.call_count == 1

    # Simulate time passing beyond reconnect_age
    state = cache._backend_var.get()
    cache._backend_var.set(state._replace(created_at=time.time() - 11))

    client2 = cache._cache
    assert cache._class.call_count == 2
    assert client1 is not client2
    client1.close.assert_called_once()


def test_workers_in_same_context_run_get_own_clients():
    """Multiple workers spawned from the same context should each get
    independent clients (not share one via the copied contextvar)."""
    cache = _make_cache()
    _ = cache._cache  # parent initializes

    worker_clients = []

    def collect():
        worker_clients.append(id(cache._cache))

    with ContextPropagatingThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(collect) for _ in range(6)]
        for f in futures:
            f.result()

    # Each thread should have its own client (3 threads, up to 3 unique IDs)
    unique_clients = set(worker_clients)
    assert len(unique_clients) >= 2  # At least different from each other

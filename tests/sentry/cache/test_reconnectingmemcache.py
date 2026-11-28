import select
import socket
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor  # noqa: S016
from threading import Barrier

import pytest

from sentry.cache.backends import reconnectingmemcache
from sentry.cache.backends.reconnectingmemcache import ReconnectingMemcache
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


class FakeClient:
    def __init__(self) -> None:
        self.closed = False
        self.clients: dict[str, object] = {}

    def close(self) -> None:
        self.closed = True


class FakeClientClass:
    """Stands in for pymemcache.HashClient and records the clients it builds."""

    def __init__(self) -> None:
        self.created: list[FakeClient] = []

    def __call__(self, servers: object, **options: object) -> FakeClient:
        client = FakeClient()
        self.created.append(client)
        return client


def _make_cache(
    client_class: FakeClientClass, server: str = "localhost:11211", **options: object
) -> ReconnectingMemcache:
    cache = ReconnectingMemcache(server, {"OPTIONS": options})
    cache._class = client_class
    return cache


@pytest.fixture(autouse=True)
def clear_thread_clients() -> Generator[None]:
    # Clients outlive their backend, so a test would get another's.
    reconnectingmemcache._thread_clients.by_key.clear()
    yield
    for state in reconnectingmemcache._thread_clients.by_key.values():
        state.client.close()
    reconnectingmemcache._thread_clients.by_key.clear()


@pytest.mark.parametrize("executor_cls", [ThreadPoolExecutor, ContextPropagatingThreadPoolExecutor])
def test_threads_never_share_a_client(executor_cls: type[ThreadPoolExecutor]) -> None:
    cache = _make_cache(FakeClientClass())
    parent_client = cache._cache

    # Holds every task until three threads are running one.
    barrier = Barrier(3)

    def use() -> FakeClient:
        barrier.wait(timeout=10)
        return cache._cache

    with executor_cls(max_workers=3) as pool:
        futures = [pool.submit(use) for _ in range(3)]
        worker_clients = [f.result() for f in futures]

    assert len({parent_client, *worker_clients}) == 4


def test_same_thread_reuses_client() -> None:
    client_class = FakeClientClass()
    cache = _make_cache(client_class)

    assert cache._cache is cache._cache
    assert len(client_class.created) == 1


def test_context_propagating_executor_builds_one_client_per_worker() -> None:
    client_class = FakeClientClass()
    cache = _make_cache(client_class)

    def use_twice() -> None:
        assert cache._cache is cache._cache

    with ContextPropagatingThreadPoolExecutor(max_workers=4) as pool:
        for future in [pool.submit(use_twice) for _ in range(100)]:
            future.result()

    assert 1 <= len(client_class.created) <= 4


def test_backend_built_per_task_reuses_thread_client() -> None:
    """Django builds a backend inside each task when the submitting thread has none."""
    client_class = FakeClientClass()

    def use_twice() -> None:
        cache = _make_cache(client_class)
        assert cache._cache is cache._cache

    with ContextPropagatingThreadPoolExecutor(max_workers=4) as pool:
        for future in [pool.submit(use_twice) for _ in range(100)]:
            future.result()

    assert 1 <= len(client_class.created) <= 4


def test_backends_share_a_client_only_for_same_servers_and_options() -> None:
    client_class = FakeClientClass()
    client = _make_cache(client_class, ignore_exc=True)._cache

    assert _make_cache(client_class, ignore_exc=True)._cache is client
    assert _make_cache(client_class, ignore_exc=False)._cache is not client
    assert _make_cache(client_class, "localhost:11212", ignore_exc=True)._cache is not client
    assert len(client_class.created) == 3


def test_reconnects_after_age() -> None:
    client_class = FakeClientClass()
    cache = _make_cache(client_class, reconnect_age=10)

    with freeze_time() as traveller:
        old_client = cache._cache

        traveller.shift(9)
        assert cache._cache is old_client

        traveller.shift(2)
        new_client = cache._cache
        assert cache._cache is new_client

    assert new_client is not old_client
    assert old_client.closed
    assert not new_client.closed
    assert len(client_class.created) == 2


def test_reconnects_when_the_server_closed_the_connection() -> None:
    with socket.create_server(("127.0.0.1", 0)) as server:
        server.settimeout(10)
        host, port = server.getsockname()
        # With noreply a command returns once it's sent, so the test needs no server thread.
        cache = ReconnectingMemcache(
            f"{host}:{port}", {"OPTIONS": {"default_noreply": True, "ignore_exc": True}}
        )

        cache.delete("first")
        (server_client,) = cache._cache.clients.values()
        client_sock = server_client.sock

        first_conn, _ = server.accept()
        with first_conn:
            first_conn.settimeout(10)
            assert b"first" in first_conn.recv(1024)

        # Wait for the close to reach the client's socket.
        assert select.select([client_sock], [], [], 10)[0]

        cache.delete("second")
        second_conn, _ = server.accept()
        with second_conn:
            second_conn.settimeout(10)
            assert b"second" in second_conn.recv(1024)


def test_backends_of_one_alias_get_the_same_reconnect_age() -> None:
    params: dict[str, object] = {"OPTIONS": {"reconnect_age": 10}}

    first = ReconnectingMemcache("localhost:11211", params)
    second = ReconnectingMemcache("localhost:11211", params)

    assert first._reconnect_age == second._reconnect_age == 10

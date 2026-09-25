from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from typing import Any
from unittest import TestCase, mock

import pytest
import rb
from django.db import transaction
from redis.client import Script
from redis.exceptions import ResponseError
from sentry_redis_tools.failover_redis import FailoverRedis

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.testutils.pytest import xdist
from sentry.utils import imports
from sentry.utils.redis import (
    RBClusterManager,
    RedisClusterManager,
    _add_transaction_checks,
    _matches_redis_transaction_ratchet,
    _redis_transaction_callers,
    _shared_pool,
    check_cluster_versions,
    get_cluster_from_options,
    pop_used_key_prefix_clients,
    redis_clusters,
)
from sentry.utils.versioning import Version
from sentry.utils.warnings import DeprecatedSettingWarning


def _options_manager():
    return {
        "redis.clusters": {
            "foo": {"hosts": {0: {"db": 0}}},
            "bar": {"hosts": {0: {"db": 0}, 1: {"db": 1}}},
            "baz": {"is_redis_cluster": True, "hosts": {0: {}}},
        }
    }


class ClusterManagerTestCase(TestCase):
    def setUp(self) -> None:
        imports._cache.clear()

    def test_get(self) -> None:
        manager = RBClusterManager(_options_manager())
        assert manager.get("foo") is manager.get("foo")
        assert manager.get("foo") is not manager.get("bar")
        assert manager.get("foo").pool_cls is _shared_pool
        with pytest.raises(KeyError):
            manager.get("invalid")

    @mock.patch("sentry.utils.redis._add_transaction_checks", side_effect=lambda client: client)
    @mock.patch("sentry.utils.redis.RetryingRedisCluster")
    def test_specific_cluster(
        self,
        RetryingRedisCluster: mock.MagicMock,
        _add_transaction_checks: mock.MagicMock,
    ) -> None:
        manager = RedisClusterManager(_options_manager())

        # We wrap the cluster in a Simple Lazy Object, force creation of the
        # object to verify it's correct.

        # cluster foo is fine since it's a single node
        assert isinstance(manager.get("foo")._setupfunc(), FailoverRedis)  # type: ignore[union-attr]
        # baz works becasue it's explicitly is_redis_cluster
        assert manager.get("baz")._setupfunc() is RetryingRedisCluster.return_value  # type: ignore[union-attr]
        assert _add_transaction_checks.call_count == 2

        # bar is not a valid redis or redis cluster definition
        # becasue it is two hosts, without explicitly saying is_redis_cluster
        with pytest.raises(KeyError):
            manager.get("bar")

    @mock.patch("sentry.utils.redis.RetryingRedisCluster")
    def test_multiple_retrieval_do_not_setup_lazy_object(
        self, RetryingRedisCluster: mock.MagicMock
    ) -> None:
        RetryingRedisCluster.side_effect = AssertionError("should not be called")

        manager = RedisClusterManager(_options_manager())
        manager.get("baz")
        # repeated retrieval should not trigger call to setupfunc
        manager.get("baz")

    @mock.patch("sentry.utils.redis.in_test_environment", return_value=False)
    def test_transaction_checks_are_not_installed_in_production(
        self, in_test_environment: mock.MagicMock
    ) -> None:
        client = mock.Mock(spec=FailoverRedis)
        execute_command = client.execute_command
        pipeline = client.pipeline

        assert _add_transaction_checks(client) is client
        assert client.execute_command is execute_command
        assert client.pipeline is pipeline


class TransactionCheckingRedisTest(SentryTestCase):
    def test_command_runs_outside_transaction(self) -> None:
        client = redis_clusters.get("default")
        key = f"test:redis-transaction-guard:{uuid.uuid4().hex}"

        try:
            client.set(key, "value")
            assert client.get(key) == "value"
        finally:
            client.delete(key)

    @mock.patch(
        "sentry.utils.redis._redis_transaction_callers",
        return_value=("sentry.new_code.unexpected_redis_call",),
    )
    def test_command_is_rejected_inside_transaction(
        self, _redis_transaction_callers: mock.MagicMock
    ) -> None:
        client = redis_clusters.get("default")

        with transaction.atomic(using="default"):
            with pytest.raises(
                AssertionError,
                match="Redis commands must run outside database transactions",
            ):
                client.get("test:redis-transaction-guard")

    @mock.patch(
        "sentry.utils.redis._redis_transaction_callers",
        return_value=("sentry.new_code.unexpected_redis_call",),
    )
    def test_pipeline_is_rejected_when_executed_inside_transaction(
        self, _redis_transaction_callers: mock.MagicMock
    ) -> None:
        pipeline = redis_clusters.get("default").pipeline()
        pipeline.get("test:redis-transaction-guard")

        with transaction.atomic(using="default"):
            with pytest.raises(
                AssertionError,
                match="Redis pipeline commands must run outside database transactions",
            ):
                pipeline.execute()

    @use_redis_cluster("transaction-guard-cluster")
    @mock.patch(
        "sentry.utils.redis._redis_transaction_callers",
        return_value=("sentry.new_code.unexpected_redis_call",),
    )
    def test_cluster_command_is_rejected_inside_transaction(
        self, _redis_transaction_callers: mock.MagicMock
    ) -> None:
        client = redis_clusters.get("transaction-guard-cluster")
        assert all(info["redis_mode"] == "cluster" for info in client.info("server").values())

        with transaction.atomic(using="default"):
            with pytest.raises(
                AssertionError,
                match="Redis commands must run outside database transactions",
            ):
                client.get("test:redis-transaction-guard")

    def test_transaction_ratchet_matches_only_existing_call_path(self) -> None:
        existing_callers = (
            "sentry.ratelimits.redis.RedisRateLimiter.reset",
            "sentry.auth.twofactor.reset_2fa_rate_limits",
            "sentry.users.web.accounts.recover_confirm",
        )
        new_callers = (
            "sentry.ratelimits.redis.RedisRateLimiter.reset",
            "sentry.new_code.reset_rate_limit",
        )
        existing_webhook_callers = (
            "sentry.utils.sentry_apps.request_buffer.SentryAppWebhookRequestsBuffer.add_request",
            "sentry.utils.sentry_apps.webhooks.send_and_save_webhook_request",
        )
        existing_single_caller = (
            "sentry.event_manager._get_severity_metadata_for_group",
            "sentry.new_code.new_outer_caller",
        )

        assert _matches_redis_transaction_ratchet(existing_callers)
        assert _matches_redis_transaction_ratchet(existing_webhook_callers)
        assert _matches_redis_transaction_ratchet(existing_single_caller)
        assert not _matches_redis_transaction_ratchet(new_callers)

    def test_transaction_callers_include_application_frames_until_test_harness(self) -> None:
        def outer_caller() -> tuple[str, ...]:
            def shared_helper() -> tuple[str, ...]:
                return _redis_transaction_callers()

            return shared_helper()

        callers = outer_caller()

        assert callers == (
            f"{__name__}.{outer_caller.__qualname__}.<locals>.shared_helper",
            f"{__name__}.{outer_caller.__qualname__}",
            f"{__name__}.TransactionCheckingRedisTest.test_transaction_callers_include_application_frames_until_test_harness",
        )

    def test_transaction_callers_include_application_frames_outside_mock(self) -> None:
        def outer_caller() -> tuple[str, ...]:
            def shared_helper() -> tuple[str, ...]:
                return _redis_transaction_callers()

            return mock.Mock(wraps=shared_helper)()

        callers = outer_caller()

        assert callers[0] == f"{__name__}.{outer_caller.__qualname__}.<locals>.shared_helper"
        assert f"{__name__}.{outer_caller.__qualname__}" in callers


def test_get_cluster_from_options_cluster_provided() -> None:
    backend = mock.sentinel.backend
    manager = RBClusterManager(_options_manager())

    cluster, options = get_cluster_from_options(
        backend, {"cluster": "foo", "foo": "bar"}, cluster_manager=manager
    )

    assert cluster is manager.get("foo")
    assert isinstance(cluster, rb.Cluster)
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}


def test_get_cluster_from_options_legacy_hosts_option() -> None:
    backend = mock.sentinel.backend
    manager = RBClusterManager(_options_manager())

    with pytest.warns(DeprecatedSettingWarning) as warninfo:
        cluster, options = get_cluster_from_options(
            backend, {"hosts": {0: {"db": 0}}, "foo": "bar"}, cluster_manager=manager
        )

    # it should have warned about the deprecated setting
    (warn,) = warninfo
    assert isinstance(warn.message, DeprecatedSettingWarning)
    assert warn.message.setting == "'hosts' parameter of sentinel.backend"
    assert warn.message.replacement == 'sentinel.backend["cluster"]'

    assert cluster is not manager.get("foo")  # kind of a silly assertion
    assert isinstance(cluster, rb.Cluster)
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}


def test_get_cluster_from_options_both_options_invalid() -> None:
    backend = mock.sentinel.backend
    manager = RBClusterManager(_options_manager())

    with pytest.raises(InvalidConfiguration):
        cluster, options = get_cluster_from_options(
            backend,
            {"hosts": {0: {"db": 0}}, "cluster": "foo", "foo": "bar"},
            cluster_manager=manager,
        )


@pytest.mark.parametrize(
    "version_value",
    [
        pytest.param("7.2.4", id="string_three_part"),
        pytest.param("7.2", id="string_two_part"),
        pytest.param(7.2, id="float_two_part"),
    ],
)
def test_check_cluster_versions_parses_version_formats(version_value: str | float) -> None:
    cluster = mock.MagicMock(spec=rb.Cluster)
    mock_host = mock.MagicMock()
    mock_host.host = "localhost"
    mock_host.port = 6379
    cluster.hosts = {0: mock_host}

    mock_results = mock.MagicMock()
    mock_results.value = {0: {"redis_version": version_value}}
    cluster.all.return_value.__enter__ = mock.MagicMock(return_value=mock.MagicMock())
    cluster.all.return_value.__enter__.return_value.info.return_value = mock_results
    cluster.all.return_value.__exit__ = mock.MagicMock(return_value=False)

    # Should not raise - all test versions meet requirement 5.0.0
    check_cluster_versions(cluster, Version((5, 0, 0)))


@pytest.fixture
def prefixed_clusters() -> Generator[tuple[Any, Any, Any, str]]:
    """Two clients with the prefixes of two workers, and one client without a prefix."""
    config = options.get("redis.clusters")["cluster"]
    run = f"test-{uuid.uuid4().hex}"
    cluster_options: Any = {
        "redis.clusters": {
            "a": {**config, "key_prefix": f"{run}-a:"},
            "b": {**config, "key_prefix": f"{run}-b:"},
            "raw": {k: v for k, v in config.items() if k != "key_prefix"},
        }
    }
    manager = RedisClusterManager(cluster_options)
    a, b, raw = manager.get("a"), manager.get("b"), manager.get("raw")
    yield a, b, raw, f"{run}-a:"
    for key in raw.scan_iter(match=f"{run}*"):
        raw.delete(key)


def test_worker_key_prefix_is_configured() -> None:
    prefix = xdist.get_redis_cluster_key_prefix()
    assert options.get("redis.clusters")["cluster"]["key_prefix"] == prefix
    assert prefix == f"test-{os.environ.get('PYTEST_XDIST_WORKER', 'main')}:"
    assert "{" not in prefix


def test_key_prefix_is_transparent(prefixed_clusters: tuple[Any, Any, Any, str]) -> None:
    a, b, raw, prefix = prefixed_clusters

    a.set("key", "a")
    b.set("key", "b")

    assert a.get("key") == "a"
    assert b.get("key") == "b"
    assert raw.get(f"{prefix}key") == "a"
    assert raw.get("key") is None


def test_key_prefix_keeps_hash_tag_slot(prefixed_clusters: tuple[Any, Any, Any, str]) -> None:
    a, _, raw, prefix = prefixed_clusters
    keyslot = raw.connection_pool.nodes.keyslot

    assert keyslot(f"{prefix}{{tag}}:key") == keyslot("{tag}:key")

    a.set("{tag}:1", "1")
    a.set("{tag}:2", "2")
    assert a.execute_command("EXISTS", "{tag}:1", "{tag}:2") == 2

    # Keys without a common hash tag still fail as they do in production.
    with pytest.raises(ResponseError, match="hash to the same slot"):
        a.execute_command("EXISTS", "{tag}:1", "{other}:2")


def test_key_prefix_multi_key_commands(prefixed_clusters: tuple[Any, Any, Any, str]) -> None:
    a, _, raw, prefix = prefixed_clusters

    # MSET has a key at every second argument, so the values must keep their names.
    a.execute_command("MSET", "{mset}:1", "{mset}:2", "{mset}:2", "{mset}:1")
    assert raw.get(f"{prefix}{{mset}}:1") == "{mset}:2"
    assert raw.get(f"{prefix}{{mset}}:2") == "{mset}:1"

    a.mset({"one": "1", "two": "2"})
    assert a.mget(["one", "two", "three"]) == ["1", "2", None]
    assert raw.get(f"{prefix}two") == "2"

    a.rpush("{list}:src", "x")
    assert a.rpoplpush("{list}:src", "{list}:dst") == "x"
    assert raw.lrange(f"{prefix}{{list}}:dst", 0, -1) == ["x"]

    assert a.delete("one", "two") == 2
    assert a.exists("one") == 0


def test_key_prefix_pipeline(prefixed_clusters: tuple[Any, Any, Any, str]) -> None:
    a, _, raw, prefix = prefixed_clusters

    pipeline = a.pipeline()
    pipeline.set("key", "value")
    pipeline.incr("counter")
    pipeline.get("key")
    assert pipeline.execute() == [True, 1, "value"]

    assert raw.get(f"{prefix}key") == "value"
    assert raw.get(f"{prefix}counter") == "1"


def test_key_prefix_lua_script(prefixed_clusters: tuple[Any, Any, Any, str]) -> None:
    a, _, raw, prefix = prefixed_clusters
    script = Script(
        None,
        b"redis.call('set', KEYS[1], ARGV[1]) "
        b"redis.call('set', KEYS[1] .. ':copy', ARGV[1]) "
        b"return redis.call('get', KEYS[1])",
    )

    assert script(keys=["{script}:key"], args=["value"], client=a) == "value"
    assert a.get("{script}:key") == "value"
    # A key made from KEYS keeps the prefix. A key made only from ARGV or text does not.
    assert raw.get(f"{prefix}{{script}}:key:copy") == "value"


def test_key_prefix_removed_from_returned_keys(
    prefixed_clusters: tuple[Any, Any, Any, str],
) -> None:
    a, b, _, _ = prefixed_clusters

    a.set("found:1", "1")
    a.set("found:2", "2")
    b.set("found:3", "3")

    assert sorted(a.keys("found:*")) == ["found:1", "found:2"]
    assert sorted(a.scan_iter(match="found:*")) == ["found:1", "found:2"]
    assert sorted(a.scan_iter()) == ["found:1", "found:2"]

    a.rpush("queue", "item")
    assert a.blpop(["queue"], timeout=1) == ("queue", "item")

    with pytest.raises(NotImplementedError):
        a.randomkey()


def test_key_prefix_flush_deletes_only_own_keys(
    prefixed_clusters: tuple[Any, Any, Any, str],
) -> None:
    a, b, raw, prefix = prefixed_clusters

    other_key = prefix.replace("-a:", "-other:") + "key"
    a.set("key", "a")
    b.set("key", "b")
    raw.set(other_key, "other")

    a.flushdb()

    assert a.get("key") is None
    assert b.get("key") == "b"
    assert raw.get(other_key) == "other"


def test_used_key_prefix_clients_are_tracked(
    prefixed_clusters: tuple[Any, Any, Any, str],
) -> None:
    a, b, _, _ = prefixed_clusters
    pop_used_key_prefix_clients()

    a.get("key")

    assert pop_used_key_prefix_clients() == [a._wrapped]
    assert pop_used_key_prefix_clients() == []


@pytest.mark.parametrize(
    "config",
    [
        pytest.param({"hosts": {0: {}}, "key_prefix": "test:"}, id="not-a-cluster"),
        pytest.param(
            {"is_redis_cluster": True, "hosts": {0: {}}, "key_prefix": "{test}:"}, id="hash-tag"
        ),
    ],
)
def test_invalid_key_prefix(config: dict[str, Any]) -> None:
    cluster_options: Any = {"redis.clusters": {"invalid": config}}
    manager = RedisClusterManager(cluster_options)
    with pytest.raises(InvalidConfiguration):
        manager.get("invalid")

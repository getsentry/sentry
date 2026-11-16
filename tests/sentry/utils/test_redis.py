from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from typing import Any, assert_type, cast
from unittest import TestCase, mock

import pytest
from django.db import transaction
from redis.client import Script, StrictRedis
from redis.exceptions import ResponseError
from sentry_redis_tools.clients import RedisCluster
from sentry_redis_tools.failover_redis import FailoverRedis

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.locks import locks
from sentry.options import OptionsManager
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.testutils.pytest import xdist
from sentry.utils import imports
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.redis import (
    RedisClusterManager,
    _add_transaction_checks,
    _matches_redis_transaction_lock_ratchet,
    _matches_redis_transaction_ratchet,
    _redis_transaction_callers,
    _to_str,
    get_dynamic_cluster_from_options,
    pop_redis_transaction_violations,
    pop_used_key_prefix_clients,
    redis_clusters,
)
from sentry.utils.redis_key_specs import COMMAND_KEY_SPECS, KeySpec


def _options_manager() -> OptionsManager:
    return cast(
        OptionsManager,
        {
            "redis.clusters": {
                "foo": {"hosts": {0: {"db": 0}}},
                "bar": {"hosts": {0: {"db": 0}, 1: {"db": 1}}},
                "baz": {"is_redis_cluster": True, "hosts": {0: {}}},
            }
        },
    )


class ClusterManagerTestCase(TestCase):
    def setUp(self) -> None:
        imports._cache.clear()

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

        assert pop_redis_transaction_violations() == [
            (
                "Redis commands must run outside database transactions",
                ("sentry.new_code.unexpected_redis_call",),
            )
        ]

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

        assert pop_redis_transaction_violations() == [
            (
                "Redis pipeline commands must run outside database transactions",
                ("sentry.new_code.unexpected_redis_call",),
            )
        ]

    @use_redis_cluster("transaction-guard-cluster")
    @mock.patch(
        "sentry.utils.redis._redis_transaction_callers",
        return_value=("sentry.new_code.unexpected_redis_call",),
    )
    def test_cluster_command_is_rejected_inside_transaction(
        self, _redis_transaction_callers: mock.MagicMock
    ) -> None:
        client = redis_clusters.get("transaction-guard-cluster")
        assert all(info["server_mode"] == "cluster" for info in client.info("server").values())

        with transaction.atomic(using="default"):
            with pytest.raises(
                AssertionError,
                match="Redis commands must run outside database transactions",
            ):
                client.get("test:redis-transaction-guard")

        assert pop_redis_transaction_violations() == [
            (
                "Redis commands must run outside database transactions",
                ("sentry.new_code.unexpected_redis_call",),
            )
        ]

    def test_caught_lock_call_inside_transaction_is_recorded(self) -> None:
        # Lock.acquire turns the check's AssertionError into UnableToAcquireLock, so only the
        # record shows the violation.
        lock = locks.get(
            f"test:redis-transaction-guard:{uuid.uuid4().hex}", duration=5, name="test"
        )

        with transaction.atomic(using="default"):
            with pytest.raises(UnableToAcquireLock):
                lock.acquire()

        violations = pop_redis_transaction_violations()
        assert violations
        for message, callers in violations:
            assert message == "Redis commands must run outside database transactions"
            assert callers[0] == "sentry.utils.locking.backends.redis.BaseRedisLockBackend.acquire"
            assert callers[-1] == (
                f"{__name__}.TransactionCheckingRedisTest.test_caught_lock_call_inside_transaction_is_recorded"
            )

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

    def test_transaction_lock_ratchet_matches_only_the_lock_owner(self) -> None:
        acquire = (
            "sentry.utils.locking.backends.redis.BaseRedisLockBackend.acquire",
            "sentry.utils.locking.lock.Lock.acquire",
            "sentry.utils.retries.TimedRetryPolicy.__call__",
        )
        release = (
            "sentry.utils.locking.backends.redis.BaseRedisLockBackend.release",
            "sentry.utils.locking.lock.Lock.release",
            "sentry.utils.locking.lock.Lock.acquire.<locals>.releaser",
            "contextlib._GeneratorContextManager.__exit__",
        )
        project_save = ("sentry.models.project.Project.save", "sentry.new_code.create_project")
        # A different lock taken under Project.save, for example in a post_save receiver.
        nested_lock = (
            *acquire,
            "sentry.new_code.post_save_receiver",
            "django.db.models.base.Model.save_base",
            *project_save,
        )
        # A Redis call from Project.save that is not a lock call.
        not_a_lock = ("sentry.models.project.Project.save", "sentry.new_code.create_project")
        locked_check = (
            "sentry.utils.locking.backends.redis.BaseRedisLockBackend.locked",
            "sentry.utils.locking.lock.Lock.locked",
            *project_save,
        )
        monitor_from_mockdata = (
            *acquire,
            "sentry.monitors.models.Monitor.save",
            "django.db.models.query.QuerySet.create",
            "sentry.utils.mockdata.core.create_monitor",
        )
        monitor_from_new_code = (
            *acquire,
            "sentry.monitors.models.Monitor.save",
            "sentry.new_code.create_monitor",
        )

        # Example entries so that the test does not depend on the real allowlist
        allowlist = frozenset(
            {
                ("sentry.models.project.Project.save",),
                (
                    "sentry.monitors.models.Monitor.save",
                    "sentry.utils.mockdata.core.create_monitor",
                ),
            }
        )

        assert _matches_redis_transaction_lock_ratchet((*acquire, *project_save), allowlist)
        assert _matches_redis_transaction_lock_ratchet((*release, *project_save), allowlist)
        assert _matches_redis_transaction_lock_ratchet(monitor_from_mockdata, allowlist)
        assert not _matches_redis_transaction_lock_ratchet(nested_lock, allowlist)
        assert not _matches_redis_transaction_lock_ratchet(not_a_lock, allowlist)
        assert not _matches_redis_transaction_lock_ratchet(locked_check, allowlist)
        assert not _matches_redis_transaction_lock_ratchet(monitor_from_new_code, allowlist)
        assert not _matches_redis_transaction_lock_ratchet(acquire, allowlist)

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


type _StrClient = RedisCluster[str] | StrictRedis[str]
type _BytesClient = RedisCluster[bytes] | StrictRedis[bytes]

# `default` is a single host and `cluster` has `is_redis_cluster`. Only the single host path
# removes `cluster` from the returned config.
_DYNAMIC_CLUSTER_SHAPES = pytest.mark.parametrize(
    ("cluster_name", "expected_is_redis_cluster", "expected_config"),
    [
        pytest.param("default", False, {"foo": "bar"}, id="single-host"),
        pytest.param("cluster", True, {"cluster": "cluster", "foo": "bar"}, id="redis-cluster"),
    ],
)


@_DYNAMIC_CLUSTER_SHAPES
def test_get_dynamic_cluster_from_options_decode_responses_true(
    cluster_name: str, expected_is_redis_cluster: bool, expected_config: dict[str, str]
) -> None:
    is_redis_cluster, client, config = get_dynamic_cluster_from_options(
        "SETTING", {"cluster": cluster_name, "foo": "bar"}, decode_responses=True
    )

    assert_type(client, _StrClient)
    assert is_redis_cluster is expected_is_redis_cluster
    assert client is redis_clusters.get(cluster_name)
    assert config == expected_config


@_DYNAMIC_CLUSTER_SHAPES
def test_get_dynamic_cluster_from_options_decode_responses_false(
    cluster_name: str, expected_is_redis_cluster: bool, expected_config: dict[str, str]
) -> None:
    is_redis_cluster, client, config = get_dynamic_cluster_from_options(
        "SETTING", {"cluster": cluster_name, "foo": "bar"}, decode_responses=False
    )

    assert_type(client, _BytesClient)
    assert is_redis_cluster is expected_is_redis_cluster
    assert client is redis_clusters.get_binary(cluster_name)
    assert config == expected_config


def _get_dynamic_cluster(config: dict[str, object], decode_responses: bool) -> None:
    if decode_responses:
        get_dynamic_cluster_from_options("SETTING", config, decode_responses=True)
    else:
        get_dynamic_cluster_from_options("SETTING", config, decode_responses=False)


@pytest.mark.parametrize("decode_responses", [True, False])
def test_get_dynamic_cluster_from_options_multi_host_without_is_redis_cluster(
    decode_responses: bool,
) -> None:
    clusters_config = {
        **options.get("redis.clusters"),
        "multi-host": {"hosts": {0: {"db": 0}, 1: {"db": 1}}},
    }
    with override_options({"redis.clusters": clusters_config}):
        with pytest.raises(InvalidConfiguration) as excinfo:
            _get_dynamic_cluster({"cluster": "multi-host"}, decode_responses)

    message = str(excinfo.value)
    assert "SETTING" in message
    assert "'multi-host'" in message
    assert "2 hosts" in message
    assert "is_redis_cluster" in message


@pytest.mark.parametrize("decode_responses", [True, False])
def test_get_dynamic_cluster_from_options_unknown_cluster_raises_key_error(
    decode_responses: bool,
) -> None:
    with pytest.raises(KeyError):
        _get_dynamic_cluster({"cluster": "does-not-exist"}, decode_responses)


@pytest.mark.parametrize("decode_responses", [True, False])
def test_get_dynamic_cluster_from_options_hosts_option_invalid(decode_responses: bool) -> None:
    with pytest.raises(InvalidConfiguration):
        _get_dynamic_cluster({"hosts": {0: {"db": 0}}}, decode_responses)


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


def _load_command_key_specs(client: Any) -> dict[str, KeySpec]:
    """The key positions of each command that takes keys, from the COMMAND reply of the server."""
    connection = client.connection_pool.get_random_connection()
    try:
        connection.send_command("COMMAND")
        reply = connection.read_response()
    finally:
        client.connection_pool.release(connection)

    specs = {}

    def add(entry: list[Any]) -> None:
        flags = {_to_str(flag) for flag in entry[2]}
        spec = KeySpec(entry[3], entry[4], entry[5], "movablekeys" in flags)
        if spec.first > 0 or spec.movable:
            specs[_to_str(entry[0]).lower()] = spec
        # Redis 7 subcommands (such as "object|encoding") have their own key positions.
        for subcommand in entry[9] if len(entry) > 9 else []:
            add(subcommand)

    for entry in reply:
        add(entry)
    return specs


def test_command_key_specs_match_redis(prefixed_clusters: tuple[Any, Any, Any, str]) -> None:
    # If this fails after a change to the redis-cluster version in devservices, update
    # COMMAND_KEY_SPECS in sentry.utils.redis_key_specs with the values from the server.
    _, _, raw, _ = prefixed_clusters

    assert COMMAND_KEY_SPECS == _load_command_key_specs(raw)


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


def test_key_prefix_commands_sent_as_one_name(prefixed_clusters: tuple[Any, Any, Any, str]) -> None:
    # redis-py sends these commands as one argument, such as "XGROUP CREATE".
    a, _, raw, prefix = prefixed_clusters

    a.xadd("stream", {"field": "value"})
    a.xgroup_create("stream", "group", id="0")

    assert [group["name"] for group in a.xinfo_groups("stream")] == ["group"]
    assert [group["name"] for group in raw.xinfo_groups(f"{prefix}stream")] == ["group"]
    assert a.memory_usage("stream") is not None
    assert raw.memory_usage("stream") is None


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

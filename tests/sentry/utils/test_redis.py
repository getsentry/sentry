from __future__ import annotations

import uuid
from unittest import TestCase, mock

import pytest
import rb
from django.db import transaction
from sentry_redis_tools.failover_redis import FailoverRedis

from sentry.exceptions import InvalidConfiguration
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.testutils.helpers.redis import use_redis_cluster
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

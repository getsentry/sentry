from __future__ import annotations

from unittest import TestCase, mock

import pytest
import rb
from sentry_redis_tools.failover_redis import FailoverRedis

from sentry.exceptions import InvalidConfiguration
from sentry.utils import imports
from sentry.utils.redis import (
    RBClusterManager,
    RedisClusterManager,
    _shared_pool,
    check_cluster_versions,
    get_cluster_from_options,
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

    @mock.patch("sentry.utils.redis.RetryingRedisCluster")
    def test_specific_cluster(self, RetryingRedisCluster: mock.MagicMock) -> None:
        manager = RedisClusterManager(_options_manager())

        # We wrap the cluster in a Simple Lazy Object, force creation of the
        # object to verify it's correct.

        # cluster foo is fine since it's a single node
        assert isinstance(manager.get("foo")._setupfunc(), FailoverRedis)  # type: ignore[attr-defined]
        # baz works becasue it's explicitly is_redis_cluster
        assert manager.get("baz")._setupfunc() is RetryingRedisCluster.return_value  # type: ignore[attr-defined]

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

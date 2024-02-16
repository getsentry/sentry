from __future__ import annotations

import logging
from typing import Any
from unittest import TestCase, mock

import pytest
from django.utils.functional import SimpleLazyObject
from sentry_redis_tools.failover_redis import FailoverRedis

from sentry.exceptions import InvalidConfiguration
from sentry.utils import imports
from sentry.utils.redis import (
    ClusterManager,
    _RedisCluster,
    _shared_pool,
    get_cluster_from_options,
    logger,
)
from sentry.utils.warnings import DeprecatedSettingWarning

# Silence connection warnings
logger.setLevel(logging.ERROR)


def _options_manager() -> dict[str, Any]:
    return {
        "redis.clusters": {
            "foo": {"hosts": {0: {"db": 0}}},
            "bar": {"hosts": {0: {"db": 0}, 1: {"db": 1}}},
            "baz": {"is_redis_cluster": True, "hosts": {0: {}}},
        }
    }


class ClusterManagerTestCase(TestCase):
    def setUp(self):
        imports._cache.clear()

    def test_get(self):
        manager = ClusterManager(_options_manager())
        assert manager.get("foo") is manager.get("foo")
        assert manager.get("foo") is not manager.get("bar")
        assert manager.get("foo").pool_cls is _shared_pool
        with pytest.raises(KeyError):
            manager.get("invalid")

    @mock.patch("sentry.utils.redis.RetryingRedisCluster")
    def test_specific_cluster(self, RetryingRedisCluster):
        manager = ClusterManager(_options_manager(), cluster_type=_RedisCluster)

        # We wrap the cluster in a Simple Lazy Object, force creation of the
        # object to verify it's correct.

        # cluster foo is fine since it's a single node, without specific client_class
        assert isinstance(manager.get("foo")._setupfunc(), FailoverRedis)  # type: ignore[attr-defined]
        # baz works becasue it's explicitly is_redis_cluster
        assert manager.get("baz")._setupfunc() is RetryingRedisCluster.return_value  # type: ignore[attr-defined]

        # bar is not a valid redis or redis cluster definition
        # becasue it is two hosts, without explicitly saying is_redis_cluster
        with pytest.raises(KeyError):
            manager.get("bar")

    def test_multiple_retrieval_do_not_setup_lazy_object(self):
        class TestClusterType:
            def supports(self, config):
                return True

            def factory(self, **config):
                def setupfunc():
                    assert False, "setupfunc should not be called"

                return SimpleLazyObject(setupfunc)

        manager = ClusterManager(_options_manager(), cluster_type=TestClusterType)
        manager.get("foo")
        # repeated retrieval should not trigger call to setupfunc
        manager.get("foo")


def test_get_cluster_from_options_cluster_provided():
    backend = mock.sentinel.backend
    manager = ClusterManager(_options_manager())

    cluster, options = get_cluster_from_options(
        backend, {"cluster": "foo", "foo": "bar"}, cluster_manager=manager
    )

    assert cluster is manager.get("foo")
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}


def test_get_cluster_from_options_legacy_hosts_option():
    backend = mock.sentinel.backend
    manager = ClusterManager(_options_manager())

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
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}


def test_get_cluster_from_options_both_options_invalid():
    backend = mock.sentinel.backend
    manager = ClusterManager(_options_manager())

    with pytest.raises(InvalidConfiguration):
        cluster, options = get_cluster_from_options(
            backend,
            {"hosts": {0: {"db": 0}}, "cluster": "foo", "foo": "bar"},
            cluster_manager=manager,
        )

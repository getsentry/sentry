from __future__ import absolute_import

import functools
import logging
from sentry.utils.compat import mock
import pytest

from sentry.exceptions import InvalidConfiguration
from unittest import TestCase
from sentry.utils.redis import (
    ClusterManager,
    _shared_pool,
    get_cluster_from_options,
    _RedisCluster,
    logger,
)
from django.utils.functional import SimpleLazyObject

# Silence connection warnings
logger.setLevel(logging.ERROR)

make_manager = functools.partial(
    ClusterManager,
    {
        "redis.clusters": {
            "foo": {"hosts": {0: {"db": 0}}},
            "bar": {"hosts": {0: {"db": 0}, 1: {"db": 1}}},
            "baz": {"is_redis_cluster": True, "hosts": {0: {}}},
        }
    },
)


class ClusterManagerTestCase(TestCase):
    def test_get(self):
        manager = make_manager()
        assert manager.get("foo") is manager.get("foo")
        assert manager.get("foo") is not manager.get("bar")
        assert manager.get("foo").pool_cls is _shared_pool
        with pytest.raises(KeyError):
            manager.get("invalid")

    @mock.patch("sentry.utils.redis.RetryingRedisCluster")
    @mock.patch("sentry.utils.redis.StrictRedis")
    def test_specific_cluster(self, StrictRedis, RetryingRedisCluster):
        manager = make_manager(cluster_type=_RedisCluster)

        # We wrap the cluster in a Simple Lazy Object, force creation of the
        # object to verify it's correct.

        # cluster foo is fine since it's a single node
        assert manager.get("foo")._setupfunc() is StrictRedis.return_value
        # baz works becasue it's explicitly is_redis_cluster
        assert manager.get("baz")._setupfunc() is RetryingRedisCluster.return_value

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

        manager = make_manager(cluster_type=TestClusterType)
        manager.get("foo")
        # repeated retrieval should not trigger call to setupfunc
        manager.get("foo")


def test_get_cluster_from_options():
    backend = object()
    manager = make_manager()

    cluster, options = get_cluster_from_options(
        backend, {"cluster": "foo", "foo": "bar"}, cluster_manager=manager
    )

    assert cluster is manager.get("foo")
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}

    cluster, options = get_cluster_from_options(
        backend, {"hosts": {0: {"db": 0}}, "foo": "bar"}, cluster_manager=manager
    )

    assert cluster is not manager.get("foo")  # kind of a silly assertion
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}

    with pytest.raises(InvalidConfiguration):
        cluster, options = get_cluster_from_options(
            backend,
            {"hosts": {0: {"db": 0}}, "cluster": "foo", "foo": "bar"},
            cluster_manager=manager,
        )

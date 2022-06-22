import functools
import logging
from unittest import TestCase, mock

import pytest
from django.utils.functional import SimpleLazyObject
from redis.exceptions import ConnectionError, ReadOnlyError
from redis.exceptions import TimeoutError as RedisTimeoutError

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

make_manager = functools.partial(
    ClusterManager,
    {
        "redis.clusters": {
            "foo": {"hosts": {0: {"db": 0}}},
            "bar": {"hosts": {0: {"db": 0}, 1: {"db": 1}}},
            "baz": {"is_redis_cluster": True, "hosts": {0: {}}},
            "failover": {
                "client_class": "sentry.utils.redis.FailoverRedis",
                "hosts": {0: {"db": 0}},
            },
        }
    },
)


class ClusterManagerTestCase(TestCase):
    def setUp(self):
        imports._cache.clear()

    def test_get(self):
        manager = make_manager()
        assert manager.get("foo") is manager.get("foo")
        assert manager.get("foo") is not manager.get("bar")
        assert manager.get("foo").pool_cls is _shared_pool
        with pytest.raises(KeyError):
            manager.get("invalid")

    @mock.patch("sentry.utils.redis.RetryingRedisCluster")
    @mock.patch("sentry.utils.redis.StrictRedis")
    @mock.patch("sentry.utils.redis.FailoverRedis")
    def test_specific_cluster(self, FailoverRedis, StrictRedis, RetryingRedisCluster):
        manager = make_manager(cluster_type=_RedisCluster)

        # We wrap the cluster in a Simple Lazy Object, force creation of the
        # object to verify it's correct.

        # cluster foo is fine since it's a single node, without specific client_class
        assert manager.get("foo")._setupfunc() is StrictRedis.return_value
        # failover cluster is single host and specifies client_class to FailoverRedis
        assert manager.get("failover")._setupfunc() is FailoverRedis.return_value
        # baz works because it's explicitly is_redis_cluster
        assert manager.get("baz")._setupfunc() is RetryingRedisCluster.return_value

        # bar is not a valid redis or redis cluster definition
        # because it is two hosts, without explicitly saying is_redis_cluster
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


def test_get_cluster_from_options_cluster_provided():
    backend = mock.sentinel.backend
    manager = make_manager()

    cluster, options = get_cluster_from_options(
        backend, {"cluster": "foo", "foo": "bar"}, cluster_manager=manager
    )

    assert cluster is manager.get("foo")
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}


def test_get_cluster_from_options_legacy_hosts_option():
    backend = mock.sentinel.backend
    manager = make_manager()

    with pytest.warns(DeprecatedSettingWarning) as warninfo:
        cluster, options = get_cluster_from_options(
            backend, {"hosts": {0: {"db": 0}}, "foo": "bar"}, cluster_manager=manager
        )

    # it should have warned about the deprecated setting
    (warn,) = warninfo
    assert warn.message.setting == "'hosts' parameter of sentinel.backend"
    assert warn.message.replacement == 'sentinel.backend["cluster"]'

    assert cluster is not manager.get("foo")  # kind of a silly assertion
    assert cluster.pool_cls is _shared_pool
    assert options == {"foo": "bar"}


def test_get_cluster_from_options_both_options_invalid():
    backend = mock.sentinel.backend
    manager = make_manager()

    with pytest.raises(InvalidConfiguration):
        cluster, options = get_cluster_from_options(
            backend,
            {"hosts": {0: {"db": 0}}, "cluster": "foo", "foo": "bar"},
            cluster_manager=manager,
        )


class TestFailoverRedis(TestCase):
    def setUp(self):
        # clear previously cached FailoverRedis mock from import cache
        imports._cache.clear()

    def _get_client(self, **kwargs):
        return ClusterManager(
            {
                "redis.clusters": {
                    "c": {
                        "client_class": "sentry.utils.redis.FailoverRedis",
                        "hosts": {0: {"db": 0, **kwargs}},
                    }
                }
            },
            cluster_type=_RedisCluster,
        ).get("c")

    @mock.patch("sentry.utils.redis.StrictRedis.execute_command")
    @mock.patch("sentry.utils.redis.time.sleep")
    def test_retries(self, time_sleep, execute_command):
        client = self._get_client(_retries=5)
        assert client._retries == 5
        execute_command.side_effect = ConnectionError()
        with pytest.raises(ConnectionError):
            client.get("key")
        assert time_sleep.call_count == 5

    @mock.patch("sentry.utils.redis.StrictRedis.execute_command")
    @mock.patch("sentry.utils.redis.time.sleep")
    def test_recover(self, time_sleep, execute_command):
        client = self._get_client(_retries=5)
        assert client._retries == 5
        execute_command.side_effect = [
            ConnectionError(),
            RedisTimeoutError(),
            ReadOnlyError(),
            "value",
        ]
        assert client.get("key") == "value"
        assert time_sleep.call_count == 3

    @mock.patch("sentry.utils.redis.StrictRedis.execute_command")
    @mock.patch("sentry.utils.redis.time.sleep")
    def test_fixed_backoff(self, time_sleep, execute_command):
        client = self._get_client(_backoff_max=1.0, _backoff_min=1.0)
        assert client._retries == 10
        execute_command.side_effect = ConnectionError()
        with pytest.raises(ConnectionError):
            client.get("key")
        assert time_sleep.call_args_list == 10 * [((1.0,), {})]

    @mock.patch("sentry.utils.redis.StrictRedis.execute_command")
    @mock.patch("sentry.utils.redis.time.sleep")
    def test_max_backoff(self, time_sleep, execute_command):
        client = self._get_client(_backoff_max=1.0, _backoff_min=0.5)
        assert client._retries == 10
        execute_command.side_effect = ConnectionError()
        with pytest.raises(ConnectionError):
            client.get("key")
        assert all(a[0][0] <= 1.0 for a in time_sleep.call_args_list)

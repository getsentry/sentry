from __future__ import absolute_import

import functools
import logging
import mock
import pytest

from rediscluster.exceptions import RedisClusterException

from sentry.exceptions import InvalidConfiguration
from sentry.testutils.cases import TestCase
from sentry.utils.redis import (
    ClusterManager, _shared_pool, get_cluster_from_options, _RedisCluster, logger
)

# Silence connection warnings
logger.setLevel(logging.ERROR)

make_manager = functools.partial(
    ClusterManager,
    {
        'redis.clusters': {
            'foo': {
                'hosts': {
                    0: {
                        'db': 0
                    },
                },
            },
            'bar': {
                'hosts': {
                    0: {
                        'db': 0
                    },
                    1: {
                        'db': 1
                    },
                }
            },
            'baz': {
                'is_redis_cluster': True,
                'hosts': {
                    0: {},
                },
            },
        },
    },
)

rc_exception = RedisClusterException('Failed to connect')


class ClusterManagerTestCase(TestCase):
    def test_get(self):
        manager = make_manager()
        assert manager.get('foo') is manager.get('foo')
        assert manager.get('foo') is not manager.get('bar')
        assert manager.get('foo').pool_cls is _shared_pool
        with pytest.raises(KeyError):
            manager.get('invalid')

    @mock.patch('sentry.utils.redis.RetryingStrictRedisCluster')
    def test_specific_cluster(self, cluster):
        manager = make_manager(cluster_type=_RedisCluster)
        assert manager.get('baz') is cluster.return_value
        with pytest.raises(KeyError):
            manager.get('foo')

    @mock.patch('sentry.utils.redis.RetryingStrictRedisCluster', side_effect=rc_exception)
    def test_failed_redis_cluster(self, cluster):
        manager = make_manager(cluster_type=_RedisCluster)
        with pytest.raises(KeyError):
            manager.get('baz')


def test_get_cluster_from_options():
    backend = object()
    manager = make_manager()

    cluster, options = get_cluster_from_options(
        backend,
        {
            'cluster': 'foo',
            'foo': 'bar',
        },
        cluster_manager=manager,
    )

    assert cluster is manager.get('foo')
    assert cluster.pool_cls is _shared_pool
    assert options == {'foo': 'bar'}

    cluster, options = get_cluster_from_options(
        backend,
        {
            'hosts': {
                0: {
                    'db': 0
                },
            },
            'foo': 'bar',
        },
        cluster_manager=manager,
    )

    assert cluster is not manager.get('foo')  # kind of a silly assertion
    assert cluster.pool_cls is _shared_pool
    assert options == {'foo': 'bar'}

    with pytest.raises(InvalidConfiguration):
        cluster, options = get_cluster_from_options(
            backend,
            {
                'hosts': {
                    0: {
                        'db': 0
                    },
                },
                'cluster': 'foo',
                'foo': 'bar',
            },
            cluster_manager=manager,
        )

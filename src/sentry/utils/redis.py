from __future__ import absolute_import

from threading import Lock

import rb
from redis.connection import ConnectionPool

from sentry.exceptions import InvalidConfiguration
from sentry.utils.versioning import (
    Version,
    check_versions,
)


_pool_cache = {}
_pool_lock = Lock()


def _shared_pool(**opts):
    key = '%s:%s/%s' % (
        opts['host'],
        opts['port'],
        opts['db'],
    )
    pool = _pool_cache.get(key)
    if pool is not None:
        return pool
    with _pool_lock:
        pool = _pool_cache.get(key)
        if pool is not None:
            return pool
        pool = ConnectionPool(**opts)
        _pool_cache[key] = pool
        return pool


def make_rb_cluster(hosts):
    """Returns a rb cluster that internally shares the pools more
    intelligetly.
    """
    return rb.Cluster(hosts, pool_cls=_shared_pool)


def check_cluster_versions(cluster, required, recommended=Version((3, 0, 4)), label=None):
    try:
        with cluster.all() as client:
            results = client.info()
    except Exception as e:
        # Any connection issues should be caught here.
        raise InvalidConfiguration(unicode(e))

    versions = {}
    for id, info in results.value.items():
        host = cluster.hosts[id]
        # NOTE: This assumes there is no routing magic going on here, and
        # all requests to this host are being served by the same database.
        key = '{host}:{port}'.format(host=host.host, port=host.port)
        versions[key] = Version(map(int, info['redis_version'].split('.', 3)))

    check_versions(
        'Redis' if label is None else 'Redis (%s)' % (label,),
        versions,
        required,
        recommended,
    )

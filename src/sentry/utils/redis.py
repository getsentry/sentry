from __future__ import absolute_import

from threading import Lock

import rb

from redis.connection import ConnectionPool


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

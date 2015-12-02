from __future__ import absolute_import

import posixpath
from pkg_resources import resource_string
from threading import Lock

import rb
from redis.connection import ConnectionPool
from redis.client import Script

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


def load_script(path):
    script = Script(None, resource_string('sentry', posixpath.join('scripts', path)))

    # This changes the argument order of the ``Script.__call__`` method to
    # encourage using the script is with a specific Redis client when dealing
    # with clusters, rather than implicitly using the first client that the
    # script was registered with.
    def call_script(client, keys, args):
        """
        Executes {!r} as a Lua script on a Redis server.

        Takes the client to execute the script on as the first argument,
        followed by the values that will be provided as ``KEYS`` and ``ARGV``
        to the script as two sequence arguments.
        """.format(path)
        return script(keys, args, client)

    return call_script

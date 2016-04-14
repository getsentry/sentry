from __future__ import absolute_import

import functools
import posixpath
from threading import Lock

import rb
from pkg_resources import resource_string
from redis.client import Script
from redis.connection import ConnectionPool

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.utils import warnings
from sentry.utils.warnings import DeprecatedSettingWarning
from sentry.utils.versioning import Version, check_versions

_pool_cache = {}
_pool_lock = Lock()


def _shared_pool(**opts):
    if 'host' in opts:
        key = '%s:%s/%s' % (
            opts['host'],
            opts['port'],
            opts['db'],
        )
    else:
        key = '%s/%s' % (
            opts['path'],
            opts['db']
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


_make_rb_cluster = functools.partial(rb.Cluster, pool_cls=_shared_pool)


def make_rb_cluster(*args, **kwargs):
    # This uses the standard library `warnings`, since this is provided for
    # plugin compatibility but isn't actionable by the system administrator.
    import warnings
    warnings.warn(
        'Direct Redis cluster construction is deprecated, please use named clusters. '
        'Direct cluster construction will be removed in Sentry 8.5.',
        DeprecationWarning,
    )
    return _make_rb_cluster(*args, **kwargs)


class ClusterManager(object):
    def __init__(self, options_manager):
        self.__clusters = {}
        self.__options_manager = options_manager

    def get(self, key):
        cluster = self.__clusters.get(key)

        if cluster is None:
            # TODO: This would probably be safer with a lock, but I'm not sure
            # that it's necessary.
            configuration = self.__options_manager.get('redis.clusters').get(key)
            if configuration is None:
                raise KeyError('Invalid cluster name: {}'.format(key))

            cluster = self.__clusters[key] = _make_rb_cluster(**configuration)

        return cluster


clusters = ClusterManager(options.default_manager)


def get_cluster_from_options(setting, options, cluster_manager=clusters):
    cluster_option_name = 'cluster'
    default_cluster_name = 'default'
    cluster_constructor_option_names = frozenset(('hosts',))

    options = options.copy()
    cluster_options = {key: options.pop(key) for key in set(options.keys()).intersection(cluster_constructor_option_names)}
    if cluster_options:
        if cluster_option_name in options:
            raise InvalidConfiguration(
                'Cannot provide both named cluster ({!r}) and cluster configuration ({}) options.'.format(
                    cluster_option_name,
                    ', '.join(map(repr, cluster_constructor_option_names)),
                )
            )
        else:
            warnings.warn(
                DeprecatedSettingWarning(
                    '{} parameter of {}'.format(
                        ', '.join(map(repr, cluster_constructor_option_names)),
                        setting,
                    ),
                    '{}["{}"]'.format(
                        setting,
                        cluster_option_name,
                    ),
                    removed_in_version='8.5',
                ),
                stacklevel=2
            )
        cluster = rb.Cluster(pool_cls=_shared_pool, **cluster_options)
    else:
        cluster = cluster_manager.get(options.pop(cluster_option_name, default_cluster_name))

    return cluster, options


def check_cluster_versions(cluster, required, recommended=None, label=None):
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
    # encourage using the script with a specific Redis client, rather
    # than implicitly using the first client that the script was registered
    # with. (This can prevent lots of bizzare behavior when dealing with
    # clusters of Redis servers.)
    def call_script(client, keys, args):
        """
        Executes {!r} as a Lua script on a Redis server.

        Takes the client to execute the script on as the first argument,
        followed by the values that will be provided as ``KEYS`` and ``ARGV``
        to the script as two sequence arguments.
        """.format(path)
        return script(keys, args, client)

    return call_script

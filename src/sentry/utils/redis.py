from __future__ import absolute_import

import functools
import logging
import posixpath
import six

from threading import Lock

import rb
from django.utils.functional import SimpleLazyObject
from pkg_resources import resource_string
from redis.client import Script, StrictRedis
from redis.connection import ConnectionPool
from redis.exceptions import ConnectionError, BusyLoadingError
from rediscluster import StrictRedisCluster

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.utils import warnings
from sentry.utils.warnings import DeprecatedSettingWarning
from sentry.utils.versioning import Version, check_versions

logger = logging.getLogger(__name__)

_pool_cache = {}
_pool_lock = Lock()


def _shared_pool(**opts):
    if "host" in opts:
        key = "%s:%s/%s" % (opts["host"], opts["port"], opts["db"])
    else:
        key = "%s/%s" % (opts["path"], opts["db"])
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
        "Direct Redis cluster construction is deprecated, please use named clusters. "
        "Direct cluster construction will be removed in Sentry 8.5.",
        DeprecationWarning,
    )
    return _make_rb_cluster(*args, **kwargs)


class _RBCluster(object):
    def supports(self, config):
        return not config.get("is_redis_cluster", False)

    def factory(self, **config):
        # rb expects a dict of { host, port } dicts where the key is the host
        # ID. Coerce the configuration into the correct format if necessary.
        hosts = config["hosts"]
        hosts = {k: v for k, v in enumerate(hosts)} if isinstance(hosts, list) else hosts
        config["hosts"] = hosts

        return _make_rb_cluster(**config)

    def __str__(self):
        return "Redis Blaster Cluster"


class RetryingStrictRedisCluster(StrictRedisCluster):
    """
    Execute a command with cluster reinitialization retry logic.

    Should a cluster respond with a ConnectionError or BusyLoadingError the
    cluster nodes list will be reinitialized and the command will be executed
    again with the most up to date view of the world.
    """

    def execute_command(self, *args, **kwargs):
        try:
            return super(self.__class__, self).execute_command(*args, **kwargs)
        except (
            ConnectionError,
            BusyLoadingError,
            KeyError,  # see: https://github.com/Grokzen/redis-py-cluster/issues/287
        ):
            self.connection_pool.nodes.reset()
            return super(self.__class__, self).execute_command(*args, **kwargs)


class _RedisCluster(object):
    def supports(self, config):
        # _RedisCluster supports two configurations:
        #  * Explicitly configured with is_redis_cluster. This mode is for real redis-cluster.
        #  * No is_redis_cluster, but only 1 host. This represents a singular node Redis running
        #    in non-cluster mode.
        return config.get("is_redis_cluster", False) or len(config.get("hosts")) == 1

    def factory(self, **config):
        # StrictRedisCluster expects a list of { host, port } dicts. Coerce the
        # configuration into the correct format if necessary.
        hosts = config.get("hosts")
        hosts = hosts.values() if isinstance(hosts, dict) else hosts

        # Redis cluster does not wait to attempt to connect. We'd prefer to not
        # make TCP connections on boot. Wrap the client in a lazy proxy object.
        def cluster_factory():
            if config.get("is_redis_cluster", False):
                return RetryingStrictRedisCluster(
                    startup_nodes=hosts, decode_responses=True, skip_full_coverage_check=True
                )
            else:
                host = hosts[0].copy()
                host["decode_responses"] = True
                return StrictRedis(**host)

        return SimpleLazyObject(cluster_factory)

    def __str__(self):
        return "Redis Cluster"


class ClusterManager(object):
    def __init__(self, options_manager, cluster_type=_RBCluster):
        self.__clusters = {}
        self.__options_manager = options_manager
        self.__cluster_type = cluster_type()

    def get(self, key):
        cluster = self.__clusters.get(key)

        if cluster:
            return cluster

        # TODO: This would probably be safer with a lock, but I'm not sure
        # that it's necessary.
        configuration = self.__options_manager.get("redis.clusters").get(key)
        if configuration is None:
            raise KeyError(u"Invalid cluster name: {}".format(key))

        if not self.__cluster_type.supports(configuration):
            raise KeyError(u"Invalid cluster type, expected: {}".format(self.__cluster_type))

        cluster = self.__clusters[key] = self.__cluster_type.factory(**configuration)

        return cluster


# TODO(epurkhiser): When migration of all rb cluster to true redis clusters has
# completed, remove the rb ``clusters`` module variable and rename
# redis_clusters to clusters.
clusters = ClusterManager(options.default_manager)
redis_clusters = ClusterManager(options.default_manager, _RedisCluster)


def get_cluster_from_options(setting, options, cluster_manager=clusters):
    cluster_option_name = "cluster"
    default_cluster_name = "default"
    cluster_constructor_option_names = frozenset(("hosts",))

    options = options.copy()
    cluster_options = {
        key: options.pop(key)
        for key in set(options.keys()).intersection(cluster_constructor_option_names)
    }
    if cluster_options:
        if cluster_option_name in options:
            raise InvalidConfiguration(
                u"Cannot provide both named cluster ({!r}) and cluster configuration ({}) options.".format(
                    cluster_option_name, ", ".join(map(repr, cluster_constructor_option_names))
                )
            )
        else:
            warnings.warn(
                DeprecatedSettingWarning(
                    u"{} parameter of {}".format(
                        ", ".join(map(repr, cluster_constructor_option_names)), setting
                    ),
                    u'{}["{}"]'.format(setting, cluster_option_name),
                    removed_in_version="8.5",
                ),
                stacklevel=2,
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
        raise InvalidConfiguration(six.text_type(e))

    versions = {}
    for id, info in results.value.items():
        host = cluster.hosts[id]
        # NOTE: This assumes there is no routing magic going on here, and
        # all requests to this host are being served by the same database.
        key = u"{host}:{port}".format(host=host.host, port=host.port)
        versions[key] = Version(map(int, info["redis_version"].split(".", 3)))

    check_versions(
        "Redis" if label is None else "Redis (%s)" % (label,), versions, required, recommended
    )


def load_script(path):
    script = Script(None, resource_string("sentry", posixpath.join("scripts", path)))

    # This changes the argument order of the ``Script.__call__`` method to
    # encourage using the script with a specific Redis client, rather
    # than implicitly using the first client that the script was registered
    # with. (This can prevent lots of bizarre behavior when dealing with
    # clusters of Redis servers.)
    def call_script(client, keys, args):
        u"""
        Executes {!r} as a Lua script on a Redis server.

        Takes the client to execute the script on as the first argument,
        followed by the values that will be provided as ``KEYS`` and ``ARGV``
        to the script as two sequence arguments.
        """.format(
            path
        )
        return script(keys, args, client)

    return call_script

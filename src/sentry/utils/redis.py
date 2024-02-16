from __future__ import annotations

import functools
import importlib.resources
import logging
from threading import Lock
from typing import Any, Generic, TypeVar, overload

import rb
from django.utils.functional import SimpleLazyObject
from redis.client import StrictRedis
from redis.cluster import ClusterNode, RedisCluster
from redis.commands.core import Script
from redis.connection import ConnectionPool
from sentry_redis_tools.failover_redis import FailoverRedis
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.utils import warnings
from sentry.utils.imports import import_string
from sentry.utils.versioning import Version, check_versions
from sentry.utils.warnings import DeprecatedSettingWarning

logger = logging.getLogger(__name__)


_REDIS_DEFAULT_CLIENT_ARGS = {
    # 3 seconds default socket and socket connection timeout avoids blocking on socket till the
    # operating sysstem level timeout kicks in
    "socket_timeout": 3.0
}

_pool_cache = {}
_pool_lock = Lock()


def _shared_pool(**opts):
    if "host" in opts:
        key = "{}:{}/{}".format(opts["host"], opts["port"], opts["db"])
    else:
        key = "{}/{}".format(opts["path"], opts["db"])
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


class _RBCluster:
    def supports(self, config):
        return not config.get("is_redis_cluster", False)

    def factory(self, *, decode_responses: bool, **config):
        if not decode_responses:
            raise NotImplementedError("decode_responses=False mode is not implemented for `rb`")
        # rb expects a dict of { host, port } dicts where the key is the host
        # ID. Coerce the configuration into the correct format if necessary.
        hosts = config["hosts"]
        hosts = {k: v for k, v in enumerate(hosts)} if isinstance(hosts, list) else hosts
        config["hosts"] = hosts

        pool_options = config.pop("client_args", {})
        pool_options = {**_REDIS_DEFAULT_CLIENT_ARGS, **pool_options}
        config["pool_options"] = pool_options

        return _make_rb_cluster(**config)

    def __str__(self):
        return "Redis Blaster Cluster"


class _RedisCluster:
    def supports(self, config):
        # _RedisCluster supports two configurations:
        #  * Explicitly configured with is_redis_cluster. This mode is for real redis-cluster.
        #  * No is_redis_cluster, but only 1 host. This represents a singular node Redis running
        #    in non-cluster mode.
        return config.get("is_redis_cluster", False) or len(config.get("hosts")) == 1

    def factory(self, *, decode_responses: bool, **config):
        # StrictRedisCluster expects a list of { host, port } dicts. Coerce the
        # configuration into the correct format if necessary.
        hosts = config.get("hosts") or []
        hosts = list(hosts.values()) if isinstance(hosts, dict) else hosts

        # support for scaling reads using the readonly mode
        # https://redis.io/docs/reference/cluster-spec/#scaling-reads-using-replica-nodes
        readonly_mode = config.get("readonly_mode", False)

        client_args = config.get("client_args") or {}
        client_args = {**_REDIS_DEFAULT_CLIENT_ARGS, **client_args}

        # Redis cluster does not wait to attempt to connect. We'd prefer to not
        # make TCP connections on boot. Wrap the client in a lazy proxy object.
        def cluster_factory():
            if config.get("is_redis_cluster", False):
                startup_nodes = map(
                    lambda entry: ClusterNode(host=entry["host"], port=entry["port"]), hosts
                )
                return RetryingRedisCluster(
                    startup_nodes=list(startup_nodes),
                    decode_responses=decode_responses,
                    skip_full_coverage_check=True,
                    max_connections=16,
                    max_connections_per_node=True,
                    readonly_mode=readonly_mode,
                    **client_args,
                )
            else:
                assert len(hosts) > 0, "Redis cluster should have at least 1 host"
                host = hosts[0].copy()
                host["decode_responses"] = decode_responses
                return (
                    import_string(config["client_class"])
                    if "client_class" in config
                    else FailoverRedis
                )(**host, **client_args)

        return SimpleLazyObject(cluster_factory)

    def __str__(self):
        return "Redis Cluster"


TCluster = TypeVar("TCluster", rb.Cluster, RedisCluster | StrictRedis)


class ClusterManager(Generic[TCluster]):
    @overload
    def __init__(self: ClusterManager[rb.Cluster], options_manager) -> None:
        ...

    @overload
    def __init__(
        self: ClusterManager[RedisCluster | StrictRedis], options_manager, cluster_type: type[Any]
    ) -> None:
        ...

    def __init__(self, options_manager, cluster_type=_RBCluster):
        self.__clusters: dict[tuple[str, bool], TCluster] = {}
        self.__options_manager = options_manager
        self.__cluster_type = cluster_type()

    def get(self, key: str, *, decode_responses: bool = True) -> TCluster:
        cache_key = (key, decode_responses)
        try:
            return self.__clusters[cache_key]
        except KeyError:
            # Do not access attributes of the `cluster` object to prevent
            # setup/init of lazy objects. The _RedisCluster type will try to
            # connect to the cluster during initialization.

            # TODO: This would probably be safer with a lock, but I'm not sure
            # that it's necessary.
            configuration = self.__options_manager.get("redis.clusters").get(key)
            if configuration is None:
                raise KeyError(f"Invalid cluster name: {key}")

            if not self.__cluster_type.supports(configuration):
                raise KeyError(f"Invalid cluster type, expected: {self.__cluster_type}")

            ret = self.__clusters[cache_key] = self.__cluster_type.factory(
                **configuration,
                decode_responses=decode_responses,
            )
            return ret


# TODO(epurkhiser): When migration of all rb cluster to true redis clusters has
# completed, remove the rb ``clusters`` module variable and rename
# redis_clusters to clusters.
clusters: ClusterManager[rb.Cluster] = ClusterManager(options.default_manager)
redis_clusters: ClusterManager[RedisCluster | StrictRedis] = ClusterManager(
    options.default_manager, _RedisCluster
)


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
                "Cannot provide both named cluster ({!r}) and cluster configuration ({}) options.".format(
                    cluster_option_name,
                    ", ".join(repr(name) for name in cluster_constructor_option_names),
                )
            )
        else:
            warnings.warn(
                DeprecatedSettingWarning(
                    "{} parameter of {}".format(
                        ", ".join(repr(name) for name in cluster_constructor_option_names), setting
                    ),
                    f'{setting}["{cluster_option_name}"]',
                    removed_in_version="8.5",
                ),
                stacklevel=2,
            )
        cluster = rb.Cluster(pool_cls=_shared_pool, **cluster_options)
    else:
        cluster = cluster_manager.get(options.pop(cluster_option_name, default_cluster_name))

    return cluster, options


def get_dynamic_cluster_from_options(setting, config):
    cluster_name = config.get("cluster", "default")
    cluster_opts = options.default_manager.get("redis.clusters").get(cluster_name)
    if cluster_opts is not None and cluster_opts.get("is_redis_cluster"):
        # RedisCluster
        return True, redis_clusters.get(cluster_name), config

    # RBCluster
    return (False,) + get_cluster_from_options(setting, config)


def validate_dynamic_cluster(is_redis_cluster, cluster):
    try:
        if is_redis_cluster:
            cluster.ping()
            cluster.connection_pool.disconnect()
        else:
            with cluster.all() as client:
                client.ping()
            cluster.disconnect_pools()
    except Exception as e:
        raise InvalidConfiguration(str(e))


def check_cluster_versions(cluster, required, recommended=None, label=None):
    try:
        with cluster.all() as client:
            results = client.info()
        cluster.disconnect_pools()
    except Exception as e:
        # Any connection issues should be caught here.
        raise InvalidConfiguration(str(e))

    versions = {}
    for id, info in results.value.items():
        host = cluster.hosts[id]
        # NOTE: This assumes there is no routing magic going on here, and
        # all requests to this host are being served by the same database.
        key = f"{host.host}:{host.port}"
        versions[key] = Version([int(part) for part in info["redis_version"].split(".", 3)])

    check_versions(
        "Redis" if label is None else f"Redis ({label})", versions, required, recommended
    )


def load_script(path):
    script = []

    # This changes the argument order of the ``Script.__call__`` method to
    # encourage using the script with a specific Redis client, rather
    # than implicitly using the first client that the script was registered
    # with. (This can prevent lots of bizarre behavior when dealing with
    # clusters of Redis servers.)
    def call_script(client, keys, args):
        # Executes load_script's path as a Lua script on a Redis server.
        # Takes the client to execute the script on as the first argument,
        # followed by the values that will be provided as ``KEYS`` and ``ARGV``
        # to the script as two sequence arguments.
        if not script:
            # XXX: Script is a list here. We're doing this to work around the lack of
            # `nonlocal` in python 3, so that we only instantiate the script once.
            script.append(
                Script(
                    client,
                    importlib.resources.files("sentry").joinpath("scripts", path).read_bytes(),
                )
            )
            # Unset the client here to keep things as close to how they worked before
            # as possible. It will always be overridden on `__call__` anyway.
            script[0].registered_client = None
        return script[0](keys, args, client)

    return call_script


# Since the implementation to disconnect connection pools differ between
# RedisCluster and StrictRedis after v4, we need this function.
def disconnect_redis_connection_pools(client: StrictRedis | RedisCluster) -> None:
    if isinstance(client, RedisCluster):
        client.disconnect_connection_pools()
    else:
        assert isinstance(client, StrictRedis)
        client.connection_pool.disconnect()

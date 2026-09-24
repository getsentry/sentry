from __future__ import annotations

import importlib.resources
import inspect
import logging
from collections.abc import Generator
from copy import deepcopy
from threading import Lock
from typing import Any, Literal, NamedTuple, TypeGuard, TypeVar, cast, overload

import rb
from django.utils.functional import SimpleLazyObject
from redis.client import Script, StrictRedis
from redis.connection import ConnectionPool
from sentry_redis_tools.clients import RedisCluster
from sentry_redis_tools.failover_redis import FailoverRedis
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry import options
from sentry.db.postgres.transactions import in_test_assert_no_transaction
from sentry.exceptions import InvalidConfiguration
from sentry.options import OptionsManager
from sentry.utils import warnings
from sentry.utils.env import in_test_environment
from sentry.utils.versioning import Version, check_versions
from sentry.utils.warnings import DeprecatedSettingWarning

logger = logging.getLogger(__name__)

T = TypeVar("T", str, bytes)


_REDIS_DEFAULT_CLIENT_ARGS = {
    # 3 seconds default socket and socket connection timeout avoids blocking on socket till the
    # operating system level timeout kicks in
    "socket_timeout": 3.0
}

_pool_cache: dict[str, ConnectionPool] = {}
_pool_lock = Lock()


def _shared_pool(**opts: Any) -> ConnectionPool:
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


class RBClusterManager:
    def __init__(self, options_manager: OptionsManager) -> None:
        self._clusters: dict[str, rb.Cluster] = {}
        self._options_manager = options_manager

    def _factory(
        self,
        *,
        hosts: list[dict[int, Any]] | dict[int, Any] | None = None,
        **config: Any,
    ) -> rb.Cluster:
        if not hosts:
            hosts = []
        # rb expects a dict of { host, port } dicts where the key is the host
        # ID. Coerce the configuration into the correct format if necessary.
        hosts = {k: v for k, v in enumerate(hosts)} if isinstance(hosts, list) else hosts
        config["hosts"] = hosts

        pool_options: dict[str, Any] = config.pop("client_args", {})
        pool_options = {**_REDIS_DEFAULT_CLIENT_ARGS, **pool_options}
        config["pool_options"] = pool_options

        return rb.Cluster(**config, pool_cls=_shared_pool)

    def get(self, key: str) -> rb.Cluster:
        try:
            return self._clusters[key]
        except KeyError:
            pass

        cfg = self._options_manager.get("redis.clusters", {}).get(key)
        if cfg is None:
            raise KeyError(f"Invalid cluster name: {key}")

        if cfg.get("is_redis_cluster", False):
            raise KeyError("Invalid cluster type, expected rb cluster")

        ret = self._clusters[key] = self._factory(**cfg)
        return ret


class RedisClusterManager:
    def __init__(self, options_manager: OptionsManager) -> None:
        self._clusters_bytes: dict[str, RedisCluster[bytes] | StrictRedis[bytes]] = {}
        self._clusters_str: dict[str, RedisCluster[str] | StrictRedis[str]] = {}
        self._options_manager = options_manager

    def _supports(self, config: dict[str, Any]) -> bool:
        # supports two configurations:
        #  * Explicitly configured with is_redis_cluster. This mode is for real redis-cluster.
        #  * No is_redis_cluster, but only 1 host. This represents a singular node Redis running
        #    in non-cluster mode.
        return config.get("is_redis_cluster", False) or len(config.get("hosts", [])) == 1

    def _cfg(self, key: str) -> dict[str, Any]:
        # TODO: This would probably be safer with a lock, but I'm not sure
        # that it's necessary.
        cfg = self._options_manager.get("redis.clusters", {}).get(key)
        if cfg is None:
            raise KeyError(f"Invalid cluster name: {key}")

        if not self._supports(cfg):
            raise KeyError("Invalid cluster type, expected redis cluster")

        return cfg

    @overload
    def _factory(
        self,
        *,
        decode_responses: Literal[False],
        is_redis_cluster: bool = False,
        readonly_mode: bool = False,
        hosts: list[dict[Any, Any]] | dict[Any, Any] | None = None,
        client_args: dict[str, Any] | None = None,
        key_prefix: str | None = None,
        **config: Any,
    ) -> RedisCluster[bytes] | StrictRedis[bytes]: ...

    @overload
    def _factory(
        self,
        *,
        decode_responses: Literal[True],
        is_redis_cluster: bool = False,
        readonly_mode: bool = False,
        hosts: list[dict[Any, Any]] | dict[Any, Any] | None = None,
        client_args: dict[str, Any] | None = None,
        key_prefix: str | None = None,
        **config: Any,
    ) -> RedisCluster[str] | StrictRedis[str]: ...

    def _factory(
        self,
        *,
        decode_responses: bool,
        is_redis_cluster: bool = False,
        readonly_mode: bool = False,
        hosts: list[dict[Any, Any]] | dict[Any, Any] | None = None,
        client_args: dict[str, Any] | None = None,
        key_prefix: str | None = None,
        **config: Any,
    ) -> RedisCluster[bytes] | StrictRedis[bytes] | RedisCluster[str] | StrictRedis[str]:
        if key_prefix is not None:
            # only the redis-cluster client supports a prefix
            if not is_redis_cluster or "{" in key_prefix:
                raise InvalidConfiguration(
                    "key_prefix needs is_redis_cluster and must not contain '{'"
                )

        # StrictRedisCluster expects a list of { host, port } dicts. Coerce the
        # configuration into the correct format if necessary.
        if not hosts:
            hosts = []
        hosts_list = list(hosts.values()) if isinstance(hosts, dict) else hosts

        # support for scaling reads using the readonly mode
        # https://redis.io/docs/reference/cluster-spec/#scaling-reads-using-replica-nodes

        if not client_args:
            client_args = {}

        client_args = {**_REDIS_DEFAULT_CLIENT_ARGS, **client_args}

        # Redis cluster does not wait to attempt to connect. We'd prefer to not
        # make TCP connections on boot. Wrap the client in a lazy proxy object.
        def cluster_factory() -> (
            RedisCluster[bytes] | StrictRedis[bytes] | RedisCluster[str] | StrictRedis[str]
        ):
            if is_redis_cluster:
                cluster = _add_transaction_checks(
                    RetryingRedisCluster(
                        # Intentionally copy hosts here because redis-cluster-py
                        # mutates the inner dicts and this closure can be run
                        # concurrently, as SimpleLazyObject is not threadsafe. This
                        # is likely triggered by RetryingRedisCluster running
                        # reset() after startup
                        #
                        # https://github.com/Grokzen/redis-py-cluster/blob/73f27edf7ceb4a408b3008ef7d82dac570ab9c6a/rediscluster/nodemanager.py#L385
                        startup_nodes=deepcopy(hosts_list),
                        decode_responses=decode_responses,
                        skip_full_coverage_check=True,
                        max_connections=16,
                        max_connections_per_node=True,
                        readonly_mode=readonly_mode,
                        **client_args,
                    )
                )
                if key_prefix is not None:
                    return _add_key_prefix(cluster, key_prefix)
                return cluster

            assert len(hosts_list) > 0, "Hosts should have at least 1 entry"
            host = dict(hosts_list[0])
            host["decode_responses"] = decode_responses
            return _add_transaction_checks(FailoverRedis(**host, **client_args))

        # losing some type safety: SimpleLazyObject acts like the underlying type
        return SimpleLazyObject(cluster_factory)

    def get(self, key: str) -> RedisCluster[str] | StrictRedis[str]:
        try:
            return self._clusters_str[key]
        except KeyError:
            pass

        # Do not access attributes of the `cluster` object to prevent
        # setup/init of lazy objects.
        ret = self._clusters_str[key] = self._factory(**self._cfg(key), decode_responses=True)
        return ret

    def get_binary(self, key: str) -> RedisCluster[bytes] | StrictRedis[bytes]:
        try:
            return self._clusters_bytes[key]
        except KeyError:
            pass

        # Do not access attributes of the `cluster` object to prevent
        # setup/init of lazy objects.
        ret = self._clusters_bytes[key] = self._factory(**self._cfg(key), decode_responses=False)
        return ret


# INC-2410: Existing violations of Redis calls happening during DB transactions at the time the check was added.
# New entries are not allowed and we should burn this down over time.
_REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET = frozenset(
    {
        (
            "getsentry.billing.usagebuffer.redis.RedisUsageBuffer.fetch_pop",
            "getsentry.billing.tasks.usagebuffer.flush_usage_buffer",
        ),
        (
            "getsentry.models.billingseatassignment.BillingSeatAssignment.schedule_redis_key_sync.<locals>._sync_redis_key",
        ),
        (
            "sentry.dynamic_sampling.rules.helpers.latest_releases.ProjectBoostedReleases.has_boosted_releases",
            "sentry.models.releases.release_project.ReleaseProjectModelManager._on_post",
        ),
        ("sentry.event_manager._get_severity_metadata_for_group",),
        (
            "sentry.models.counter.increment_project_counter_in_cache",
            "sentry.models.counter.Counter.increment",
            "sentry.models.project.Project.next_short_id",
            "sentry.event_manager._get_next_short_id",
        ),
        ("sentry.models.counter.refill_cached_short_ids",),
        ("sentry.notifications.notifications.activity.base.GroupActivityNotification.__init__",),
        (
            "sentry.ratelimits.redis.RedisRateLimiter.reset",
            "sentry.auth.twofactor.reset_2fa_rate_limits",
            "sentry.users.web.accounts.recover_confirm",
        ),
        ("sentry.rules.actions.integrations.create_ticket.utils.create_issue",),
        ("sentry.rules.conditions.event_frequency.EventFrequencyCondition.query_hook",),
        ("sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition.query_hook",),
        ("sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition.query_hook",),
        (
            "sentry.services.eventstore.reprocessing.redis.RedisReprocessingStore.get_pending",
            "sentry.reprocessing2.get_progress",
        ),
        (
            "sentry.services.eventstore.reprocessing.redis.RedisReprocessingStore.get_pending",
            "sentry.reprocessing2.is_reprocessing_active",
        ),
        ("sentry.tasks.assemble.delete_assemble_status",),
        (
            "sentry.uptime.config_producer._send_to_redis",
            "sentry.uptime.config_producer.produce_config",
        ),
        (
            "sentry.uptime.config_producer._send_to_redis",
            "sentry.uptime.config_producer.produce_config_removal",
        ),
        ("sentry.uptime.subscriptions.subscriptions.disable_uptime_detector",),
        ("sentry.utils.snowflake.get_sequence_value_from_redis",),
        (
            "sentry.utils.sentry_apps.request_buffer.SentryAppWebhookRequestsBuffer.add_request",
            "sentry.sentry_apps.external_requests.utils.send_and_save_sentry_app_request",
        ),
        (
            "sentry.utils.sentry_apps.request_buffer.SentryAppWebhookRequestsBuffer.add_request",
            "sentry.utils.sentry_apps.webhooks.send_and_save_webhook_request",
        ),
    }
)


def _add_transaction_checks(
    client: RedisCluster[T] | StrictRedis[T],
) -> RedisCluster[T] | StrictRedis[T]:
    """No-ops in production. In testing environments, wraps Redis calls to assert it's not inside a transaction."""
    if not in_test_environment():
        return client

    mutable_client = cast(Any, client)
    execute_command = mutable_client.execute_command

    def execute_command_outside_transaction(*args: Any, **kwargs: Any) -> Any:
        _assert_redis_transaction_allowed("Redis commands must run outside database transactions")
        return execute_command(*args, **kwargs)

    pipeline_factory = mutable_client.pipeline

    def pipeline(*args: Any, **kwargs: Any) -> Any:
        redis_pipeline = pipeline_factory(*args, **kwargs)
        execute_pipeline = redis_pipeline.execute

        def execute_pipeline_outside_transaction(*args: Any, **kwargs: Any) -> Any:
            _assert_redis_transaction_allowed(
                "Redis pipeline commands must run outside database transactions"
            )
            return execute_pipeline(*args, **kwargs)

        redis_pipeline.execute = execute_pipeline_outside_transaction
        return redis_pipeline

    mutable_client.execute_command = execute_command_outside_transaction
    mutable_client.pipeline = pipeline
    return client


def _assert_redis_transaction_allowed(message: str) -> None:
    try:
        in_test_assert_no_transaction(message)
    except AssertionError:
        callers = _redis_transaction_callers()
        caller = callers[0] if callers else None
        if caller is not None and caller.startswith(
            ("getsentry.testutils.", "sentry.testutils.", "tests.")
        ):
            return
        if _matches_redis_transaction_ratchet(callers):
            return
        raise AssertionError(f"{message} (Redis caller: {caller or 'unknown'})") from None


def _matches_redis_transaction_ratchet(callers: tuple[str, ...]) -> bool:
    for signature in _REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET:
        remaining_callers = iter(callers)
        if all(caller in remaining_callers for caller in signature):
            return True
    return False


def _redis_transaction_callers() -> tuple[str, ...]:
    callers = []
    frame = inspect.currentframe()
    while frame is not None:
        module = frame.f_globals.get("__name__", "")
        if module in ("_pytest", "pytest", "unittest.case") or module.startswith(
            ("_pytest.", "pytest.", "unittest.case.")
        ):
            break
        is_redis_internal = module == __name__ or any(
            module == prefix or module.startswith(f"{prefix}.")
            for prefix in ("django.utils.functional", "redis", "rediscluster", "sentry_redis_tools")
        )
        if module and not is_redis_internal:
            callers.append(f"{module}.{frame.f_code.co_qualname}")
        frame = frame.f_back
    return tuple(callers)


class _KeySpec(NamedTuple):
    first: int
    last: int
    step: int
    movable: bool


# Key positions of each command, from the COMMAND reply of the server. Loaded on first use.
_command_key_specs: dict[str, _KeySpec] | None = None

# For commands with a `numkeys` argument: the index of that argument. The keys come after it.
_SCRIPT_COMMANDS = ("eval", "evalsha", "eval_ro", "evalsha_ro", "fcall", "fcall_ro")
_NUMKEYS_INDEX = {
    **dict.fromkeys(_SCRIPT_COMMANDS, 2),
    **dict.fromkeys(("zunionstore", "zinterstore", "zdiffstore", "blmpop", "bzmpop"), 2),
    **dict.fromkeys(("zunion", "zinter", "zdiff", "zintercard", "sintercard", "lmpop", "zmpop"), 1),
}

# Commands that see the keys of all workers. A prefixed client cannot make them transparent.
_UNSUPPORTED_WITH_KEY_PREFIX = frozenset(("scan", "randomkey", "flushdb", "flushall"))

# Prefixed clients that ran a command since the last call to `pop_used_key_prefix_clients`.
_used_key_prefix_clients: dict[int, RedisCluster[Any] | StrictRedis[Any]] = {}


def pop_used_key_prefix_clients() -> list[RedisCluster[Any] | StrictRedis[Any]]:
    """Tests use this to clean up only after a test that used a prefixed client."""
    used = list(_used_key_prefix_clients.values())
    _used_key_prefix_clients.clear()
    return used


def _to_str(value: Any) -> str:
    return value.decode(errors="replace") if isinstance(value, bytes) else str(value)


def _load_command_key_specs(client: Any) -> dict[str, _KeySpec]:
    connection = client.connection_pool.get_random_connection()
    try:
        connection.send_command("COMMAND")
        reply = connection.read_response()
    finally:
        client.connection_pool.release(connection)

    specs = {}

    def add(entry: list[Any]) -> None:
        flags = {_to_str(flag) for flag in entry[2]}
        specs[_to_str(entry[0]).lower()] = _KeySpec(
            entry[3], entry[4], entry[5], "movablekeys" in flags
        )
        # Redis 7 gives subcommands such as "object|encoding" their own key positions.
        for subcommand in entry[9] if len(entry) > 9 else []:
            add(subcommand)

    for entry in reply:
        add(entry)
    return specs


def _key_positions(args: tuple[Any, ...], specs: dict[str, _KeySpec]) -> list[int]:
    name = _to_str(args[0]).lower()
    if len(args) > 1 and f"{name}|{_to_str(args[1]).lower()}" in specs:
        name = f"{name}|{_to_str(args[1]).lower()}"
    # Unknown names have no keys. This includes commands that redis-py-cluster sends as one
    # argument, such as "SCRIPT LOAD". None of them take keys.
    spec = specs.get(name)
    if spec is None:
        return []

    positions: list[int] = []
    if spec.first > 0:
        last = spec.last if spec.last >= 0 else len(args) + spec.last
        positions.extend(range(spec.first, min(last, len(args) - 1) + 1, spec.step))
    if spec.movable:
        if name in _NUMKEYS_INDEX:
            index = _NUMKEYS_INDEX[name]
            positions.extend(range(index + 1, index + 1 + int(args[index])))
        elif name in ("xread", "xreadgroup"):
            streams = [_to_str(arg).upper() for arg in args].index("STREAMS")
            positions.extend(range(streams + 1, streams + 1 + (len(args) - streams - 1) // 2))
        else:
            raise NotImplementedError(f"The Redis key prefix does not support {name}")
    return positions


def _add_key_prefix(
    client: RedisCluster[T] | StrictRedis[T], key_prefix: str
) -> RedisCluster[T] | StrictRedis[T]:
    """
    Adds `key_prefix` to each key that the client sends, and removes it from the key names
    that the client returns. Tests use this to isolate parallel workers that share a cluster.

    Keys that a Lua script makes itself, and does not get from KEYS, do not get the prefix.
    In a script reply, each string that starts with the prefix is treated as a key name.
    """
    mutable_client = cast(Any, client)
    prefix_bytes = key_prefix.encode()

    def add_prefix(key: Any) -> Any:
        if isinstance(key, (bytes, memoryview)):
            return prefix_bytes + bytes(key)
        return f"{key_prefix}{key}"

    def remove_prefix(key: Any) -> Any:
        if isinstance(key, bytes) and key.startswith(prefix_bytes):
            return key[len(prefix_bytes) :]
        if isinstance(key, str) and key.startswith(key_prefix):
            return key[len(key_prefix) :]
        return key

    def prefix_args(args: tuple[Any, ...]) -> tuple[Any, ...]:
        global _command_key_specs
        name = _to_str(args[0]).lower()
        if name in _UNSUPPORTED_WITH_KEY_PREFIX:
            raise NotImplementedError(f"The Redis key prefix does not support {name}")
        if name == "keys":
            return (args[0], add_prefix(args[1]), *args[2:])
        if _command_key_specs is None:
            _command_key_specs = _load_command_key_specs(client)
        positions = set(_key_positions(args, _command_key_specs))
        return tuple(add_prefix(arg) if i in positions else arg for i, arg in enumerate(args))

    def unprefix_reply(args: tuple[Any, ...], reply: Any) -> Any:
        name = _to_str(args[0]).lower()
        if not reply or isinstance(reply, Exception):
            return reply
        if name == "keys":
            return [remove_prefix(key) for key in reply]
        if name in ("blpop", "brpop", "bzpopmin", "bzpopmax", "lmpop", "blmpop", "zmpop", "bzmpop"):
            return type(reply)([remove_prefix(reply[0]), *reply[1:]])
        if name in ("xread", "xreadgroup"):
            return [[remove_prefix(stream), *rest] for stream, *rest in reply]
        if name in _SCRIPT_COMMANDS:
            return remove_prefix_from_script_reply(reply)
        return reply

    def remove_prefix_from_script_reply(reply: Any) -> Any:
        if isinstance(reply, list):
            return [remove_prefix_from_script_reply(item) for item in reply]
        return remove_prefix(reply)

    execute_command = mutable_client.execute_command
    scan_iter = mutable_client.scan_iter
    pipeline_factory = mutable_client.pipeline

    def execute_prefixed_command(*args: Any, **kwargs: Any) -> Any:
        # Other workers share the cluster, so a flush deletes only the keys with this prefix.
        if _to_str(args[0]).lower() in ("flushdb", "flushall"):
            for key in scan_iter(match=add_prefix("*")):
                execute_command("DEL", key)
            return True
        _used_key_prefix_clients[id(client)] = client
        return unprefix_reply(args, execute_command(*prefix_args(args), **kwargs))

    def scan_prefixed_keys(match: Any = None, **kwargs: Any) -> Generator[Any]:
        _used_key_prefix_clients[id(client)] = client
        for key in scan_iter(match=add_prefix("*" if match is None else match), **kwargs):
            yield remove_prefix(key)

    def pipeline(*args: Any, **kwargs: Any) -> Any:
        redis_pipeline = pipeline_factory(*args, **kwargs)
        queue_command = redis_pipeline.execute_command
        execute_pipeline = redis_pipeline.execute

        def queue_prefixed_command(*args: Any, **kwargs: Any) -> Any:
            _used_key_prefix_clients[id(client)] = client
            return queue_command(*prefix_args(args), **kwargs)

        def execute_prefixed_pipeline(*args: Any, **kwargs: Any) -> Any:
            commands = [command.args for command in redis_pipeline.command_stack]
            results = execute_pipeline(*args, **kwargs)
            return [unprefix_reply(c, result) for c, result in zip(commands, results)]

        redis_pipeline.execute_command = queue_prefixed_command
        redis_pipeline.execute = execute_prefixed_pipeline
        return redis_pipeline

    mutable_client.execute_command = execute_prefixed_command
    mutable_client.scan_iter = scan_prefixed_keys
    mutable_client.pipeline = pipeline
    return client


# TODO(epurkhiser): When migration of all rb cluster to true redis clusters has
# completed, remove the rb ``clusters`` module variable and rename
# redis_clusters to clusters.
clusters = RBClusterManager(options.default_manager)
redis_clusters = RedisClusterManager(options.default_manager)


def get_cluster_from_options(
    setting: str,
    options: dict[str, Any],
    cluster_manager: RBClusterManager = clusters,
) -> tuple[rb.Cluster, dict[str, Any]]:
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


def get_dynamic_cluster_from_options(
    setting: str, config: dict[str, Any]
) -> tuple[bool, RedisCluster[str] | StrictRedis[str] | rb.Cluster, dict[str, Any]]:
    cluster_name = config.get("cluster", "default")
    cluster_opts: dict[str, Any] | None = options.default_manager.get("redis.clusters").get(
        cluster_name
    )
    if cluster_opts is not None and cluster_opts.get("is_redis_cluster"):
        # RedisCluster, StrictRedis
        return True, redis_clusters.get(cluster_name), config

    # RBCluster
    cluster, config = get_cluster_from_options(setting, config)
    return False, cluster, config


def get_cluster_routing_client(
    cluster: RedisCluster[T] | rb.Cluster, is_redis_cluster: bool
) -> RedisCluster[T] | rb.RoutingClient:
    if is_instance_redis_cluster(cluster, is_redis_cluster):
        return cluster
    elif is_instance_rb_cluster(cluster, is_redis_cluster):
        return cluster.get_routing_client()
    else:
        raise AssertionError("unreachable")


def is_instance_redis_cluster(
    val: rb.Cluster | RedisCluster[str], is_redis_cluster: bool
) -> TypeGuard[RedisCluster[str]]:
    return is_redis_cluster


def is_instance_rb_cluster(
    val: rb.Cluster | RedisCluster[str], is_redis_cluster: bool
) -> TypeGuard[rb.Cluster]:
    return not is_redis_cluster


def validate_dynamic_cluster(
    is_redis_cluster: bool, cluster: rb.Cluster | RedisCluster[str]
) -> None:
    try:
        if is_instance_redis_cluster(cluster, is_redis_cluster):
            cluster.ping()
            cluster.connection_pool.disconnect()
        elif is_instance_rb_cluster(cluster, is_redis_cluster):
            with cluster.all() as client:
                client.ping()
            cluster.disconnect_pools()
        else:
            raise AssertionError("unreachable")
    except Exception as e:
        raise InvalidConfiguration(str(e)) from e


def check_cluster_versions(
    cluster: rb.Cluster,
    required: Version,
    recommended: Version | None = None,
    label: str | None = None,
) -> None:
    try:
        with cluster.all() as client:
            results = client.info()
        cluster.disconnect_pools()
    except Exception as e:
        # Any connection issues should be caught here.
        raise InvalidConfiguration(str(e)) from e

    versions = {}
    for id, info in results.value.items():
        host = cluster.hosts[id]
        # NOTE: This assumes there is no routing magic going on here, and
        # all requests to this host are being served by the same database.
        key = f"{host.host}:{host.port}"
        versions[key] = Version([int(part) for part in str(info["redis_version"]).split(".", 3)])

    check_versions(
        "Redis" if label is None else f"Redis ({label})", versions, required, recommended
    )


def load_redis_script(path: str) -> Script:
    return Script(
        None,
        importlib.resources.files("sentry").joinpath("scripts", path).read_bytes(),
    )

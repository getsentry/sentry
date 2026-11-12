from __future__ import annotations

import importlib.resources
import inspect
import logging
from collections.abc import Generator
from copy import deepcopy
from typing import Any, Literal, TypeVar, cast, overload

from django.utils.functional import SimpleLazyObject
from redis.client import Script, StrictRedis
from sentry_redis_tools.clients import RedisCluster
from sentry_redis_tools.failover_redis import FailoverRedis
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry import options
from sentry.db.postgres.transactions import in_test_assert_no_transaction
from sentry.exceptions import InvalidConfiguration
from sentry.options import OptionsManager
from sentry.utils.env import in_test_environment
from sentry.utils.redis_key_specs import COMMAND_KEY_SPECS

logger = logging.getLogger(__name__)

T = TypeVar("T", str, bytes)


_REDIS_DEFAULT_CLIENT_ARGS = {
    # 3 seconds default socket and socket connection timeout avoids blocking on socket till the
    # operating system level timeout kicks in
    "socket_timeout": 3.0
}


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
        # INFRENG-931: inbound filter feature adoption runs inside the project creation transaction
        # https://linear.app/getsentry/issue/INFRENG-931
        (
            "sentry.models.featureadoption.FeatureAdoptionManager.record",
            "sentry.receivers.features.record_inbound_filter_toggled",
            "sentry.api.helpers.default_inbound_filters.set_default_inbound_filters",
        ),
        # INFRENG-932: delete-and-discard feature adoption runs inside the discard transaction
        # https://linear.app/getsentry/issue/INFRENG-932
        (
            "sentry.models.featureadoption.FeatureAdoptionManager.record",
            "sentry.receivers.features.deleted_and_discarded_issue",
            "sentry.api.helpers.group_index.update.handle_discard",
        ),
    }
)

# INFRENG-727: Existing lock calls inside DB transactions. The redis-blaster lock backend was not
# wrapped by this check, so these stayed hidden until default locks moved to RedisClusterLockBackend.
_REDIS_TRANSACTION_LOCK_ALLOWLIST_RATCHET = frozenset(
    {
        # --------------------------------
        # Getsentry stacks. Getsentry tests use the same default lock backend and the same check.
        # --------------------------------
        #
        # Remove this entry when REVENG-686 lands:
        # https://linear.app/getsentry/issue/REVENG-686/delete-tally-usage
        (
            "getsentry.billing.reserved_budgets.reserved_budget_subscription_lock.<locals>.get_decorator.<locals>.lock_wrapper",
            "getsentry.billing.reserved_budgets.recompute_all_reserved_budget_spends",
        ),
        # Platform trial locks in TrialService._create_product_trial and _create_subscription_trial.
        # Remove these entries when REVENG-695 lands:
        (
            "getsentry.billing.platform.services.engagement.services.trial.service.TrialService._create_product_trial",
        ),
        (
            "getsentry.billing.platform.services.engagement.services.trial.service.TrialService._create_subscription_trial",
        ),
        # Customer model_lock in MissingCustomerRelation.repair.
        # Remove this entry when REVENG-694 lands
        (
            "getsentry.models.customer.model_lock.<locals>.inner.<locals>.wrapped",
            "getsentry.accounts.repair.missing_data.MissingCustomerRelation.repair",
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
        if _matches_redis_transaction_lock_ratchet(callers):
            return

        _redis_transaction_violations.append((message, callers))
        raise AssertionError(f"{message} (Redis caller: {caller or 'unknown'})") from None


# Redis calls that the transaction check rejected since the last call to
# `pop_redis_transaction_violations`: the message and the caller stack of each one
_redis_transaction_violations: list[tuple[str, tuple[str, ...]]] = []


def pop_redis_transaction_violations() -> list[tuple[str, tuple[str, ...]]]:
    """
    Returns the recorded transaction check violations and clears the record.

    The pytest plugin calls this at the teardown of each test and fails the test if a violation
    was recorded. A test that causes a violation on purpose calls this to clear it.
    """
    count = len(_redis_transaction_violations)
    violations = _redis_transaction_violations[:count]
    del _redis_transaction_violations[:count]
    return violations


def _matches_redis_transaction_ratchet(callers: tuple[str, ...]) -> bool:
    for signature in _REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET:
        remaining_callers = iter(callers)
        if all(caller in remaining_callers for caller in signature):
            return True
    return False


_REDIS_LOCK_BACKEND_CALLERS = (
    "sentry.utils.locking.backends.redis.BaseRedisLockBackend.acquire",
    "sentry.utils.locking.backends.redis.BaseRedisLockBackend.release",
)
_REDIS_LOCK_INTERNAL_PREFIXES = ("sentry.utils.locking.", "sentry.utils.retries.", "contextlib.")


def _matches_redis_transaction_lock_ratchet(
    callers: tuple[str, ...],
    allowlist: frozenset[tuple[str, ...]] = _REDIS_TRANSACTION_LOCK_ALLOWLIST_RATCHET,
) -> bool:
    if not callers or callers[0] not in _REDIS_LOCK_BACKEND_CALLERS:
        return False
    owner_index = 0
    while owner_index < len(callers) and callers[owner_index].startswith(
        _REDIS_LOCK_INTERNAL_PREFIXES
    ):
        owner_index += 1
    if owner_index == len(callers):
        return False
    owner = callers[owner_index]
    for owner_signature, *signature in allowlist:
        if owner_signature != owner:
            continue
        remaining_callers = iter(callers[owner_index + 1 :])
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


# for commands with a `numkeys` argument: the index of that argument
_SCRIPT_COMMANDS = ("eval", "evalsha", "eval_ro", "evalsha_ro", "fcall", "fcall_ro")
_NUMKEYS_INDEX = {
    **dict.fromkeys(_SCRIPT_COMMANDS, 2),
    **dict.fromkeys(("zunionstore", "zinterstore", "zdiffstore", "blmpop", "bzmpop"), 2),
    **dict.fromkeys(("zunion", "zinter", "zdiff", "zintercard", "sintercard", "lmpop", "zmpop"), 1),
}

# commands that see the keys of all workers
_UNSUPPORTED_WITH_KEY_PREFIX = frozenset(("scan", "randomkey", "flushdb", "flushall"))

# prefixed clients that ran a command since the last call to `pop_used_key_prefix_clients`
_used_key_prefix_clients: dict[int, RedisCluster[Any] | StrictRedis[Any]] = {}


def pop_used_key_prefix_clients() -> list[RedisCluster[Any] | StrictRedis[Any]]:
    used = list(_used_key_prefix_clients.values())
    _used_key_prefix_clients.clear()
    return used


def _to_str(value: Any) -> str:
    return value.decode(errors="replace") if isinstance(value, bytes) else str(value)


def _key_positions(args: tuple[Any, ...]) -> list[int]:
    # redis-py sends some commands as one argument with a space, such as "XGROUP CREATE". Split
    # the name so that the arguments have the same shape as the table
    head = _to_str(args[0]).lower().split()
    offset = len(head) - 1
    args = (*head, *args[1:])

    name = head[0]
    if len(args) > 1 and f"{name}|{_to_str(args[1]).lower()}" in COMMAND_KEY_SPECS:
        name = f"{name}|{_to_str(args[1]).lower()}"
    # Names that are not in the table have no keys, such as "SCRIPT LOAD".
    spec = COMMAND_KEY_SPECS.get(name)
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
    return [position - offset for position in positions]


def _add_key_prefix(
    client: RedisCluster[T] | StrictRedis[T], key_prefix: str
) -> RedisCluster[T] | StrictRedis[T]:
    """
    Adds `key_prefix` to each key that the client sends, and removes it from the key names
    that the client returns. Tests use this to isolate parallel workers that share a cluster.
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
        name = _to_str(args[0]).lower()
        if name in _UNSUPPORTED_WITH_KEY_PREFIX:
            raise NotImplementedError(f"The Redis key prefix does not support {name}")
        if name == "keys":
            return (args[0], add_prefix(args[1]), *args[2:])
        positions = set(_key_positions(args))
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


redis_clusters = RedisClusterManager(options.default_manager)


@overload
def get_dynamic_cluster_from_options(
    setting: str, config: dict[str, Any], *, decode_responses: Literal[True]
) -> tuple[bool, RedisCluster[str] | StrictRedis[str], dict[str, Any]]: ...


@overload
def get_dynamic_cluster_from_options(
    setting: str, config: dict[str, Any], *, decode_responses: Literal[False]
) -> tuple[bool, RedisCluster[bytes] | StrictRedis[bytes], dict[str, Any]]: ...


def get_dynamic_cluster_from_options(
    setting: str, config: dict[str, Any], *, decode_responses: bool
) -> tuple[
    bool,
    RedisCluster[str] | StrictRedis[str] | RedisCluster[bytes] | StrictRedis[bytes],
    dict[str, Any],
]:
    """
    Returns ``(is_redis_cluster, client, config)`` for the cluster that ``config`` names.

    Response type is determined by each individual caller:
    - ``str`` for ``decode_responses=True``
    - ``bytes`` for ``decode_responses=False``

    The type is the same for a cluster with ``is_redis_cluster`` and for a single host.

    A cluster without ``is_redis_cluster`` must have one host. For these, the ``cluster`` option
    is removed from the returned config.
    """
    if "hosts" in config:
        raise InvalidConfiguration(
            f"{setting} does not support the 'hosts' option. Set 'cluster' to a name in redis.clusters."
        )

    cluster_name = config.get("cluster", "default")
    cluster_opts: dict[str, Any] | None = options.default_manager.get("redis.clusters").get(
        cluster_name
    )
    if cluster_opts is not None and cluster_opts.get("is_redis_cluster"):
        if decode_responses:
            return True, redis_clusters.get(cluster_name), config
        return True, redis_clusters.get_binary(cluster_name), config

    host_count = len(cluster_opts.get("hosts", [])) if cluster_opts is not None else 1
    if host_count != 1:
        # Self-hosted configs can still have a multi-host entry from the redis-blaster days.
        # Without this message the process fails with a KeyError that does not say what to change.
        raise InvalidConfiguration(
            f"{setting} uses the Redis cluster {cluster_name!r} in redis.clusters. This entry has "
            f"{host_count} hosts and does not set is_redis_cluster. "
            "Sentry no longer spreads keys across hosts on the client side, so an "
            "entry without is_redis_cluster must have exactly one host. Keep one host, or set "
            "is_redis_cluster to True if the hosts are a Redis Cluster."
        )

    config = config.copy()
    config.pop("cluster", None)
    if decode_responses:
        return False, redis_clusters.get(cluster_name), config
    return False, redis_clusters.get_binary(cluster_name), config


def validate_dynamic_cluster(cluster: RedisCluster[Any] | StrictRedis[Any]) -> None:
    try:
        cluster.ping()
        cluster.connection_pool.disconnect()
    except Exception as e:
        raise InvalidConfiguration(str(e)) from e


def load_redis_script(path: str) -> Script:
    return Script(
        None,
        importlib.resources.files("sentry").joinpath("scripts", path).read_bytes(),
    )

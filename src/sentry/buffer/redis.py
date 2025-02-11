from __future__ import annotations

import logging
import pickle
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timezone
from enum import Enum
from time import time
from typing import Any, TypeVar

import rb
from django.utils.encoding import force_bytes, force_str
from rediscluster import RedisCluster

from sentry.buffer.base import Buffer, BufferField
from sentry.db import models
from sentry.tasks.process_buffer import process_incr
from sentry.utils import json, metrics
from sentry.utils.hashlib import md5_text
from sentry.utils.imports import import_string
from sentry.utils.redis import (
    get_cluster_routing_client,
    get_dynamic_cluster_from_options,
    is_instance_rb_cluster,
    is_instance_redis_cluster,
    validate_dynamic_cluster,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", str, bytes)
# Debounce our JSON validation a bit in order to not cause too much additional
# load everywhere
_last_validation_log: float | None = None
Pipeline = Any
# TODO: type Pipeline instead of using Any here


def _get_model_key(model: type[models.Model]) -> str:
    return str(model._meta)


def _validate_json_roundtrip(value: dict[str, Any], model: type[models.Model]) -> None:
    global _last_validation_log

    if _last_validation_log is None or _last_validation_log < time() - 10:
        _last_validation_log = time()
        try:
            if (
                RedisBuffer._load_values(json.loads(json.dumps(RedisBuffer._dump_values(value))))
                != value
            ):
                logger.error("buffer.corrupted_value", extra={"value": value, "model": model})
        except Exception:
            logger.exception("buffer.invalid_value", extra={"value": value, "model": model})


class BufferHookEvent(Enum):
    FLUSH = "flush"


class BufferHookRegistry:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._registry: dict[BufferHookEvent, Callable[..., Any]] = {}

    def add_handler(self, key: BufferHookEvent, func: Callable[..., Any]) -> None:
        self._registry[key] = func

    def has(self, key: BufferHookEvent) -> bool:
        return self._registry.get(key) is not None

    def callback(self, buffer_hook_event: BufferHookEvent) -> bool:
        try:
            callback = self._registry[buffer_hook_event]
        except KeyError:
            logger.exception("buffer_hook_event.missing")

        return callback()


redis_buffer_registry = BufferHookRegistry()


# Callable to get the queue name for the given model_key.
# May return None to not assign a queue for the given model_key.
ChooseQueueFunction = Callable[[str], str | None]


@dataclass
class PendingBufferValue:
    model_key: str | None
    pending_buffer: PendingBuffer
    generate_queue: ChooseQueueFunction | None


class PendingBufferRouter:
    def __init__(self, incr_batch_size: int) -> None:
        self.incr_batch_size = incr_batch_size
        self.default_pending_buffer = PendingBuffer(self.incr_batch_size)
        # map of model_key to PendingBufferValue
        self.pending_buffer_router: dict[str, PendingBufferValue] = dict()

    def create_pending_buffer(self, model_key: str, generate_queue: ChooseQueueFunction) -> None:
        """
        Create a PendingBuffer for the given model_key and queue name.
        We assume that there will be a dedicated queue for the given model associated with the model_key.
        """
        pending_buffer = PendingBuffer(self.incr_batch_size)
        self.pending_buffer_router[model_key] = PendingBufferValue(
            model_key=model_key, pending_buffer=pending_buffer, generate_queue=generate_queue
        )

    def get_pending_buffer(self, model_key: str | None) -> PendingBuffer:
        """
        Get the pending buffer assigned to the given model_key.
        """
        if model_key is not None and model_key in self.pending_buffer_router:
            return self.pending_buffer_router[model_key].pending_buffer
        return self.default_pending_buffer

    def queue(self, model_key: str) -> str | None:
        """
        Get the queue name for the given model_key.
        """
        metrics.incr(f"pendingbuffer-router.queue.{model_key}")
        if model_key in self.pending_buffer_router:
            metrics.incr(f"pendingbuffer-router.queue-found.{model_key}")
            generate_queue = self.pending_buffer_router[model_key].generate_queue
            if generate_queue is not None:
                return generate_queue(model_key)
        return None

    def pending_buffers(self) -> list[PendingBufferValue]:
        pending_buffers = list(self.pending_buffer_router.values())
        pending_buffers.append(
            PendingBufferValue(
                model_key=None, pending_buffer=self.default_pending_buffer, generate_queue=None
            )
        )
        return pending_buffers


class RedisBufferRouter:
    def __init__(self) -> None:
        # map of model_key (generated from _get_model_key function) to queue name
        self._routers: dict[str, ChooseQueueFunction] = dict()

    def assign_queue(self, model: type[models.Model], generate_queue: ChooseQueueFunction) -> None:
        """
        RedisBuffer is shared among multiple models.
        Thus, the process_incr task and the default assigned queue for it is shared among multiple models.
        If any backlogs or slowdowns occur when incrementing counts for any specific model, other models will be affected.

        To alleviate this, we can assign a dedicated queue for any given model.
        If a dedicated queue is assigned, the process_incr task will be processed in the assigned queue.
        On the other hand, if no dedicated queue is assigned, the process_incr task will be processed in
        the default queue (i.e. counters-0 queue).

        A queue can be assigned to a model by passing in the generate_queue function.
        """
        key = _get_model_key(model=model)
        metrics.incr(f"redisbuffer-router.assign_queue.{key}")
        self._routers[key] = generate_queue

    def create_pending_buffers_router(self, incr_batch_size: int) -> PendingBufferRouter:
        """
        We create a PendingBuffer (with buffer size incr_batch_size) for each model with an assigned queue.
        In addition, we create a default PendingBuffer (with buffer size incr_batch_size) for models without an
        assigned queue. The default PendingBuffer is implicitly assigned to the default queue of the process_incr task.

        These PendingBuffers are wrapped in a PendingBufferRouter.
        """
        pending_buffers_router = PendingBufferRouter(incr_batch_size=incr_batch_size)
        for model_key, generate_queue in self._routers.items():
            pending_buffers_router.create_pending_buffer(
                model_key=model_key, generate_queue=generate_queue
            )
        return pending_buffers_router


redis_buffer_router = RedisBufferRouter()


# Note HMSET is not supported after redis 4.0.0, after updating we can use HSET directly.
class RedisOperation(Enum):
    SORTED_SET_ADD = "zadd"
    SORTED_SET_GET_RANGE = "zrangebyscore"
    SORTED_SET_DELETE_RANGE = "zremrangebyscore"
    HASH_ADD = "hset"
    HASH_ADD_BULK = "hmset"
    HASH_GET_ALL = "hgetall"
    HASH_DELETE = "hdel"
    HASH_LENGTH = "hlen"


class PendingBuffer:
    def __init__(self, size: int):
        assert size > 0
        self.buffer: list[str | None] = [None] * size
        self.size = size
        self.pointer = 0

    def full(self) -> bool:
        return self.pointer == self.size

    def empty(self) -> bool:
        return self.pointer == 0

    def append(self, item: str) -> None:
        assert not self.full()
        self.buffer[self.pointer] = item
        self.pointer += 1

    def clear(self) -> None:
        self.pointer = 0

    def flush(self) -> list[str | None]:
        rv = self.buffer[: self.pointer]
        self.clear()
        return rv


class RedisBuffer(Buffer):
    key_expire = 60 * 60  # 1 hour
    pending_key = "b:p"

    def __init__(self, incr_batch_size: int = 2, **options: object):
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_BUFFER_OPTIONS", options
        )
        self.incr_batch_size = incr_batch_size
        assert self.incr_batch_size > 0

    def validate(self) -> None:
        validate_dynamic_cluster(self.is_redis_cluster, self.cluster)

    def _coerce_val(self, value: BufferField) -> bytes:
        if isinstance(value, models.Model):
            value = value.pk
        return force_bytes(value, errors="replace")

    def _make_key(self, model: type[models.Model], filters: dict[str, Any]) -> str:
        """
        Returns a Redis-compatible key for the model given filters.
        """
        md5 = md5_text(
            "&".join(f"{k}={self._coerce_val(v)!r}" for k, v in sorted(filters.items()))
        ).hexdigest()
        model_key = _get_model_key(model=model)
        return f"b:k:{model_key}:{md5}"

    def _extract_model_from_key(self, key: str) -> str | None:
        """
        Extracts the model metadata from a Redis key.
        """
        try:
            parts = key.split(":")

            if len(parts) != 4 or parts[0] != "b" or parts[1] != "k":
                return None

            return parts[2]
        except Exception:
            return None

    def _make_lock_key(self, key: str) -> str:
        return f"l:{key}"

    def _lock_key(
        self, client: RedisCluster[T] | rb.RoutingClient, key: str, ex: int
    ) -> None | str:
        lock_key = self._make_lock_key(key)
        # prevent a stampede due to celerybeat + periodic task
        if not client.set(lock_key, "1", nx=True, ex=ex):
            return None
        return lock_key

    @classmethod
    def _dump_values(cls, values: dict[Any, Any]) -> dict[Any, tuple[str, str]]:
        result = {}
        for k, v in values.items():
            result[k] = cls._dump_value(v)
        return result

    @classmethod
    def _dump_value(cls, value: str | datetime | date | int | float) -> tuple[str, str]:
        if isinstance(value, str):
            type_ = "s"
        elif isinstance(value, datetime):
            type_ = "dt"
            value = value.strftime("%s.%f")
        elif isinstance(value, date):
            type_ = "d"
            value = value.strftime("%s.%f")
        elif isinstance(value, int):
            type_ = "i"
        elif isinstance(value, float):
            type_ = "f"
        else:
            raise TypeError(type(value))
        return type_, str(value)

    @classmethod
    def _load_values(
        cls, payload: dict[str, tuple[str, Any]]
    ) -> dict[str, str | datetime | date | int | float]:
        result = {}
        for k, (t, v) in payload.items():
            result[k] = cls._load_value((t, v))
        return result

    @classmethod
    def _load_value(cls, payload: tuple[str, Any]) -> str | datetime | date | int | float:
        (type_, value) = payload
        if type_ == "s":
            return force_str(value)
        elif type_ == "dt":
            return datetime.fromtimestamp(float(value)).replace(tzinfo=timezone.utc)
        elif type_ == "d":
            return date.fromtimestamp(float(value))
        elif type_ == "i":
            return int(value)
        elif type_ == "f":
            return float(value)
        else:
            raise TypeError(f"invalid type: {type_}")

    def get(
        self,
        model: type[models.Model],
        columns: list[str],
        filters: dict[str, Any],
    ) -> dict[str, int]:
        """
        Fetches buffered values for a model/filter. Passed columns must be integer columns.
        """
        key = self._make_key(model, filters)
        pipe = self.get_redis_connection(key, transaction=False)

        for col in columns:
            pipe.hget(key, f"i+{col}")
        results = pipe.execute()

        return {
            col: (int(results[i]) if results[i] is not None else 0) for i, col in enumerate(columns)
        }

    def get_redis_connection(self, key: str, transaction: bool = True) -> Pipeline:
        if is_instance_redis_cluster(self.cluster, self.is_redis_cluster):
            conn = self.cluster
        elif is_instance_rb_cluster(self.cluster, self.is_redis_cluster):
            conn = self.cluster.get_local_client_for_key(key)
        else:
            raise AssertionError("unreachable")

        pipe = conn.pipeline(transaction=transaction)
        return pipe

    def _execute_redis_operation(
        self, key: str, operation: RedisOperation, *args: Any, **kwargs: Any
    ) -> Any:
        metrics_str = f"redis_buffer.{operation.value}"
        metrics.incr(metrics_str)
        pipe = self.get_redis_connection(self.pending_key)
        getattr(pipe, operation.value)(key, *args, **kwargs)
        if args:
            pipe.expire(key, self.key_expire)
        return pipe.execute()[0]

    def push_to_sorted_set(self, key: str, value: list[int] | int) -> None:
        value_dict = {value: time()}
        self._execute_redis_operation(key, RedisOperation.SORTED_SET_ADD, value_dict)

    def get_sorted_set(self, key: str, min: float, max: float) -> list[tuple[int, datetime]]:
        redis_set = self._execute_redis_operation(
            key,
            RedisOperation.SORTED_SET_GET_RANGE,
            min=min,
            max=max,
            withscores=True,
        )
        decoded_set = []
        for items in redis_set:
            item = items[0]
            if isinstance(item, bytes):
                item = item.decode("utf-8")
            data_and_timestamp = (int(item), items[1])
            decoded_set.append(data_and_timestamp)
        return decoded_set

    def delete_key(self, key: str, min: float, max: float) -> None:
        self._execute_redis_operation(key, RedisOperation.SORTED_SET_DELETE_RANGE, min=min, max=max)

    def delete_hash(
        self,
        model: type[models.Model],
        filters: dict[str, BufferField],
        fields: list[str],
    ) -> None:
        key = self._make_key(model, filters)
        pipe = self.get_redis_connection(self.pending_key)
        for field in fields:
            getattr(pipe, RedisOperation.HASH_DELETE.value)(key, field)
        pipe.expire(key, self.key_expire)
        pipe.execute()

    def push_to_hash(
        self,
        model: type[models.Model],
        filters: dict[str, BufferField],
        field: str,
        value: str,
    ) -> None:
        key = self._make_key(model, filters)
        self._execute_redis_operation(key, RedisOperation.HASH_ADD, field, value)

    def push_to_hash_bulk(
        self,
        model: type[models.Model],
        filters: dict[str, BufferField],
        data: dict[str, str],
    ) -> None:
        key = self._make_key(model, filters)
        self._execute_redis_operation(key, RedisOperation.HASH_ADD_BULK, data)

    def get_hash(self, model: type[models.Model], field: dict[str, BufferField]) -> dict[str, str]:
        key = self._make_key(model, field)
        redis_hash = self._execute_redis_operation(key, RedisOperation.HASH_GET_ALL)
        decoded_hash = {}
        for k, v in redis_hash.items():
            if isinstance(k, bytes):
                k = k.decode("utf-8")
            if isinstance(v, bytes):
                v = v.decode("utf-8")
            decoded_hash[k] = v

        return decoded_hash

    def get_hash_length(self, model: type[models.Model], field: dict[str, BufferField]) -> int:
        key = self._make_key(model, field)
        return self._execute_redis_operation(key, RedisOperation.HASH_LENGTH)

    def process_batch(self) -> None:
        try:
            redis_buffer_registry.callback(BufferHookEvent.FLUSH)
        except Exception:
            logger.exception("process_batch.error")

    def incr(
        self,
        model: type[models.Model],
        columns: dict[str, int],
        filters: dict[str, BufferField],
        extra: dict[str, Any] | None = None,
        signal_only: bool | None = None,
    ) -> None:
        """
        Increment the key by doing the following:

        - Insert/update a hashmap based on (model, columns)
            - Perform an incrby on counters if is_instance_redis_cluster(self.cluster, self.is_redis_cluster):
            - Perform a set (last write wins) on extra
            - Perform a set on signal_only (only if True)
        - Add hashmap key to pending flushes
        """
        key = self._make_key(model, filters)
        # We can't use conn.map() due to wanting to support multiple pending
        # keys (one per Redis partition)
        pipe = self.get_redis_connection(key)
        pipe.hsetnx(key, "m", f"{model.__module__}.{model.__name__}")
        _validate_json_roundtrip(filters, model)

        if is_instance_redis_cluster(self.cluster, self.is_redis_cluster):
            pipe.hsetnx(key, "f", json.dumps(self._dump_values(filters)))
        else:
            pipe.hsetnx(key, "f", pickle.dumps(filters))

        for column, amount in columns.items():
            pipe.hincrby(key, "i+" + column, amount)

        if extra:
            # Group tries to serialize 'score', so we'd need some kind of processing
            # hook here
            # e.g. "update score if last_seen or times_seen is changed"
            _validate_json_roundtrip(extra, model)
            for column, value in extra.items():
                if is_instance_redis_cluster(self.cluster, self.is_redis_cluster):
                    pipe.hset(key, "e+" + column, json.dumps(self._dump_value(value)))
                else:
                    pipe.hset(key, "e+" + column, pickle.dumps(value))

        if signal_only is True:
            pipe.hset(key, "s", "1")

        pipe.expire(key, self.key_expire)
        pipe.zadd(self.pending_key, {key: time()})
        pipe.execute()

        metrics.incr(
            "buffer.incr",
            skip_internal=True,
            tags={"module": model.__module__, "model": model.__name__},
        )

    def process_pending(self) -> None:
        client = get_cluster_routing_client(self.cluster, self.is_redis_cluster)
        lock_key = self._lock_key(client, self.pending_key, ex=60)
        if not lock_key:
            return

        pending_buffers_router = redis_buffer_router.create_pending_buffers_router(
            incr_batch_size=self.incr_batch_size
        )

        def _generate_process_incr_kwargs(model_key: str | None) -> dict[str, Any]:
            # The queue to be used for the process_incr task is determined in the following order of precedence:
            # 1. The queue argument passed to process_incr.apply_async()
            # 2. The queue defined on the process_incr task
            # 3. Any defined routes in CELERY_ROUTES
            #
            # See: https://docs.celeryq.dev/en/latest/userguide/routing.html#specifying-task-destination
            #
            # Hence, we override the default queue of the process_incr task by passing in the assigned queue for the
            # model associated with the model_key.
            process_incr_kwargs: dict[str, Any] = dict()
            if model_key is None:
                metrics.incr("buffer.process-incr.model-key-missing")
                return process_incr_kwargs
            queue = pending_buffers_router.queue(model_key=model_key)
            if queue is not None:
                process_incr_kwargs["queue"] = queue
                metrics.incr("buffer.process-incr-queue", tags={"queue": queue})
            else:
                metrics.incr("buffer.process-incr-default-queue")
            return process_incr_kwargs

        try:
            keycount = 0
            if is_instance_redis_cluster(self.cluster, self.is_redis_cluster):
                keys: list[str] = self.cluster.zrange(self.pending_key, 0, -1)
                keycount += len(keys)

                for key in keys:
                    model_key = self._extract_model_from_key(key=key)
                    pending_buffer = pending_buffers_router.get_pending_buffer(model_key=model_key)
                    pending_buffer.append(item=key)
                    if pending_buffer.full():
                        process_incr_kwargs = _generate_process_incr_kwargs(model_key=model_key)
                        process_incr.apply_async(
                            kwargs={"batch_keys": pending_buffer.flush()},
                            headers={"sentry-propagate-traces": False},
                            **process_incr_kwargs,
                        )

                self.cluster.zrem(self.pending_key, *keys)
            elif is_instance_rb_cluster(self.cluster, self.is_redis_cluster):
                with self.cluster.all() as conn:
                    results = conn.zrange(self.pending_key, 0, -1)

                with self.cluster.all() as conn:
                    for host_id, keysb in results.value.items():
                        if not keysb:
                            continue
                        keycount += len(keysb)
                        for keyb in keysb:
                            key = keyb.decode("utf-8")
                            model_key = self._extract_model_from_key(key=key)
                            pending_buffer = pending_buffers_router.get_pending_buffer(
                                model_key=model_key
                            )
                            pending_buffer.append(item=key)
                            if pending_buffer.full():
                                process_incr_kwargs = _generate_process_incr_kwargs(
                                    model_key=model_key
                                )
                                process_incr.apply_async(
                                    kwargs={"batch_keys": pending_buffer.flush()},
                                    headers={"sentry-propagate-traces": False},
                                    **process_incr_kwargs,
                                )
                        conn.target([host_id]).zrem(self.pending_key, *keysb)
            else:
                raise AssertionError("unreachable")

            # process any non-empty pending buffers
            for pending_buffer_value in pending_buffers_router.pending_buffers():
                pending_buffer = pending_buffer_value.pending_buffer
                model_key = pending_buffer_value.model_key

                if not pending_buffer.empty():
                    process_incr_kwargs = _generate_process_incr_kwargs(model_key=model_key)
                    process_incr.apply_async(
                        kwargs={"batch_keys": pending_buffer.flush()},
                        headers={"sentry-propagate-traces": False},
                        **process_incr_kwargs,
                    )

            metrics.distribution("buffer.pending-size", keycount)
        finally:
            client.delete(lock_key)

    def process(self, key: str | None = None, batch_keys: list[str] | None = None) -> None:  # type: ignore[override]
        assert not (key is None and batch_keys is None)
        assert not (key is not None and batch_keys is not None)

        if key is not None:
            batch_keys = [key]

        if batch_keys is not None:
            for key in batch_keys:
                self._process_single_incr(key)

    def _process(
        self,
        model: type[models.Model],
        columns: dict[str, int],
        filters: dict[str, Any],
        extra: dict[str, Any] | None = None,
        signal_only: bool | None = None,
    ) -> Any:
        return super().process(model, columns, filters, extra, signal_only)

    def _process_single_incr(self, key: str) -> None:
        client = get_cluster_routing_client(self.cluster, self.is_redis_cluster)
        lock_key = self._lock_key(client, key, ex=10)
        if not lock_key:
            metrics.incr("buffer.revoked", tags={"reason": "locked"}, skip_internal=False)
            logger.debug("buffer.revoked.locked", extra={"redis_key": key})
            return

        try:
            pipe = self.get_redis_connection(key, transaction=False)
            pipe.hgetall(key)
            pipe.zrem(self.pending_key, key)
            pipe.delete(key)
            values = pipe.execute()[0]

            # XXX(python3): In python2 this isn't as important since redis will
            # return string tyes (be it, byte strings), but in py3 we get bytes
            # back, and really we just want to deal with keys as strings.
            values = {force_str(k): v for k, v in values.items()}

            if not values:
                metrics.incr("buffer.revoked", tags={"reason": "empty"}, skip_internal=False)
                logger.debug("buffer.revoked.empty", extra={"redis_key": key})
                return

            model = import_string(force_str(values.pop("m")))

            if values["f"].startswith(b"{" if not self.is_redis_cluster else "{"):
                filters = self._load_values(json.loads(force_str(values.pop("f"))))
            else:
                # TODO(dcramer): legacy pickle support - remove in Sentry 9.1
                filters = pickle.loads(force_bytes(values.pop("f")))

            incr_values = {}
            extra_values = {}
            signal_only = None
            for k, v in values.items():
                if k.startswith("i+"):
                    incr_values[k[2:]] = int(v)
                elif k.startswith("e+"):
                    if v.startswith(b"[" if not self.is_redis_cluster else "["):
                        extra_values[k[2:]] = self._load_value(json.loads(force_str(v)))
                    else:
                        # TODO(dcramer): legacy pickle support - remove in Sentry 9.1
                        extra_values[k[2:]] = pickle.loads(force_bytes(v))
                elif k == "s":
                    signal_only = bool(int(v))  # Should be 1 if set

            self._process(model, incr_values, filters, extra_values, signal_only)
        finally:
            client.delete(lock_key)

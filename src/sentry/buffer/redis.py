from __future__ import annotations

import logging
import pickle
import threading
from datetime import date, datetime, timezone
from time import time

from django.db import models
from django.utils.encoding import force_bytes, force_str

from sentry.buffer.base import Buffer
from sentry.tasks.process_buffer import process_incr, process_pending
from sentry.utils import json, metrics
from sentry.utils.compat import crc32
from sentry.utils.hashlib import md5_text
from sentry.utils.imports import import_string
from sentry.utils.redis import get_dynamic_cluster_from_options, validate_dynamic_cluster

_local_buffers = None
_local_buffers_lock = threading.Lock()

logger = logging.getLogger(__name__)

# Debounce our JSON validation a bit in order to not cause too much additional
# load everywhere
_last_validation_log: float | None = None


def _validate_json_roundtrip(value, model):
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


class PendingBuffer:
    def __init__(self, size):
        assert size > 0
        self.buffer = [None] * size
        self.size = size
        self.pointer = 0

    def full(self):
        return self.pointer == self.size

    def empty(self):
        return self.pointer == 0

    def append(self, item):
        assert not self.full()
        self.buffer[self.pointer] = item
        self.pointer += 1

    def clear(self):
        self.pointer = 0

    def flush(self):
        rv = self.buffer[: self.pointer]
        self.clear()
        return rv


class RedisBuffer(Buffer):
    key_expire = 60 * 60  # 1 hour
    pending_key = "b:p"

    def __init__(self, pending_partitions=1, incr_batch_size=2, **options):
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_BUFFER_OPTIONS", options
        )
        self.pending_partitions = pending_partitions
        self.incr_batch_size = incr_batch_size
        assert self.pending_partitions > 0
        assert self.incr_batch_size > 0

    def get_routing_client(self):
        if self.is_redis_cluster:
            return self.cluster
        else:
            return self.cluster.get_routing_client()

    def validate(self):
        validate_dynamic_cluster(self.is_redis_cluster, self.cluster)

    def _coerce_val(self, value):
        if isinstance(value, models.Model):
            value = value.pk
        return force_bytes(value, errors="replace")

    def _make_key(self, model, filters):
        """
        Returns a Redis-compatible key for the model given filters.
        """
        md5 = md5_text(
            "&".join(f"{k}={self._coerce_val(v)}" for k, v in sorted(filters.items()))
        ).hexdigest()
        return f"b:k:{model._meta}:{md5}"

    def _make_pending_key(self, partition=None):
        """
        Returns the key to be used for the pending buffer.
        When partitioning is enabled, there is a key for each
        partition, without it, there's only the default pending_key
        """
        if partition is None:
            return self.pending_key
        assert partition >= 0
        return "%s:%d" % (self.pending_key, partition)

    def _make_pending_key_from_key(self, key):
        """
        Return the pending_key for a given key. This is used
        to route a key into the correct pending buffer. If partitioning
        is disabled, route into the no partition buffer.
        """
        if self.pending_partitions == 1:
            return self.pending_key
        return self._make_pending_key(crc32(key) % self.pending_partitions)

    def _make_lock_key(self, key):
        return f"l:{key}"

    @classmethod
    def _dump_values(cls, values):
        result = {}
        for k, v in values.items():
            result[k] = cls._dump_value(v)
        return result

    @classmethod
    def _dump_value(cls, value):
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
        return (type_, str(value))

    @classmethod
    def _load_values(cls, payload):
        result = {}
        for k, (t, v) in payload.items():
            result[k] = cls._load_value((t, v))
        return result

    @classmethod
    def _load_value(cls, payload):
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

    def get(self, model, columns, filters):
        """
        Fetches buffered values for a model/filter. Passed columns must be integer columns.
        """
        key = self._make_key(model, filters)
        if self.is_redis_cluster:
            pipe = self.cluster.pipeline(transaction=False)
        else:
            conn = self.cluster.get_local_client_for_key(key)
            pipe = conn.pipeline()

        for col in columns:
            pipe.hget(key, f"i+{col}")
        results = pipe.execute()

        return {
            col: (int(results[i]) if results[i] is not None else 0) for i, col in enumerate(columns)
        }

    def incr(self, model, columns, filters, extra=None, signal_only=None, return_incr_results=True):
        """
        Increment the key by doing the following:

        - Insert/update a hashmap based on (model, columns)
            - Perform an incrby on counters
            - Perform a set (last write wins) on extra
            - Perform a set on signal_only (only if True)
        - Add hashmap key to pending flushes
        """

        key = self._make_key(model, filters)
        pending_key = self._make_pending_key_from_key(key)
        # We can't use conn.map() due to wanting to support multiple pending
        # keys (one per Redis partition)
        if self.is_redis_cluster:
            conn = self.cluster
        else:
            conn = self.cluster.get_local_client_for_key(key)

        pipe = conn.pipeline()
        pipe.hsetnx(key, "m", f"{model.__module__}.{model.__name__}")
        _validate_json_roundtrip(filters, model)

        if self.is_redis_cluster:
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
                if self.is_redis_cluster:
                    pipe.hset(key, "e+" + column, json.dumps(self._dump_value(value)))
                else:
                    pipe.hset(key, "e+" + column, pickle.dumps(value))

        if signal_only is True:
            pipe.hset(key, "s", "1")

        pipe.expire(key, self.key_expire)
        pipe.zadd(pending_key, {key: time()})
        pipe.execute()

        metrics.incr(
            "buffer.incr",
            skip_internal=True,
            tags={"module": model.__module__, "model": model.__name__},
        )

    def process_pending(self, partition=None):
        if partition is None and self.pending_partitions > 1:
            # If we're using partitions, this one task fans out into
            # N subtasks instead.
            for i in range(self.pending_partitions):
                process_pending.apply_async(kwargs={"partition": i})
            # Explicitly also run over the unpartitioned buffer as well
            # to ease in transition. In practice, this should just be
            # super fast and is fine to do redundantly.

        pending_key = self._make_pending_key(partition)
        if self.is_redis_cluster:
            client = self.cluster
        else:
            client = self.cluster.get_routing_client()
        lock_key = self._make_lock_key(pending_key)
        # prevent a stampede due to celerybeat + periodic task
        if not client.set(lock_key, "1", nx=True, ex=60):
            return

        pending_buffer = PendingBuffer(self.incr_batch_size)

        try:
            keycount = 0
            if self.is_redis_cluster:
                keys = self.cluster.zrange(pending_key, 0, -1)
                keycount += len(keys)

                for key in keys:
                    pending_buffer.append(key)
                    if pending_buffer.full():
                        process_incr.apply_async(kwargs={"batch_keys": pending_buffer.flush()})

                self.cluster.zrem(pending_key, *keys)
            else:
                with self.cluster.all() as conn:
                    results = conn.zrange(pending_key, 0, -1)

                with self.cluster.all() as conn:
                    for host_id, keys in results.value.items():
                        if not keys:
                            continue
                        keycount += len(keys)
                        for key in keys:
                            pending_buffer.append(key.decode("utf-8"))
                            if pending_buffer.full():
                                process_incr.apply_async(
                                    kwargs={"batch_keys": pending_buffer.flush()}
                                )
                        conn.target([host_id]).zrem(pending_key, *keys)

            # queue up remainder of pending keys
            if not pending_buffer.empty():
                process_incr.apply_async(kwargs={"batch_keys": pending_buffer.flush()})

            metrics.distribution("buffer.pending-size", keycount)
        finally:
            client.delete(lock_key)

    def process(self, key=None, batch_keys=None):
        assert not (key is None and batch_keys is None)
        assert not (key is not None and batch_keys is not None)

        if key is not None:
            batch_keys = [key]

        for key in batch_keys:
            self._process_single_incr(key)

    def _process(self, model, columns, filters, extra=None, signal_only=None):
        return super().process(model, columns, filters, extra, signal_only)

    def _process_single_incr(self, key):
        if self.is_redis_cluster:
            client = self.cluster
        else:
            client = self.cluster.get_routing_client()

        lock_key = self._make_lock_key(key)
        # prevent a stampede due to the way we use celery etas + duplicate
        # tasks
        if not client.set(lock_key, "1", nx=True, ex=10):
            metrics.incr("buffer.revoked", tags={"reason": "locked"}, skip_internal=False)
            logger.debug("buffer.revoked.locked", extra={"redis_key": key})
            return

        pending_key = self._make_pending_key_from_key(key)

        try:
            if self.is_redis_cluster:
                pipe = self.cluster.pipeline(transaction=False)
            else:
                conn = self.cluster.get_local_client_for_key(key)
                pipe = conn.pipeline()

            pipe.hgetall(key)
            pipe.zrem(pending_key, key)
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

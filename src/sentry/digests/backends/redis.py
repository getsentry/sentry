from __future__ import annotations

import logging
import time
import zlib
from collections.abc import Generator, Iterable
from contextlib import contextmanager
from typing import Any, cast

from redis.client import StrictRedis
from redis.exceptions import ResponseError
from sentry_redis_tools.clients import RedisCluster

from sentry.digests.backends.base import Backend, InvalidState, ScheduleEntry
from sentry.digests.types import Record
from sentry.utils.locking.backends.redis import RedisClusterLockBackend
from sentry.utils.locking.lock import Lock
from sentry.utils.locking.manager import LockManager
from sentry.utils.redis import (
    get_dynamic_cluster_from_options,
    load_redis_script,
    validate_dynamic_cluster,
)

logger = logging.getLogger("sentry.digests")

script = load_redis_script("digests/digests.lua")


class RedisBackend(Backend):
    """
    Implements the digest backend API, backed by Redis.

    Each timeline is modeled as a sorted set, and also maintains a separate key
    that contains the last time the digest was processed (used for scheduling.)

    .. code::

        redis:6379> ZREVRANGEBYSCORE "d:t:mail:p:1" inf -inf WITHSCORES
        1) "433be20b807c4cd49a132de69c0f6c55"
        2) "1444847625"
        3) "0f9d5fe4b5b3400fab85d9a841aa8467"
        4) "1444847625"
        ...

    The timeline contains references to several records, which are stored
    separately, encoded using the codec provided to the backend:

    .. code::

        redis:6379> GET "d:t:mail:p:1:r:433be20b807c4cd49a132de69c0f6c55"
        [ binary content ]

    When the timeline is ready to be digested, the timeline set is renamed,
    creating a digest set (in this case the key would be ``d:t:mail:p:1:d``),
    that represents a snapshot of the timeline contents at that point in time.
    (If the digest set already exists, the timeline contents are instead
    unioned into the digest set and then the timeline is cleared.) This allows
    new records to be added to the timeline that will be processed after the
    next scheduling interval without the risk of data loss due to race
    conditions between the record addition and digest generation and delivery.

    Schedules are modeled as two sorted sets -- one for ``waiting`` items, and
    one for ``ready`` items. Items in the ``waiting`` set are scored by the
    time at which they should be transitioned to the ``ready`` set.  Items in
    the ``ready`` set are scored by the time at which they were scheduled to be
    added to the ``ready`` set. Iterating each set from oldest to newest yields
    the highest priority items for action (moving from the ``waiting`` to
    ``ready`` set, or delivering a digest for the ``waiting`` and ``ready``
    set, respectively.)

    .. code::

        redis:6379> ZREVRANGEBYSCORE "d:s:w" inf -inf WITHSCORES
        1) "mail:p:1"
        2) "1444847638"

    On a single Redis host that is not in cluster mode, the keys above are used
    as shown, and there is one schedule partition.

    On redis-cluster, one script call must only touch keys in one hash slot.
    Each timeline is put in one of a fixed number of schedule partitions (see
    the ``schedule_partitions`` option), and the namespace gets a hash tag for
    that partition. For example, if ``mail:p:1`` is in partition 3, its keys
    are ``{d:3}:t:mail:p:1``, ``{d:3}:t:mail:p:1:r:<record>``, and so on, and
    it is scheduled in ``{d:3}:s:w`` and ``{d:3}:s:r``. All of these keys are
    in the same hash slot.
    """

    cluster: RedisCluster[bytes] | StrictRedis[bytes]

    def __init__(self, **options: Any) -> None:
        cluster_name = options.get("cluster", "default")
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_DIGESTS_OPTIONS", options, decode_responses=False
        )
        options.pop("cluster", None)
        self.locks = LockManager(RedisClusterLockBackend(cluster_name))

        self.namespace = options.pop("namespace", "d")

        # The number of schedule partitions on redis-cluster.
        # Each partition is one hash slot, so a higher value spreads the data over
        # more nodes, the tradeoff is that the scheduler must run one script call
        # for each partition.
        #
        # To change this value, also change ``namespace``. If only this value
        # changes, a timeline can move to a different partition, but its entry
        # stays in the old schedule partition. The scheduler still reads that
        # partition, so each run sends the timeline for delivery again, and
        # the delivery fails. With a new namespace, all keys are new, and the
        # keys in the old namespace expire because nothing reads them.
        #
        # Note: this does NOT fix the issue where digests that are pending
        # at the time of the change are not sent.
        self.schedule_partitions = options.pop("schedule_partitions", 64)
        if self.schedule_partitions < 1:
            raise ValueError("The number of schedule partitions must be at least 1.")

        # Sets the time-to-live (in seconds) for records, timelines, and
        # digests. This can (and should) be a relatively high value, since
        # timelines, digests, and records should all be deleted after they have
        # been processed -- this is mainly to ensure stale data doesn't hang
        # around too long in the case of a configuration error. This should be
        # larger than the maximum scheduling delay to ensure data is not evicted
        # too early.
        self.ttl = options.pop("ttl", 60 * 60)

        super().__init__(**options)

    def validate(self) -> None:
        validate_dynamic_cluster(self.cluster)

    def _get_partition_namespace(self, partition: int) -> str:
        return f"{{{self.namespace}:{partition}}}"

    def _get_timeline_namespace(self, key: str) -> str:
        if not self.is_redis_cluster:
            namespace = self.namespace
            return namespace

        # Use a stable hash. The built-in ``hash`` is different in each process.
        partition = zlib.crc32(key.encode("utf-8")) % self.schedule_partitions
        return self._get_partition_namespace(partition)

    def _get_timeline_key(self, key: str) -> str:
        return f"{self._get_timeline_namespace(key)}:t:{key}"

    def _get_timeline_lock(self, key: str, duration: int) -> Lock:
        lock_key = self._get_timeline_key(key)
        return self.locks.get(lock_key, duration=duration, name="digest_timeline_lock")

    def _get_schedule_partitions(self) -> Iterable[tuple[int, str]]:
        """
        Returns the partition id and the namespace for each schedule partition.
        """
        if not self.is_redis_cluster:
            yield 0, self.namespace
            return

        for partition in range(self.schedule_partitions):
            yield partition, self._get_partition_namespace(partition)

    def add(
        self,
        key: str,
        record: Record,
        increment_delay: int | None = None,
        maximum_delay: int | None = None,
        timestamp: float | None = None,
    ) -> bool:
        if timestamp is None:
            timestamp = time.time()

        if increment_delay is None:
            increment_delay = self.increment_delay

        if maximum_delay is None:
            maximum_delay = self.maximum_delay

        # Redis returns "true" and "false" as "1" and "None", so we just cast
        # them back to the appropriate boolean here.
        return bool(
            script(
                [self._get_timeline_key(key)],
                [
                    "ADD",
                    self._get_timeline_namespace(key),
                    self.ttl,
                    timestamp,
                    key,
                    record.key,
                    self.codec.encode(record.value),
                    record.timestamp,  # TODO: check type
                    increment_delay,
                    maximum_delay,
                    self.capacity if self.capacity else -1,
                    self.truncation_chance,
                ],
                self.cluster,
            )
        )

    def __schedule_partition(
        self,
        namespace: str,
        deadline: float,
        timestamp: float,
    ) -> Iterable[tuple[bytes, float]]:
        return cast(
            "Iterable[tuple[bytes, float]]",
            script(
                [f"{namespace}:s:w"],
                ["SCHEDULE", namespace, self.ttl, timestamp, deadline],
                self.cluster,
            ),
        )

    def schedule(self, deadline: float, timestamp: float | None = None) -> Iterable[ScheduleEntry]:
        if timestamp is None:
            timestamp = time.time()

        for partition, namespace in self._get_schedule_partitions():
            try:
                for key, timestamp in self.__schedule_partition(namespace, deadline, timestamp):
                    yield ScheduleEntry(key.decode("utf-8"), float(timestamp))
            except Exception as error:
                logger.exception(
                    "Failed to perform scheduling for partition %s due to error: %s",
                    partition,
                    error,
                )

    def __maintenance_partition(
        self,
        namespace: str,
        deadline: float,
        timestamp: float,
    ) -> None:
        script(
            [f"{namespace}:s:w"],
            ["MAINTENANCE", namespace, self.ttl, timestamp, deadline],
            self.cluster,
        )

    def maintenance(self, deadline: float, timestamp: float | None = None) -> None:
        if timestamp is None:
            timestamp = time.time()

        for partition, namespace in self._get_schedule_partitions():
            try:
                self.__maintenance_partition(namespace, deadline, timestamp)
            except Exception as error:
                logger.exception(
                    "Failed to perform maintenance on digest partition %s due to error: %s",
                    partition,
                    error,
                )

    @contextmanager
    def digest(
        self, key: str, minimum_delay: int | None = None, timestamp: float | None = None
    ) -> Generator[list[Record]]:
        if minimum_delay is None:
            minimum_delay = self.minimum_delay

        if timestamp is None:
            timestamp = time.time()

        timeline_key = self._get_timeline_key(key)
        namespace = self._get_timeline_namespace(key)
        with self._get_timeline_lock(key, duration=30).acquire():
            try:
                response = script(
                    [timeline_key],
                    [
                        "DIGEST_OPEN",
                        namespace,
                        self.ttl,
                        timestamp,
                        key,
                        self.capacity if self.capacity else -1,
                    ],
                    self.cluster,
                )
            except ResponseError as e:
                if "err(invalid_state):" in str(e):
                    raise InvalidState("Timeline is not in the ready state.") from e
                else:
                    raise

            records = [
                Record(key.decode(), self.codec.decode(value), float(timestamp))
                for key, value, timestamp in response
                if value is not None
            ]

            # If the record value is `None`, this means the record data was
            # missing (it was presumably evicted by Redis) so we don't need to
            # return it here.
            filtered_records = [record for record in records if record.value is not None]
            if len(records) != len(filtered_records):
                logger.warning(
                    "Filtered out missing records when fetching digest",
                    extra={
                        "key": key,
                        "record_count": len(records),
                        "filtered_record_count": len(filtered_records),
                    },
                )
            yield filtered_records

            script(
                [timeline_key],
                ["DIGEST_CLOSE", namespace, self.ttl, timestamp, key, minimum_delay]
                + [record.key for record in records],
                self.cluster,
            )

    def delete(self, key: str, timestamp: float | None = None) -> None:
        if timestamp is None:
            timestamp = time.time()

        with self._get_timeline_lock(key, duration=30).acquire():
            script(
                [self._get_timeline_key(key)],
                ["DELETE", self._get_timeline_namespace(key), self.ttl, timestamp, key],
                self.cluster,
            )

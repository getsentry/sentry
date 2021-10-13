import logging
from itertools import chain
from typing import Iterable, Sequence, Set

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

from . import base

# redis key for entry storing current list of LPQ members
LPQ_MEMBERS_KEY = "store.symbolicate-event-lpq-selected"

logger = logging.getLogger(__name__)


class RedisRealtimeMetricsStore(base.RealtimeMetricsStore):
    """An implementation of RealtimeMetricsStore based on a Redis backend."""

    def __init__(
        self,
        cluster: str,
        counter_bucket_size: int,
        counter_time_window: int,
        duration_bucket_size: int,
        duration_time_window: int,
        backoff_timer: int,
    ) -> None:
        """Creates a RedisRealtimeMetricsStore.

        "cluster" is the name of the Redis cluster to use. "counter_bucket_size" is the size
        in seconds of the buckets that timestamps will be sorted into when a project's event counter is incremented.
        "counter_time_window" is the duration in seconds for which event counters are considered relevant (see the documentation of get_counts_for_project).
        A value of 0 will result in only the most recent bucket being kept.

        "duration_bucket_size" and "duration_time_window" function like their "counter*" siblings,
        but for processing duration metrics.
        """

        self.cluster = redis.redis_clusters.get(cluster)
        self._counter_bucket_size = counter_bucket_size
        self._counter_time_window = counter_time_window
        self._duration_bucket_size = duration_bucket_size
        self._duration_time_window = duration_time_window
        self._prefix = "symbolicate_event_low_priority"
        self._backoff_timer = backoff_timer

        self.validate()

    def validate(self) -> None:
        if self._counter_bucket_size <= 0:
            raise InvalidConfiguration("counter bucket size must be at least 1")

        if self._duration_bucket_size <= 0:
            raise InvalidConfiguration("duration bucket size must be at least 1")

        if self._counter_time_window < 0:
            raise InvalidConfiguration("counter time window must be nonnegative")

        if self._duration_time_window < 0:
            raise InvalidConfiguration("duration time window must be nonnegative")

    def _counter_key_prefix(self) -> str:
        return f"{self._prefix}:counter:{self._counter_bucket_size}"

    def _duration_key_prefix(self) -> str:
        return f"{self._prefix}:duration:{self._duration_bucket_size}"

    def _backoff_key_prefix(self) -> str:
        return f"{self._prefix}:backoff"

    def _register_backoffs(self, project_ids: Sequence[int]) -> None:
        if len(project_ids) == 0 or self._backoff_timer == 0:
            return

        with self.cluster.pipeline(transaction=False) as pipeline:
            for project_id in project_ids:
                key = f"{self._backoff_key_prefix()}:{project_id}"
                # Can't use mset because it doesn't allow also specifying an expiry
                pipeline.set(name=key, value="1", ex=self._backoff_timer)

                pipeline.execute()

    def _is_backing_off(self, project_id: int) -> bool:
        """
        Returns whether a project is currently in the middle of its backoff timer from having
        recently been assigned to or unassigned from the LPQ.
        """
        key = f"{self._backoff_key_prefix()}:{project_id}"
        return self.cluster.get(key) is not None

    def increment_project_event_counter(self, project_id: int, timestamp: int) -> None:
        """Increment the event counter for the given project_id.

        The counter is used to track the rate of events for the project.
        Calling this increments the counter of the current
        time-window bucket with "timestamp" providing the time of the event
        in seconds since the UNIX epoch (i.e., as returned by time.time()).
        """

        timestamp -= timestamp % self._counter_bucket_size

        key = f"{self._counter_key_prefix()}:{project_id}:{timestamp}"

        with self.cluster.pipeline() as pipeline:
            pipeline.incr(key)
            pipeline.expire(key, self._counter_time_window + self._counter_bucket_size)
            pipeline.execute()

    def increment_project_duration_counter(
        self, project_id: int, timestamp: int, duration: int
    ) -> None:
        """Increments the duration counter for the given project_id and duration.

        The counter is used to track the processing time of events for the project.
        Calling this increments the counter of the current time-window bucket with "timestamp" providing
        the time of the event in seconds since the UNIX epoch and "duration" the processing time in seconds.
        """
        timestamp -= timestamp % self._duration_bucket_size

        key = f"{self._duration_key_prefix()}:{project_id}:{timestamp}"
        duration -= duration % 10

        with self.cluster.pipeline() as pipeline:
            pipeline.hincrby(key, duration, 1)
            pipeline.expire(key, self._duration_time_window + self._duration_bucket_size)
            pipeline.execute()

    def projects(self) -> Iterable[int]:
        """
        Returns IDs of all projects for which metrics have been recorded in the store.

        This may throw an exception if there is some sort of issue scanning the redis store for
        projects.
        """

        already_seen = set()
        # Normally if there's a duration entry for a project then there should be a counter
        # entry for it as well, but double check both to be safe
        all_keys = chain(
            self.cluster.scan_iter(
                match=self._counter_key_prefix() + ":*",
            ),
            self.cluster.scan_iter(
                match=self._duration_key_prefix() + ":*",
            ),
        )

        for item in all_keys:
            # Because this could be one of two patterns, this splits based on the most basic
            # delimiter ":" instead of splitting on known prefixes
            _prefix, _metric_type, _bucket_size, project_id_raw, _else = item.split(":", maxsplit=4)
            project_id = int(project_id_raw)
            if project_id not in already_seen:
                already_seen.add(project_id)
                yield project_id

    def get_counts_for_project(
        self, project_id: int, timestamp: int
    ) -> Iterable[base.BucketedCount]:
        """
        Returns a sorted list of bucketed timestamps paired with the count of symbolicator requests
        made during that time for some given project.

        The first bucket returned is the one that `timestamp - self._counter_time_window` falls into. The last bucket returned is the one that `timestamp` falls into.

        This may throw an exception if there is some sort of issue fetching counts from the redis
        store.
        """
        bucket_size = self._counter_bucket_size
        now_bucket = timestamp - timestamp % bucket_size

        first_bucket = timestamp - self._counter_time_window
        first_bucket = first_bucket - first_bucket % bucket_size

        buckets = range(first_bucket, now_bucket + bucket_size, bucket_size)
        keys = [f"{self._counter_key_prefix()}:{project_id}:{ts}" for ts in buckets]

        counts = self.cluster.mget(keys)
        for ts, count_raw in zip(buckets, counts):
            count = int(count_raw) if count_raw else 0
            yield base.BucketedCount(timestamp=ts, count=count)

    def get_durations_for_project(
        self, project_id: int, timestamp: int
    ) -> Iterable[base.DurationHistogram]:
        """
        Returns a sorted list of bucketed timestamps paired with a histogram-like dictionary of
        symbolication durations made during some timestamp for some given project.

        The first bucket returned is the one that `timestamp - self._duration_time_window` falls into. The last bucket returned is the one that `timestamp` falls into.

        For a given `{duration:count}` entry in the dictionary bound to a specific `timestamp`:

        - `duration` represents the amount of time it took for a symbolication request to complete.
        Durations are bucketed by 10secs, meaning that a `duration` of `30` covers all requests that
        took between 30-39 seconds.

        - `count` is the number of symbolication requests that took some amount of time within the
        range of `[duration, duration+10)` to complete.

        This may throw an exception if there is some sort of issue fetching durations from the redis
        store.
        """
        bucket_size = self._duration_bucket_size
        now_bucket = timestamp - timestamp % bucket_size

        first_bucket = timestamp - self._duration_time_window
        first_bucket = first_bucket - first_bucket % bucket_size

        buckets = range(first_bucket, now_bucket + bucket_size, bucket_size)

        with self.cluster.pipeline() as pipeline:
            for ts in buckets:
                pipeline.hgetall(f"{self._duration_key_prefix()}:{project_id}:{ts}")
            histograms = pipeline.execute()

        for ts, histogram_redis_raw in zip(buckets, histograms):
            histogram = {duration: 0 for duration in range(0, 600, 10)}
            histogram_redis = {
                int(duration): int(count) for duration, count in histogram_redis_raw.items()
            }
            histogram.update(histogram_redis)
            yield base.DurationHistogram(timestamp=ts, histogram=base.BucketedDurations(histogram))

    def get_lpq_projects(self) -> Set[int]:
        """
        Fetches the list of projects that are currently using the low priority queue.

        Returns a list of project IDs.

        This may throw an exception if there is some sort of issue fetching the list from the redis
        store.
        """
        return {int(project_id) for project_id in self.cluster.smembers(LPQ_MEMBERS_KEY)}

    def is_lpq_project(self, project_id: int) -> bool:
        """
        Checks whether the given project is currently using the low priority queue.
        """
        return bool(self.cluster.sismember(LPQ_MEMBERS_KEY, project_id))

    def add_project_to_lpq(self, project_id: int) -> bool:
        """
        Assigns a project to the low priority queue.

        This registers an intent to redirect all symbolication events triggered by the specified
        project to be redirected to the low priority queue.

        Applies a backoff timer to the project which prevents it from being automatically evicted
        from the queue while that timer is active.

        Returns True if the project was a new addition to the list. Returns False if it was already
        assigned to the low priority queue. This may throw an exception if there is some sort of
        issue registering the project with the queue.
        """

        if self._is_backing_off(project_id):
            return False
        # If this successfully completes then the project is expected to be in the set.
        was_added = int(self.cluster.sadd(LPQ_MEMBERS_KEY, project_id)) > 0
        self._register_backoffs([project_id])
        return was_added

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> int:
        """
        Unassigns projects from the low priority queue.

        This registers an intent to restore all specified projects back to the regular queue.

        Applies a backoff timer to the project which prevents it from being automatically assigned
        to the queue while that timer is active.

        Returns the number of projects that were actively removed from the queue. Any projects that
        were not assigned to the low priority queue to begin with will be omitted from the return
        value. This may throw an exception if there is some sort of issue deregistering the projects
        from the queue.
        """
        removable = [project for project in project_ids if not self._is_backing_off(project)]

        if not removable:
            return 0

        # This returns the number of projects removed, and throws an exception if there's a problem.
        # If this successfully completes then the projects are expected to no longer be in the set.
        removed = int(self.cluster.srem(LPQ_MEMBERS_KEY, *removable))
        self._register_backoffs(removable)
        return removed

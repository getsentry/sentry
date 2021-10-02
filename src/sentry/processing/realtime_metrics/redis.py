import datetime
import logging
from itertools import chain
from typing import Iterable, Set

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
        counter_ttl: datetime.timedelta,
        histogram_bucket_size: int,
        histogram_ttl: datetime.timedelta,
    ) -> None:
        """Creates a RedisRealtimeMetricsStore.

        "cluster" is the name of the Redis cluster to use. "counter_bucket_size" is the size
        in seconds of the buckets that timestamps will be sorted into when a project's event counter is incremented.
        "counter_ttl" is the duration that event counter entries will be kept around for *after
        the last increment call*.

        "histogram_bucket_size" and "histogram_ttl" function like their "counter*" siblings,
        but for the histograms.
        """

        self.cluster = redis.redis_clusters.get(cluster)
        self._counter_bucket_size = counter_bucket_size
        self._counter_ttl = int(counter_ttl / datetime.timedelta(milliseconds=1))
        self._histogram_bucket_size = histogram_bucket_size
        self._histogram_ttl = int(histogram_ttl / datetime.timedelta(milliseconds=1))
        self._prefix = "symbolicate_event_low_priority"

    def validate(self) -> None:
        if self._counter_bucket_size <= 0:
            raise InvalidConfiguration("counter bucket size must be at least 1")

        if self._histogram_bucket_size <= 0:
            raise InvalidConfiguration("histogram bucket size must be at least 1")

    def _counter_key_prefix(self) -> str:
        return f"{self._prefix}:counter:{self._counter_bucket_size}"

    def _histogram_key_prefix(self) -> str:
        return f"{self._prefix}:histogram:{self._histogram_bucket_size}"

    def increment_project_event_counter(self, project_id: int, timestamp: int) -> None:
        """Increment the event counter for the given project_id.

        The counter is used to track the rate of events for the project.
        Calling this increments the counter of the current
        time-window bucket with "timestamp" providing the time of the event
        in seconds since the UNIX epoch (i.e., as returned by time.time()).
        """

        if self._counter_bucket_size > 1:
            timestamp -= timestamp % self._counter_bucket_size

        key = f"{self._counter_key_prefix()}:{project_id}:{timestamp}"

        with self.cluster.pipeline() as pipeline:
            pipeline.incr(key)
            pipeline.pexpire(key, self._counter_ttl)
            pipeline.execute()

    def increment_project_duration_counter(
        self, project_id: int, timestamp: int, duration: int
    ) -> None:
        """Increments the duration counter for the given project_id and duration.

        The counter is used to track the processing time of events for the project.
        Calling this increments the counter of the current time-window bucket with "timestamp" providing
        the time of the event in seconds since the UNIX epoch and "duration" the processing time in seconds.
        """
        if self._histogram_bucket_size > 1:
            timestamp -= timestamp % self._histogram_bucket_size

        key = f"{self._histogram_key_prefix()}:{project_id}:{timestamp}"
        duration -= duration % 10

        with self.cluster.pipeline() as pipeline:
            pipeline.hincrby(key, duration, 1)
            pipeline.pexpire(key, self._histogram_ttl)
            pipeline.execute()

    def projects(self) -> Iterable[int]:
        """
        Returns IDs of all projects for which metrics have been recorded in the store.

        This may throw an exception if there is some sort of issue scanning the redis store for
        projects.
        """

        already_seen = set()
        # Normally if there's a histogram entry for a project then there should be a counter
        # entry for it as well, but double check both to be safe
        all_keys = chain(
            self.cluster.scan_iter(
                match=self._counter_key_prefix() + ":*",
            ),
            self.cluster.scan_iter(
                match=self._histogram_key_prefix() + ":*",
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

    def get_counts_for_project(self, project_id: int) -> Iterable[base.BucketedCount]:
        """
        Returns a sorted list of bucketed timestamps paired with the count of symbolicator requests
        made during that time for some given project.

        This may throw an exception if there is some sort of issue fetching counts from the redis
        store.
        """
        key_prefix = f"{self._counter_key_prefix()}:{project_id}:"

        keys = sorted(
            self.cluster.scan_iter(
                match=key_prefix + "*",
            )
        )
        counts = self.cluster.mget(keys)
        for key, count_raw in zip(keys, counts):
            _, timestamp_raw = key.split(key_prefix)

            timestamp_bucket = int(timestamp_raw)
            count = int(count_raw)
            yield base.BucketedCount(timestamp=timestamp_bucket, count=count)

    def get_durations_for_project(self, project_id: int) -> Iterable[base.DurationHistogram]:
        """
        Returns a sorted list of bucketed timestamps paired with a histogram-like dictionary of
        symbolication durations made during some timestamp for some given project.

        For a given `{duration:count}` entry in the dictionary bound to a specific `timestamp`:

        - `duration` represents the amount of time it took for a symbolication request to complete.
        Durations are bucketed by 10secs, meaning that a `duration` of `30` covers all requests that
        took between 30-39 seconds.

        - `count` is the number of symbolication requests that took some amount of time within the
        range of `[duration, duration+10)` to complete.

        This may throw an exception if there is some sort of issue fetching durations from the redis
        store.
        """
        key_prefix = f"{self._histogram_key_prefix()}:{project_id}:"
        keys = sorted(
            self.cluster.scan_iter(
                match=key_prefix + "*",
            )
        )

        for key in keys:
            _, timestamp_raw = key.split(key_prefix)
            timestamp_bucket = int(timestamp_raw)

            histogram_raw = self.cluster.hgetall(key)
            histogram = base.BucketedDurations(
                {int(duration): int(count) for duration, count in histogram_raw.items()}
            )
            yield base.DurationHistogram(timestamp=timestamp_bucket, histogram=histogram)

    def get_lpq_projects(self) -> Set[int]:
        """
        Fetches the list of projects that are currently using the low priority queue.

        Returns a list of project IDs.

        This may throw an exception if there is some sort of issue fetching the list from the redis
        store.
        """
        return {int(project_id) for project_id in self.cluster.smembers(LPQ_MEMBERS_KEY)}

    def add_project_to_lpq(self, project_id: int) -> bool:
        """
        Assigns a project to the low priority queue.

        This registers an intent to redirect all symbolication events triggered by the specified
        project to be redirected to the low priority queue.

        This may throw an exception if there is some sort of issue registering the project with the
        queue.
        """

        # This returns 0 if project_id was already in the set, 1 if it was added, and throws an
        # exception if there's a problem. If this successfully completes then the project is
        # expected to be in the set.
        return int(self.cluster.sadd(LPQ_MEMBERS_KEY, project_id)) > 0

    def remove_project_from_lpq(self, project_id: int) -> bool:
        """
        Removes a project from the low priority queue.

        This restores the specified project back to the regular queue, unless it has been
        manually forced into the low priority queue via the `store.symbolicate-event-lpq-always`
        kill switch.

        This may throw an exception if there is some sort of issue deregistering the projects from
        the queue.
        """

        return self.remove_projects_from_lpq({project_id}) > 0

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> int:
        """
        Removes projects from the low priority queue.

        This registers an intent to restore all specified projects back to the regular queue.

        This may throw an exception if there is some sort of issue deregistering the projects from
        the queue.
        """
        if len(project_ids) == 0:
            return 0

        # This returns the number of projects removed, and throws an exception if there's a problem.
        # If this successfully completes then the projects are expected to no longer be in the set.
        return int(self.cluster.srem(LPQ_MEMBERS_KEY, *project_ids))

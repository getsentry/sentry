import datetime
from typing import Set

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

from . import base

# redis key for entry storing current list of LPQ members
LPQ_MEMBERS_KEY = "store.symbolicate-event-lpq-selected"


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

    def increment_project_event_counter(self, project_id: int, timestamp: int) -> None:
        """Increment the event counter for the given project_id.

        The counter is used to track the rate of events for the project.
        Calling this increments the counter of the current
        time-window bucket with "timestamp" providing the time of the event
        in seconds since the UNIX epoch (i.e., as returned by time.time()).
        """

        if self._counter_bucket_size > 1:
            timestamp -= timestamp % self._counter_bucket_size

        key = f"{self._prefix}:counter:{self._counter_bucket_size}:{project_id}:{timestamp}"

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

        key = f"{self._prefix}:histogram:{self._histogram_bucket_size}:{project_id}:{timestamp}"
        duration -= duration % 10

        with self.cluster.pipeline() as pipeline:
            pipeline.hincrby(key, duration, 1)
            pipeline.pexpire(key, self._histogram_ttl)
            pipeline.execute()

    def get_lpq_projects(self) -> Set[int]:
        """
        Fetches the list of projects that are currently using the low priority queue.

        Returns a list of project IDs.
        """
        return {int(project_id) for project_id in self.cluster.smembers(LPQ_MEMBERS_KEY)}

    def is_lpq_project(self, project_id: int) -> bool:
        """
        Checks whether the given project is currently using the low priority queue.

        Returns a bool.
        """
        return bool(self.cluster.sismember(LPQ_MEMBERS_KEY, project_id))

    def add_project_to_lpq(self, project_id: int) -> None:
        """
        Assigns a project to the low priority queue.

        This registers an intent to redirect all symbolication events triggered by the specified
        project to be redirected to the low priority queue.

        This may throw an exception if there is some sort of issue registering the project with the
        queue.
        """

        # This returns 0 if project_id was already in the set, 1 if it was added, and throws an
        # exception if there's a problem so it's fine if we just ignore the return value of this as
        # the project is always added if this successfully completes.
        self.cluster.sadd(LPQ_MEMBERS_KEY, project_id)

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> None:
        """
        Removes projects from the low priority queue.

        This registers an intent to restore all specified projects back to the regular queue.

        This may throw an exception if there is some sort of issue deregistering the projects from
        the queue.
        """
        if len(project_ids) == 0:
            return

        self.cluster.srem(LPQ_MEMBERS_KEY, *project_ids)

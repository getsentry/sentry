import logging
from time import time
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
        budget_bucket_size: int,
        budget_time_window: int,
        backoff_timer: int,
    ) -> None:
        """Creates a RedisRealtimeMetricsStore.

        "cluster" is the name of the Redis cluster to use. "budget_bucket_size" is the size
        in seconds of the buckets that timestamps will be sorted into when a project's event duration is recorded.
        "budget_time_window" is the duration in seconds for which budget counts are considered relevant (see the documentation of record_project_duration).
        A value of 0 will result in only the most recent bucket being kept.
        """

        self.cluster = redis.redis_clusters.get(cluster)
        self._budget_bucket_size = budget_bucket_size
        self._budget_time_window = budget_time_window
        self._prefix = "symbolicate_event_low_priority"
        self._backoff_timer = backoff_timer

        self.validate()

    def validate(self) -> None:
        if not 0 < self._budget_bucket_size <= 60:
            raise InvalidConfiguration("budget bucket size must be 1-60 seconds")

        if self._budget_time_window < 60:
            raise InvalidConfiguration("budget time window must be at least a minute")

    def _budget_key_prefix(self) -> str:
        return f"{self._prefix}:budget:{self._budget_bucket_size}"

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

    def record_project_duration(self, project_id: int, duration: float) -> None:
        """
        Records the duration of a symbolication request for the given project_id.

        The duration (from the start of the symbolication request)
        should be recorded at regular intervals *as the event is being processed*.

        The duration is used to track the used "symbolication time budget" of a project.
        Each project is allocated a certain per-second budget.
        If that budget is exceeded, the project will be demoted to the low priority queue.

        This can happen when a project either submits *a lot* of fast events,
        or a few *very slow* events.

        As the running duration is recorded at regular intervals,
        it naturally forms a quadratic function:

        Assuming we record at 1-second intervals and the request took 5 seconds
        in total, the used budget is:

        1 + 2 + 3 + 4 + 5 = 15

        In general, a request that takes n seconds to symbolicate will cost
        1 + 2 + … + n = n * (n+1) / 2 = O(n²) time units.

        This method will "punish" slow events in particular, as our main goal is
        to maintain throughput with limited concurrency.
        """
        timestamp = int(time())

        timestamp -= timestamp % self._budget_bucket_size

        key = f"{self._budget_key_prefix()}:{project_id}:{timestamp}"

        # the duration internally is stores as ms
        duration = int(duration * 1000)

        with self.cluster.pipeline() as pipeline:
            pipeline.incrby(key, duration)
            pipeline.expire(key, self._budget_time_window + self._budget_bucket_size)
            pipeline.execute()

    def projects(self) -> Iterable[int]:
        """
        Returns IDs of all projects for which metrics have been recorded in the store.

        This may throw an exception if there is some sort of issue scanning the redis store for
        projects.
        """

        already_seen = set()
        all_keys = self.cluster.scan_iter(
            match=self._budget_key_prefix() + ":*",
        )

        for item in all_keys:
            # Because this could be one of two patterns, this splits based on the most basic
            # delimiter ":" instead of splitting on known prefixes
            _prefix, _metric_type, _bucket_size, project_id_raw, _else = item.split(":", maxsplit=4)
            project_id = int(project_id_raw)
            if project_id not in already_seen:
                already_seen.add(project_id)
                yield project_id

    def get_used_budget_for_project(self, project_id: int) -> float:
        """
        Returns the average used per-second budget for a given project during the configured sliding time window.
        """
        timestamp = int(time())

        bucket_size = self._budget_bucket_size
        now_bucket = timestamp - timestamp % bucket_size

        first_bucket = timestamp - self._budget_time_window
        first_bucket = first_bucket - first_bucket % bucket_size

        buckets = range(first_bucket, now_bucket + bucket_size, bucket_size)
        keys = [f"{self._budget_key_prefix()}:{project_id}:{ts}" for ts in buckets]
        counts = self.cluster.mget(keys)

        total_time_window = timestamp - first_bucket
        total_sum = sum(int(c) if c else 0 for c in counts)

        # the counts in redis are in ms resolution.
        return total_sum / total_time_window / 1000

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

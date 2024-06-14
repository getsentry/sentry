import logging
from time import time

from django.conf import settings

from sentry.exceptions import InvalidConfiguration
from sentry.lang.native.symbolicator import SymbolicatorPlatform
from sentry.utils import redis

from . import base

logger = logging.getLogger(__name__)

# Redis key prefix for storing the LPQ status of projects
MEMBER_KEY_PREFIX = "symbolicate_event_low_priority:members"
# Redis key prefix for storing the budgets of projects
BUDGET_KEY_PREFIX = "symbolicate_event_low_priority:budget"


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
        self._backoff_timer = backoff_timer

        self.validate()

    def validate(self) -> None:
        if not 0 < self._budget_bucket_size <= 60:
            raise InvalidConfiguration("budget bucket size must be 1-60 seconds")

        if self._budget_time_window < 60:
            raise InvalidConfiguration("budget time window must be at least a minute")

        if self._backoff_timer < 1:
            raise InvalidConfiguration("backoff timer must be at least a second")

    def _budget_key(self, platform: SymbolicatorPlatform, project_id: int, timestamp: int) -> str:
        return f"{BUDGET_KEY_PREFIX}:{self._budget_bucket_size}:{platform.value}:{project_id}:{timestamp}"

    def record_project_duration(
        self, platform: SymbolicatorPlatform, project_id: int, duration: float
    ) -> None:
        """
        Records the duration of a symbolication request for the given project_id and platform.

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

        key = self._budget_key(platform, project_id, timestamp)

        # the duration internally is stores as ms
        duration = int(duration * 1000)

        with self.cluster.pipeline() as pipeline:
            pipeline.incrby(key, duration)
            pipeline.expire(key, self._budget_time_window + self._budget_bucket_size)
            pipeline.execute()

    def is_lpq_project(self, platform: SymbolicatorPlatform, project_id: int) -> bool:
        """
        Checks whether the given project is currently using the low priority queue for
        the given platform.
        """
        timestamp = int(time())

        bucket_size = self._budget_bucket_size
        now_bucket = timestamp - timestamp % bucket_size

        first_bucket = timestamp - self._budget_time_window
        first_bucket = first_bucket - first_bucket % bucket_size

        buckets = range(first_bucket, now_bucket + bucket_size, bucket_size)
        keys = [self._budget_key(platform, project_id, ts) for ts in buckets]
        member_key = f"{MEMBER_KEY_PREFIX}:{platform.value}:{project_id}"
        keys.insert(0, member_key)
        results = self.cluster.mget(keys)
        is_lpq = results[0]
        counts = results[1:]

        if is_lpq is not None:
            return True

        total_time_window = timestamp - first_bucket
        total_sum = sum(int(c) if c else 0 for c in counts)

        # the counts in redis are in ms resolution.
        average_used = total_sum / total_time_window / 1000
        budget = (
            settings.SENTRY_LPQ_OPTIONS.get(f"project_budget_{platform.value}")
            or settings.SENTRY_LPQ_OPTIONS["project_budget"]
        )
        new_is_lpq = average_used > budget

        if new_is_lpq:
            self.cluster.set(name=member_key, value="1", ex=self._backoff_timer)
        return new_is_lpq

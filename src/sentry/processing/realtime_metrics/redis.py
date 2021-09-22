import datetime
from typing import Union

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

from . import base


class RedisRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(
        self,
        cluster: str,
        counter_bucket_size: int,
        counter_ttl: datetime.timedelta,
    ) -> None:
        self.cluster = redis.redis_clusters.get(cluster)
        self._counter_bucket_size = counter_bucket_size
        self._counter_ttl = int(counter_ttl / datetime.timedelta(milliseconds=1))
        self._prefix = "symbolicate_event_low_priority"

    def validate(self) -> None:
        if self._counter_bucket_size <= 0:
            raise InvalidConfiguration("bucket size must be at least 1")

    def increment_project_event_counter(
        self, project_id: int, timestamp: Union[int, float]
    ) -> None:
        """Increment the event counter for the given project_id.

        The key is computed from a fixed prefix, the currently configured bucket size,
        the project_id, and the timestamp of the symbolication request, rounded
        down to a multiple of the bucket size.
        """
        timestamp = int(timestamp)
        if self._counter_bucket_size > 1:
            timestamp -= timestamp % self._counter_bucket_size

        key = f"{self._prefix}:{self._counter_bucket_size}:{project_id}:{timestamp}"

        with self.cluster.pipeline() as pipeline:
            pipeline.set(key, 0, nx=True, px=self._counter_ttl)
            pipeline.incr(key)
            pipeline.execute()

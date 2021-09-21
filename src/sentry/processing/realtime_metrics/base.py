import datetime

from sentry.utils import redis


class RealtimeMetricsStore:
    def __init__(
        self,
        cluster: redis._RedisCluster,
        counter_bucket_size: int,
        counter_ttl: datetime.timedelta,
        prefix: str = "symbolicate_event_low_priority",
    ) -> None:
        if counter_bucket_size <= 0:
            raise ValueError("bucket size must be at least 1")

        self.counter_bucket_size = counter_bucket_size
        self.inner = cluster
        self.counter_ttl: int = int(counter_ttl / datetime.timedelta(milliseconds=1))
        self.prefix = prefix

    def increment_project_event_counter(self, project_id: int, timestamp: float) -> None:
        """Increment the event counter for the given project_id.

        The key is computed from the project_id and the timestamp of the symbolication request, rounded
        down to this object's bucket size. If the key is not currently set to expire, it will be set to expire
        in ttl seconds.
        """
        timestamp = int(timestamp)
        if self.counter_bucket_size > 1:
            timestamp -= timestamp % self.counter_bucket_size

        key = f"{self.prefix}:{project_id}:{timestamp}"

        with self.inner.pipeline() as pipeline:
            pipeline.set(key, 0, nx=True, px=self.counter_ttl)
            pipeline.incr(key)
            pipeline.execute()

import sentry_sdk
from django.conf import settings

from sentry.utils import redis


class MetricsCluster:
    def __init__(self, cluster, counter_ttl: int, prefix: str = "symbolicate_event_low_priority"):
        self.inner = cluster
        self.counter_ttl = counter_ttl
        self.prefix = prefix

    def increment_project_event_counter(self, project_id: str, timestamp: float):
        """Increment the event counter for the given project_id.

        The key is computed from the project_id and the timestamp of the symbolication request, rounded
        down to the nearest 10 seconds. If the key is not currently set to expire, it will be set to expire
        in ttl seconds.
        """
        with sentry_sdk.start_span(op="tasks.store.symbolicate_event.low_priority.metrics.counter"):
            timestamp = int(timestamp)
            timestamp -= timestamp % 10
            key = f"{self.prefix}:{project_id}:{timestamp}"

            with self.inner.pipeline() as pipeline:
                pipeline.set(key, 0, nx=True, ex=self.counter_ttl)
                pipeline.incr(key)
                pipeline.execute()


def default_metrics_cluster() -> MetricsCluster:
    cluster_key = getattr(settings, "SENTRY_PROJECT_EVENT_METRICS_REDIS_CLUSTER", "default")
    counter_ttl = getattr(settings, "SYMBOLICATOR_PROCESS_EVENT_LOW_PRIORITY_COUNTER_TTL", 300)
    return MetricsCluster(redis.redis_clusters.get(cluster_key), counter_ttl)

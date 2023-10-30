from typing import Mapping, Optional, Sequence, Tuple

from sentry_redis_tools.cardinality_limiter import CardinalityLimiter as CardinalityLimiterBase
from sentry_redis_tools.cardinality_limiter import GrantedQuota, Quota
from sentry_redis_tools.cardinality_limiter import (
    RedisCardinalityLimiter as RedisCardinalityLimiterImpl,
)
from sentry_redis_tools.cardinality_limiter import RequestedQuota
from sentry_redis_tools.clients import BlasterClient, RedisCluster

from sentry.utils import metrics, redis
from sentry.utils.redis_metrics import RedisToolsMetricsBackend
from sentry.utils.services import Service

__all__ = ["GrantedQuota", "RequestedQuota", "Quota"]

Hash = int
Timestamp = int


class CardinalityLimiter(Service, CardinalityLimiterBase):
    pass


class RedisCardinalityLimiter(CardinalityLimiter):
    def __init__(
        self,
        cluster: str = "default",
        num_shards: int = 3,
        num_physical_shards: int = 3,
        metric_tags: Optional[Mapping[str, str]] = None,
    ) -> None:
        """
        :param cluster: Name of the redis cluster to use, to be configured with
            the `redis.clusters` Sentry option (like any other redis cluster in
            Sentry).
        :param cluster_num_shards: The number of logical shards to have. This
            controls the average set size in Redis.
        :param cluster_num_physical_shards: The number of actual shards to
            store. Controls how many keys of type "unordered set" there are in
            Redis. The ratio `cluster_num_physical_shards / cluster_num_shards`
            is a sampling rate, the lower it is, the less precise accounting
            will be.
        """
        is_redis_cluster, client, _ = redis.get_dynamic_cluster_from_options(
            "", {"cluster": cluster}
        )

        if is_redis_cluster:
            assert isinstance(client, RedisCluster)
        else:
            assert isinstance(client, BlasterClient)

        self.impl = RedisCardinalityLimiterImpl(
            client,
            num_shards=num_shards,
            num_physical_shards=num_physical_shards,
            metrics_backend=RedisToolsMetricsBackend(metrics.backend, tags=metric_tags),
        )

        super().__init__()

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        return self.impl.check_within_quotas(requests, timestamp)

    def use_quotas(
        self,
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        return self.impl.use_quotas(grants, timestamp)

from typing import Any, Optional, Sequence, Tuple

from sentry_redis_tools.clients import RedisCluster, StrictRedis
from sentry_redis_tools.sliding_windows_rate_limiter import GrantedQuota, Quota
from sentry_redis_tools.sliding_windows_rate_limiter import (
    RedisSlidingWindowRateLimiter as RedisSlidingWindowRateLimiterImpl,
)
from sentry_redis_tools.sliding_windows_rate_limiter import RequestedQuota, Timestamp

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis
from sentry.utils.services import Service

__all__ = ["Quota", "GrantedQuota", "RequestedQuota", "Timestamp"]


class SlidingWindowRateLimiter(Service):
    def __init__(self, **options: Any) -> None:
        pass

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        """
        Given a set of quotas requests and limits, compute how much quota could
        be consumed.

        :param requests: The requests to return "grants" for.
        :param timestamp: The timestamp of the incoming request. Defaults to
            the current timestamp.

            Providing a too old timestamp here _can_ effectively disable rate
            limits, as the older request counts may no longer be stored.
            However, consistently providing old timestamps here will work
            correctly.
        """
        raise NotImplementedError()

    def use_quotas(
        self,
        requests: Sequence[RequestedQuota],
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        """
        Given a set of requests and the corresponding return values from
        `check_within_quotas`, consume the quotas.

        :param requests: The requests that have previously been passed to
            `check_within_quotas`.
        :param timestamp: The request timestamp that has previously been passed
            to `check_within_quotas`.
        :param grants: The return value of `check_within_quotas` which
            indicates how much quota should actually be consumed.

        Why is checking quotas and using quotas two separate implementations?
        Isn't that a time-of-check-time-of-use bug, and allows me to over-spend
        quota when requests are happening concurrently?

        1) It's desirable to first check quotas, then do a potentially fallible
           operation, then consume quotas. This rate limiter is primarily going to
           be used inside of the metrics string indexer to rate-limit database
           writes. What we want to do there is: read DB, check rate limits,
           write to DB, use rate limits.

           If we did it any other way (the obvious one being to read DB,
           check-and-use rate limits, write DB), crashes while writing to the
           database can over-consume quotas. This is not a big problem if those
           crashes are flukes, and especially not a problem if the crashes are
           a result of an overloaded DB.

           It is however a problem in case the consumer is crash-looping, or
           crashing (quickly) for 100% of requests (e.g. due to schema
           mismatches between code and DB that somehow don't surface during the
           DB read). In that case the quotas would be consumed immediately and
           incident recovery would require us to reset all quotas manually (or
           disable rate limiting via some killswitch)

        3) The redis backend (really the only backend we care about) already
           has some consistency problems.

           a) Redis only provides strong consistency and ability to
              check-and-increment counters when all involved keys hit the same
              Redis node. That means that a quota with prefix="org_id:123" can
              only run on a single redis node. It also means that a global
              quota (`prefix="global"`) would have to run on a single
              (unchangeable) redis node to be strongly consistent. That's
              however a problem for scalability.

              There's no obvious way to make global quotas consistent with
              per-org quotas this way, so right now it means that requests
              containing multiple quotas with different `prefixes` cannot be
              checked-and-incremented atomically even if we were to change the
              rate-limiter's interface.

           b) This is easily fixable, but because of the above, we
              currently don't control Redis sharding at all, meaning that even
              keys within a single quota's window will hit different Redis
              node. This also helps further distribute the load internally.

              Since we have given up on atomic check-and-increments in general
              anyway, there's no reason to explicitly control sharding.

        """
        raise NotImplementedError()

    def check_and_use_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Sequence[GrantedQuota]:
        """
        Check the quota requests in Redis and consume the quota in one go. See
        `check_within_quotas` for parameters.
        """
        timestamp, grants = self.check_within_quotas(requests, timestamp)
        self.use_quotas(requests, grants, timestamp)
        return grants


class RedisSlidingWindowRateLimiter(SlidingWindowRateLimiter):
    def __init__(self, **options: Any) -> None:
        cluster_key = options.get("cluster", "default")
        client = redis.redis_clusters.get(cluster_key)
        assert isinstance(client, (StrictRedis, RedisCluster)), client
        self.client = client
        self.impl = RedisSlidingWindowRateLimiterImpl(self.client)
        super().__init__(**options)

    def validate(self) -> None:
        try:
            self.client.ping()
            self.client.connection_pool.disconnect()  # type: ignore
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        return self.impl.check_within_quotas(requests, timestamp)

    def use_quotas(
        self,
        requests: Sequence[RequestedQuota],
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        return self.impl.use_quotas(requests, grants, timestamp)

"""
The ratelimiter used by the metrics string indexer to rate-limit DB writes.

As opposed to the API rate limiter, a limit in the "sliding window" rate
limiter such as "10 requests / minute" does not reset to 0 every minute.
Instead each window can be configured with a "granularity" setting such that
the window gradually resets in steps of `granularity` seconds.

Additionally this rate-limiter is not coupled to per-project/organization
scopes, and can apply multiple sliding windows at once. On the flipside it is
not strongly consistent and depending on usage it is very easy to over-spend
quota, as checking quota and spending quota are two separate steps.
"""

from dataclasses import dataclass
from time import time
from typing import Iterator, Optional, Sequence, Tuple

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis
from sentry.utils.services import Service


@dataclass(frozen=True)
class Quota:
    # The number of seconds to apply the limit to.
    window: int

    # A number between 1 and `window`. Since `window` is a sliding window,
    # configure what the granularity of that window is.
    #
    # If this is equal to `window`, the quota resets to 0 every `window`
    # seconds. If this is a very small number, the window slides "more
    # smoothly" at the expense of having much more redis keys.
    #
    # The number of redis keys required to enforce a quota is `window /
    # granularity`.
    granularity: int

    #: How many units are allowed within the given window.
    limit: int

    def iter_granules(self, request_timestamp: int) -> Iterator[int]:
        assert self.window % self.granularity == 0
        for granule_i in range(int(self.window / self.granularity)):
            yield int(request_timestamp / self.granularity) - granule_i * self.granularity


@dataclass(frozen=True)
class RequestedQuota:
    # A string that all redis state is prefixed with. For example
    # `sentry-string-indexer:123` where 123 is an organization id.
    #
    # Note: You cannot control the redis sharding this way, so curly braces are
    # forbidden.
    prefix: str

    # How much of each quota's limit is requested
    requested: int

    # Which quotas to check against. The requested amount must "fit" into all
    # quotas.
    quotas: Sequence[Quota]


@dataclass(frozen=True)
class GrantedQuota:
    # The prefix from RequestedQuota
    prefix: str

    # How much of RequestedQuota.requested can actually be used.
    granted: int


class SlidingWindowRateLimiter(Service):
    def __init__(self, **options):
        pass

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[int] = None
    ) -> Tuple[int, Sequence[GrantedQuota]]:
        """
        Given a set of quotas requests and limits, compute how much quota could
        be consumed.
        """
        raise NotImplementedError()

    def use_quotas(
        self, requests: Sequence[RequestedQuota], grants: Sequence[GrantedQuota], timestamp: int
    ):
        """
        Given a set of requests and the corresponding return values from
        `check_within_quotas`, consume the quotas.

        This is a separate method because 1) the redis backend is not strongly
        consistent anyway 2) the metrics string indexer may not want to
        increment quotas if it crashes halfway through the database write. In
        other words, it may want to first check quotas, execute the writes,
        then apply the quotas.
        """
        raise NotImplementedError()

    def check_and_use_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[int] = None
    ) -> Sequence[GrantedQuota]:
        """
        Check the quota requests in Redis and consume the quota in one go.
        """
        timestamp, grants = self.check_within_quotas(requests, timestamp)
        self.use_quotas(requests, grants, timestamp)
        return grants


class RedisSlidingWindowRateLimiter(SlidingWindowRateLimiter):
    def __init__(self, **options):
        cluster_key = options.get("cluster", "default")
        self.client = redis.redis_clusters.get(cluster_key)
        super().__init__(**options)

    def validate(self) -> None:
        try:
            self.client.ping()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def _build_redis_key_raw(self, prefix: str, window: int, granularity: int, granule: int) -> str:
        return f"sliding-window-rate-limit:{prefix}:{window}:{granularity}:{granule}"

    def _build_redis_key(self, request: RequestedQuota, quota: Quota, granule: int) -> str:
        return self._build_redis_key_raw(
            prefix=request.prefix,
            window=quota.window,
            granularity=quota.granularity,
            granule=granule,
        )

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[int] = None
    ) -> Tuple[int, Sequence[GrantedQuota]]:
        if timestamp is None:
            timestamp = int(time())
        else:
            timestamp = int(timestamp)

        keys_to_fetch = []
        for request in requests:
            assert request.quotas

            for quota in request.quotas:
                for granule in quota.iter_granules(timestamp):
                    keys_to_fetch.append(
                        self._build_redis_key(request=request, quota=quota, granule=granule)
                    )

        redis_results = dict(zip(keys_to_fetch, self.client.mget(keys_to_fetch)))

        results = []

        for request in requests:
            granted_quota = request.requested
            for quota in request.quotas:
                used_quota = sum(
                    int(
                        redis_results.get(
                            self._build_redis_key(request=request, quota=quota, granule=granule)
                        )
                        or 0
                    )
                    for granule in quota.iter_granules(timestamp)
                )

                granted_quota = max(0, min(granted_quota, quota.limit - used_quota))

            results.append(GrantedQuota(prefix=request.prefix, granted=granted_quota))

        return timestamp, results

    def use_quotas(
        self, requests: Sequence[RequestedQuota], grants: Sequence[GrantedQuota], timestamp: int
    ):
        assert len(requests) == len(grants)

        keys_to_incr = {}

        for request, grant in zip(requests, grants):
            assert request.prefix == grant.prefix

            for quota in request.quotas:
                # Only incr most recent granule
                granule = next(quota.iter_granules(timestamp))
                key = self._build_redis_key(request=request, quota=quota, granule=granule)
                assert key not in keys_to_incr, "conflicting quotas specified"
                keys_to_incr[key] = grant.granted, quota.window

        with self.client.pipeline(transaction=False) as pipeline:
            for key, (value, ttl) in keys_to_incr.items():
                pipeline.incrby(key, value)
                # Expire the key in `window` seconds. Since the key has been
                # recently incremented we know it represents a current
                # timestamp. We could use expireat here, but in tests we use
                # timestamps starting from 0 for convenience.
                pipeline.expire(key, ttl)

            pipeline.execute()

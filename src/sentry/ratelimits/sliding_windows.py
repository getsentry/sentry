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

Example
=======

We want to enforce the number of requests per organization via two limits:

* 100 per 30-second
* 10 per 3-seconds

On every request, our API endpoint calls:

    check_and_use_quotas(RequestedQuota(
        prefix=f"org-id:{org_id}"
        quotas=[
            Quota(
                window_seconds=30,
                limit=100,

                # can be arbitrary depending on how "sliding" the sliding
                # window should be. This one configures per-second granularity
                # to make the example simpler
                granularity=10,
            ),
            Quota(
                window_seconds=3,
                limit=10,
                granularity=1,
            )
        ]
    ))

For a request happening at time `900` for `org_id=123`, the redis backend
checks the following keys::

    sliding-window-rate-limit:123:3:900
    sliding-window-rate-limit:123:3:899
    sliding-window-rate-limit:123:3:898
    sliding-window-rate-limit:123:30:90
    sliding-window-rate-limit:123:30:89
    sliding-window-rate-limit:123:30:88

...none of which exist, so the values are assumed 0 and the request goes
through. It then sets the following keys:

    sliding-window-rate-limit:123:30:90 += 1
    sliding-window-rate-limit:123:3:900 += 1

After one minute, another request for the same org happens at time `902`.

* The keys starting with `:123:30:` sum up to 1, so the 30-second limit of 100 is not exceeded.
* The keys starting with `:123:3:` sum up to 1, so the 3-second limit of 10 is not exceeded.

Because no quota is exceeded, the request is granted. If one quota summed up to
100 or 10, respectively, the request would be rejected.

When using the quotas, the keys change as follows:

    sliding-window-rate-limit:123:3:900 = 1
    sliding-window-rate-limit:123:3:902 = 1
    sliding-window-rate-limit:123:30:90 = 2

"""

from dataclasses import dataclass
from time import time
from typing import Any, Iterator, Optional, Sequence, Tuple

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis
from sentry.utils.services import Service


@dataclass(frozen=True)
class Quota:
    # The number of seconds to apply the limit to.
    window_seconds: int

    # A number between 1 and `window_seconds`. Since `window_seconds` is a
    # sliding window, configure what the granularity of that window is.
    #
    # If this is equal to `window_seconds`, the quota resets to 0 every
    # `window_seconds`.  If this is a very small number, the window slides
    # "more smoothly" at the expense of having much more redis keys.
    #
    # The number of redis keys required to enforce a quota is `window_seconds /
    # granularity_seconds`.
    granularity_seconds: int

    #: How many units are allowed within the given window.
    limit: int

    # Override the prefix given by RequestedQuota such that one can implement
    # global limits + per-organization limits. The GrantedQuota will still only
    # contain the prefix of the RequestedQuota
    prefix_override: Optional[str] = None

    def __post__init__(self) -> None:
        assert self.window_seconds % self.granularity_seconds == 0

    def iter_window(self, request_timestamp: int) -> Iterator[int]:
        """
        Iterate over the quota's window, yielding timestamps representing each granule.

        This function is used to calculate keys for storing the number of
        requests made in each granule.

        The iteration is done in reverse-order (newest timestamp to oldest),
        starting with the key to which a currently-processed request should be
        added. That request's timestamp is `request_timestamp`.

        * `request_timestamp / self.granularity_seconds`
        * `request_timestamp / self.granularity_seconds - 1`
        * `request_timestamp / self.granularity_seconds - 2`
        * ...
        """
        value = request_timestamp // self.granularity_seconds

        for granule_i in range(self.window_seconds // self.granularity_seconds):
            value -= 1
            assert value >= 0, value
            yield value


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


Timestamp = int


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
        self.client = redis.redis_clusters.get(cluster_key)
        super().__init__(**options)

    def validate(self) -> None:
        try:
            self.client.ping()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def _build_redis_key_raw(self, prefix: str, window: int, granularity: int, granule: int) -> str:
        if "{" in prefix or "}" in prefix:
            # The rate limiter currently does not allow you to control the
            # Redis sharding key through the prefix`. This is currently an
            # arbitrary limitation, but the reason for this is that one day we
            # may want to rewrite the internals to run inside of a Lua script
            # to allow for (partially) atomic check-and-use of rate limits (or
            # do that for performance reasons), in which case the rate limiter
            # would have to take control of sharding itself.
            raise ValueError("Explicit sharding not allowed in RequestedQuota.prefix")

        return f"sliding-window-rate-limit:{prefix}:{window}:{granularity}:{granule}"

    def _build_redis_key(self, request: RequestedQuota, quota: Quota, granule: int) -> str:
        return self._build_redis_key_raw(
            prefix=quota.prefix_override or request.prefix,
            window=quota.window_seconds,
            granularity=quota.granularity_seconds,
            granule=granule,
        )

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        if timestamp is None:
            timestamp = int(time())
        else:
            timestamp = int(timestamp)

        keys_to_fetch = []
        for request in requests:
            # We could potentially run this check inside of __post__init__ of
            # RequestedQuota, but the list is actually mutable after
            # construction.
            assert request.quotas

            for quota in request.quotas:
                for granule in quota.iter_window(timestamp):
                    keys_to_fetch.append(
                        self._build_redis_key(request=request, quota=quota, granule=granule)
                    )

        redis_results = dict(zip(keys_to_fetch, self.client.mget(keys_to_fetch)))

        results = []

        for request in requests:
            # We start out with assuming the entire request can be granted in
            # its entirety.
            granted_quota = request.requested

            # A request succeeds (partially) if it fits (partially) into all
            # quotas. For each quota, we calculate how much quota has been used
            # up, and trim the granted_quota by the remaining quota.
            #
            # We need to explicitly handle the possibility that quotas have
            # been overused, in those cases we want to truncate resulting
            # negative "grants" to zero.
            for quota in request.quotas:
                used_quota = sum(
                    int(
                        redis_results.get(
                            self._build_redis_key(request=request, quota=quota, granule=granule)
                        )
                        or 0
                    )
                    for granule in quota.iter_window(timestamp)
                )

                granted_quota = max(0, min(granted_quota, quota.limit - used_quota))

            results.append(GrantedQuota(prefix=request.prefix, granted=granted_quota))

        return timestamp, results

    def use_quotas(
        self,
        requests: Sequence[RequestedQuota],
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        assert len(requests) == len(grants)

        keys_to_incr = {}

        for request, grant in zip(requests, grants):
            assert request.prefix == grant.prefix

            for quota in request.quotas:
                # Only incr most recent granule
                granule = next(quota.iter_window(timestamp))
                key = self._build_redis_key(request=request, quota=quota, granule=granule)
                assert key not in keys_to_incr, "conflicting quotas specified"
                keys_to_incr[key] = grant.granted, quota.window_seconds

        with self.client.pipeline(transaction=False) as pipeline:
            for key, (value, ttl) in keys_to_incr.items():
                pipeline.incrby(key, value)
                # Expire the key in `window_seconds`. Since the key has been
                # recently incremented we know it represents a current
                # timestamp. We could use expireat here, but in tests we use
                # timestamps starting from 0 for convenience.
                pipeline.expire(key, ttl)

            pipeline.execute()

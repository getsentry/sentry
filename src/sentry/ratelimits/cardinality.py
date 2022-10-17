import time
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Collection, Iterator, List, Mapping, NamedTuple, Optional, Sequence, Tuple

import rb

from sentry.utils import metrics, redis
from sentry.utils.services import Service

Hash = int
Timestamp = int


class Quota(NamedTuple):
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

    def __post__init__(self) -> None:
        assert self.window_seconds % self.granularity_seconds == 0

    def iter_window(self, request_timestamp: int) -> Iterator[int]:
        """
        Iterate over the quota's window, yielding values representing each
        (absolute) granule.

        This function is used to calculate keys for storing the number of
        requests made in each granule.

        The iteration is done in reverse-order (newest timestamp to oldest),
        starting with the key to which a currently-processed request should be
        added. That request's timestamp is `request_timestamp`.

        * `request_timestamp / self.granularity_seconds - 1`
        * `request_timestamp / self.granularity_seconds - 2`
        * `request_timestamp / self.granularity_seconds - 3`
        * ...
        """
        value = request_timestamp // self.granularity_seconds

        for granule_i in range(self.window_seconds // self.granularity_seconds):
            value -= 1
            assert value >= 0, value
            yield value


class RequestedQuota(NamedTuple):
    # A string that all redis state is prefixed with. For example
    # `sentry-string-indexer` where 123 is an organization id.
    prefix: str

    # A unit is an abstract term for the object type we want to limit the
    # cardinality of.
    #
    # For example, if you want to limit the cardinality of timeseries in a
    # metrics service, this would be a set of hashes composed from `(org_id,
    # metric_name, tags)`.
    #
    # ...though you can probably omit org_id if it is already in the prefix.
    unit_hashes: Collection[Hash]

    # Which quota to check against. The number of not-yet-seen hashes must
    # "fit" into `Quota.limit`.
    quota: Quota


class GrantedQuota(NamedTuple):
    request: RequestedQuota

    # The subset of hashes provided by the user `self.request` that were
    # accepted by the limiter.
    granted_unit_hashes: Collection[Hash]

    # If len(granted_unit_hashes) < len(RequestedQuota.unit_hashes), this
    # contains the quotas that were reached.
    reached_quota: Optional[Quota]


class CardinalityLimiter(Service):
    """
    A kind of limiter that limits set cardinality instead of a rate/count.

    The high-level concepts are very similar to `sentry.ratelimits.sliding_windows`.

    Instead of passing in numbers and getting back smaller numbers, however, the
    user passes in a set and gets back a smaller set. Set elements that have
    already been observed in any quota's window are "for free" and will not
    count towards any quota.

    The implementation hasn't been finalized yet, but we expect that under the hood
    this cardinality limiter will be more expensive to operate than a simple rate
    limiter, as it needs to keep track of already-seen set elements. The memory
    usage in Redis will most likely be proportional to the set size.

    This kind of limiter does not support prefix overrides, which practically means
    that there can only be a per-org or a global limit, not both at once.
    """

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
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        """
        Given a set of requests and the corresponding return values from
        `check_within_quotas`, consume the quotas.

        :param timestamp: The request timestamp that has previously been passed
            to `check_within_quotas`.
        :param grants: The return value of `check_within_quotas` which
            indicates how much quota should actually be consumed.
        """

        # TODO: we may want to revisit this abstraction once we move the call
        # to `use_quotas` in the string indexer to a separate thread.
        # particularly we are considering to write more recent time windows
        # synchronously while writing older ones on a separate thread.
        raise NotImplementedError()


class RedisCardinalityLimiter(CardinalityLimiter):
    """
    The Redis cardinality limiter stores a key per unit hash, and adds the unit
    hash to a set key prefixed with `RequestedQuota.prefix`. The memory usage
    grows with the dimensionality of `prefix` and the configured quota limit
    per prefix (i.e. the maximum cardinality of
    `GrantedQuota.granted_unit_hashes`).

    Many design decisions for this cardinality limiter were copied from the
    sliding_windows rate limiter. You will find the next couple of paragraphs
    in its documentation as well.

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

        self.backend: RedisBackend = (
            RedisClusterBackend(client) if is_redis_cluster else RedisBlasterBackend(client)
        )

        assert 0 < num_physical_shards <= num_shards
        self.num_shards = num_shards
        self.num_physical_shards = num_physical_shards
        self.metric_tags = metric_tags or {}
        super().__init__()

    @staticmethod
    def _get_timeseries_key(request: RequestedQuota, hash: Hash) -> str:
        return f"cardinality:timeseries:{request.prefix}-{hash}"

    def _get_read_sets_keys(self, request: RequestedQuota, timestamp: Timestamp) -> Sequence[str]:
        oldest_time_bucket = list(request.quota.iter_window(timestamp))[-1]
        return [
            f"cardinality:sets:{request.prefix}-{shard}-{oldest_time_bucket}"
            for shard in range(self.num_physical_shards)
        ]

    def _get_write_sets_keys(
        self, request: RequestedQuota, timestamp: Timestamp, hash: Hash
    ) -> Sequence[str]:
        shard = hash % self.num_shards
        if shard < self.num_physical_shards:
            return [
                f"cardinality:sets:{request.prefix}-{shard}-{time_bucket}"
                for time_bucket in request.quota.iter_window(timestamp)
            ]
        else:
            return []

    def _get_set_cardinality_sample_factor(self) -> float:
        return self.num_shards / self.num_physical_shards

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        if timestamp is None:
            timestamp = int(time.time())
        else:
            timestamp = int(timestamp)

        unit_keys_to_get: List[str] = []
        set_keys_to_count: List[str] = []

        for request in requests:
            for hash in request.unit_hashes:
                unit_keys_to_get.append(self._get_timeseries_key(request, hash))

            set_keys_to_count.extend(self._get_read_sets_keys(request, timestamp))

        if not unit_keys_to_get and not set_keys_to_count:
            # If there are no keys to fetch (i.e. there are no quotas to
            # enforce), we can save the redis call entirely and just grant all
            # quotas immediately.
            return timestamp, [
                GrantedQuota(
                    request=request, granted_unit_hashes=request.unit_hashes, reached_quota=None
                )
                for request in requests
            ]

        unit_keys, set_counts = self.backend.run_check_within_quotas(
            unit_keys_to_get, set_keys_to_count
        )

        grants = []
        cardinality_sample_factor = self._get_set_cardinality_sample_factor()
        for request in requests:
            granted_hashes = []

            set_count = sum(set_counts[k] for k in self._get_read_sets_keys(request, timestamp))

            metrics.timing(
                key="ratelimits.cardinality.set_size",
                value=set_count,
                tags=self.metric_tags,
            )

            remaining_limit = max(
                0,
                request.quota.limit - cardinality_sample_factor * set_count,
            )

            remaining_limit_running = remaining_limit
            reached_quota = None

            # for each hash in the request, check if:
            # 1. the hash is in `unit_keys`. If so, it has already been seen in
            #    this timewindow, and ingesting additional copies of it comes
            #    at no cost (= ingesting multiple metric buckets of the same
            #    timeseries only counts once against quota)
            #
            # 2. we still have budget/"remaining_limit". In that case,
            #    accept/admit the hash as well and reduce the remaining quota.
            #
            # 3. we have observed a totally new hash. in that case set
            #    `reached_quotas` for reporting purposes, but don't add the
            #    hash to `granted_hashes` (which is our return value)
            for hash in request.unit_hashes:
                if unit_keys[self._get_timeseries_key(request, hash)]:
                    granted_hashes.append(hash)
                elif remaining_limit_running > 0:
                    granted_hashes.append(hash)
                    remaining_limit_running -= 1
                else:
                    reached_quota = request.quota

            grants.append(
                GrantedQuota(
                    request=request,
                    granted_unit_hashes=granted_hashes,
                    reached_quota=reached_quota,
                )
            )

        return timestamp, grants

    def use_quotas(
        self,
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        unit_keys_to_set = {}
        set_keys_to_add = defaultdict(set)
        set_keys_ttl = {}

        for grant in grants:
            key_ttl = grant.request.quota.window_seconds

            for hash in grant.granted_unit_hashes:
                unit_key = self._get_timeseries_key(grant.request, hash)
                unit_keys_to_set[unit_key] = key_ttl

                for set_key in self._get_write_sets_keys(grant.request, timestamp, hash):
                    set_keys_ttl[set_key] = key_ttl
                    set_keys_to_add[set_key].add(hash)

        if not set_keys_to_add and not unit_keys_to_set:
            # If there are no keys to mutate (i.e. there are no quotas to
            # enforce), we can save the redis call entirely.
            return

        self.backend.run_use_quotas(unit_keys_to_set, set_keys_to_add, set_keys_ttl)


class RedisBackend(ABC):
    @abstractmethod
    def run_check_within_quotas(
        self, unit_keys_to_get: Sequence[str], set_keys_to_count: Sequence[str]
    ) -> Tuple[Mapping[str, int], Mapping[str, int]]:
        ...

    @abstractmethod
    def run_use_quotas(
        self,
        unit_keys_to_set: Mapping[str, int],
        set_keys_to_add: Mapping[str, Collection[int]],
        set_keys_ttl: Mapping[str, int],
    ) -> None:
        ...


class RedisClusterBackend(RedisBackend):
    def __init__(self, client: redis.RedisCluster) -> None:
        self.client = client

    def run_check_within_quotas(
        self, unit_keys_to_get: Sequence[str], set_keys_to_count: Sequence[str]
    ) -> Tuple[Mapping[str, int], Mapping[str, int]]:
        with self.client.pipeline(transaction=False) as pipeline:
            pipeline.mget(unit_keys_to_get)
            # O(self.cluster_shard_factor * len(requests)), assuming there's
            # only one per-org quota
            for key in set_keys_to_count:
                pipeline.scard(key)

            results = iter(pipeline.execute())
            unit_keys = dict(zip(unit_keys_to_get, next(results)))
            set_counts = dict(zip(set_keys_to_count, results))

        return unit_keys, set_counts

    def run_use_quotas(
        self,
        unit_keys_to_set: Mapping[str, int],
        set_keys_to_add: Mapping[str, Collection[int]],
        set_keys_ttl: Mapping[str, int],
    ) -> None:
        with self.client.pipeline(transaction=False) as pipeline:
            for key, ttl in unit_keys_to_set.items():
                pipeline.setex(key, ttl, 1)

            for key, items in set_keys_to_add.items():
                items_list = list(items)
                while items_list:
                    # SADD can take multiple arguments, but if you provide too
                    # many you end up with very long-running redis commands.
                    pipeline.sadd(key, *items_list[:200])
                    items_list = items_list[200:]

                pipeline.expire(key, set_keys_ttl[key])

            pipeline.execute()


class RedisBlasterBackend(RedisBackend):
    def __init__(self, client: rb.Cluster) -> None:
        self.client = client

    def run_check_within_quotas(
        self, unit_keys_to_get: Sequence[str], set_keys_to_count: Sequence[str]
    ) -> Tuple[Mapping[str, int], Mapping[str, int]]:
        with self.client.map() as client:
            mget_result = client.mget(unit_keys_to_get)

            scard_results = [client.scard(key) for key in set_keys_to_count]

        unit_keys = dict(zip(unit_keys_to_get, mget_result.value))
        set_counts = dict(zip(set_keys_to_count, (p.value for p in scard_results)))

        return unit_keys, set_counts

    def run_use_quotas(
        self,
        unit_keys_to_set: Mapping[str, int],
        set_keys_to_add: Mapping[str, Collection[int]],
        set_keys_ttl: Mapping[str, int],
    ) -> None:
        with self.client.map() as pipeline:
            for key, ttl in unit_keys_to_set.items():
                pipeline.setex(key, ttl, 1)

            for key, items in set_keys_to_add.items():
                items_list = list(items)
                while items_list:
                    # SADD can take multiple arguments, but if you provide too
                    # many you end up with very long-running redis commands.
                    pipeline.sadd(key, *items_list[:200])
                    items_list = items_list[200:]

                pipeline.expire(key, set_keys_ttl[key])

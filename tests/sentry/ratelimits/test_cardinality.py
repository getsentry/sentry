from typing import Collection, Optional, Sequence

import pytest

from sentry.ratelimits.cardinality import (
    GrantedQuota,
    Quota,
    RedisCardinalityLimiter,
    RequestedQuota,
)


@pytest.fixture
def limiter():
    return RedisCardinalityLimiter()


class LimiterHelper:
    """
    Wrapper interface around the rate limiter, with specialized, stateful and
    primitive interface for more readable tests.
    """

    def __init__(self, limiter: RedisCardinalityLimiter):
        self.limiter = limiter
        self.quota = Quota(window_seconds=3600, granularity_seconds=60, limit=10)
        self.timestamp = 3600

    def add_value(self, value: int) -> Optional[int]:
        values = self.add_values([value])
        if values:
            (value,) = values
            return value
        else:
            return None

    def add_values(self, values: Sequence[int]) -> Collection[int]:
        request = RequestedQuota(prefix="hello", unit_hashes=values, quota=self.quota)
        new_timestamp, grants = self.limiter.check_within_quotas(
            [request], timestamp=self.timestamp
        )
        self.limiter.use_quotas(grants, new_timestamp)
        (grant,) = grants
        return grant.granted_unit_hashes


def test_basic(limiter: RedisCardinalityLimiter):
    helper = LimiterHelper(limiter)

    for _ in range(20):
        assert helper.add_value(1) == 1

    for _ in range(20):
        assert helper.add_value(2) == 2

    assert [helper.add_value(10 + i) for i in range(100)] == list(range(10, 18)) + [None] * 92

    helper.timestamp += 3600

    # an hour has passed, we should be able to admit 10 new keys
    #
    # note: we only virtually advanced the timestamp. The
    # `cardinality:timeseries` keys for 1, 2 still exist in this test setup
    # (and we would admit them on top of 10..20), but they won't in a
    # real-world scenario
    assert [helper.add_value(10 + i) for i in range(100)] == list(range(10, 20)) + [None] * 90


def test_multiple_prefixes(limiter: RedisCardinalityLimiter):
    """
    Test multiple prefixes/organizations and just make sure we're not leaking
    state between prefixes.

    * `a` only consumes 5 of the quota first and runs out of quota in the
      second `check_within_quotas` call
    * `b` immediately exceeds the quota.
    * `c` fits comfortably into the quota at first (fills out the limit exactly)
    """
    quota = Quota(window_seconds=3600, granularity_seconds=60, limit=10)
    requests = [
        RequestedQuota(prefix="a", unit_hashes={1, 2, 3, 4, 5}, quota=quota),
        RequestedQuota(prefix="b", unit_hashes={1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, quota=quota),
        RequestedQuota(
            prefix="c", unit_hashes={11, 12, 13, 14, 15, 16, 17, 18, 19, 20}, quota=quota
        ),
    ]
    new_timestamp, grants = limiter.check_within_quotas(requests)

    assert grants == [
        GrantedQuota(request=requests[0], granted_unit_hashes=[1, 2, 3, 4, 5], reached_quota=None),
        GrantedQuota(
            request=requests[1],
            granted_unit_hashes=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            reached_quota=quota,
        ),
        GrantedQuota(
            request=requests[2],
            granted_unit_hashes=[11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
            reached_quota=None,
        ),
    ]
    limiter.use_quotas(grants, new_timestamp)

    requests = [
        RequestedQuota(prefix="a", unit_hashes={6, 7, 8, 9, 10, 11}, quota=quota),
        RequestedQuota(prefix="b", unit_hashes={1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, quota=quota),
        RequestedQuota(
            prefix="c", unit_hashes={11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21}, quota=quota
        ),
    ]
    new_timestamp, grants = limiter.check_within_quotas(requests)

    assert grants == [
        GrantedQuota(
            request=requests[0], granted_unit_hashes=[6, 7, 8, 9, 10], reached_quota=quota
        ),
        GrantedQuota(
            request=requests[1],
            granted_unit_hashes=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            reached_quota=quota,
        ),
        GrantedQuota(
            request=requests[2],
            granted_unit_hashes=[11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
            reached_quota=quota,
        ),
    ]
    limiter.use_quotas(grants, new_timestamp)


def test_sliding(limiter: RedisCardinalityLimiter):
    """
    Our rate limiter has a sliding window of [now - 1 hour ; now], with a
    granularity of 1 hour.

    What that means is that, as time moves on, old hashes should be forgotten
    _one by one_, and the quota budget they occupy should become _gradually_
    available to newer, never-seen-before items.
    """

    helper = LimiterHelper(limiter)

    admissions = []

    # We start with a limit of 10 new hashes per hour. We add a new hash and
    # advance time by 6 minutes, _100 times_
    for i in range(100):
        admissions.append(helper.add_value(i))
        helper.timestamp += 360

    # We assert that _all 100 items_ are admitted/accepted. This is because we
    # have advanced time between each item. We have "slept" for 6 minutes a 100
    # times, so we actually added 100 hashes over a span of 10 hours. That
    # should totally fit into our limit.
    assert admissions == list(range(100))

    admissions = []
    expected = []

    # 100 hashes over 10 hours is "basically" 10 hashes over 1 hour. Since we
    # added items over a span of 10 hours, the limiter should've forgotten
    # about 90% of items already, meaning that in a real-world scenario, we
    # should accept 90 new hashes.
    #
    # But since we only advanced time virtually (and not in Redis for TTL
    # purposes), we actually only accept 10 items... a flaw in this test.
    #
    # Anyway, in the previous loop we added an item every 6 minutes. Now we're
    # adding an item 10 times per 6 minutes. So we should see every 10th item
    # being admitted.
    for i in range(100, 200):
        admissions.append(helper.add_value(i))
        expected.append(i if i % 10 == 0 else None)
        helper.timestamp += 36

    assert admissions == expected


def test_sampling(limiter: RedisCardinalityLimiter) -> None:
    """
    demonstrate behavior when "shard sampling" is active. If one out of 10
    shards for an organization are stored, it is still possible to limit the
    exactly correct amount of hashes, for certain hash values.
    """
    limiter.impl.num_physical_shards = 1
    limiter.impl.num_shards = 10
    helper = LimiterHelper(limiter)

    # when adding "hashes" 0..10 in ascending order, the first hash will fill up the physical shard
    admissions = [helper.add_value(i) for i in reversed(range(10))]
    assert admissions == list(reversed(range(10)))

    # we have stored only one shard out of 10, meaning the set count reported
    # from redis is 1, but the total counts are extrapolated correctly. like
    # without sampling, assert that the limit of 10 hashes is correctly applied
    # and we no longer accept additional hashes beyond 10.
    admissions = [helper.add_value(i) for i in range(100, 110)]
    assert admissions == [None] * 10


def test_sampling_going_bad(limiter: RedisCardinalityLimiter):
    """
    test an edgecase of set sampling in the cardinality limiter. it is not
    exactly desired behavior but a known sampling artifact
    """
    limiter.impl.num_physical_shards = 1
    limiter.impl.num_shards = 10
    helper = LimiterHelper(limiter)

    # when adding "hashes" 0..10 in ascending order, the first hash will fill
    # up the physical shard, and a total count of 10 is extrapolated from that
    admissions = [helper.add_value(i) for i in range(10)]
    assert admissions == [0] + [None] * 9


def test_regression_mixed_order(limiter: RedisCardinalityLimiter):
    """
    Regression test to assert we still accept hashes after dropping some
    within the same request, regardless of set order.
    """

    helper = LimiterHelper(limiter)
    # this hash certainly fits into the default limit of 10 hashes
    assert helper.add_value(5) == 5
    # here, only 10 should be limited, as it is the 11th item being fed to the indexer.
    # 5 was admitted in an earlier call, and 0..9 are admitted right before it.
    # there used to be a bug where anything after 10 (i.e. 5) was dropped as
    # well (due to a wrong `break` somewhere in a loop)
    assert helper.add_values([0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 5]) == [0, 1, 2, 3, 4, 6, 7, 8, 9, 5]

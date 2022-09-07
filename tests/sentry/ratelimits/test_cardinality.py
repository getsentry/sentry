from typing import Optional

import pytest

from sentry.ratelimits.cardinality import Quota, RedisCardinalityLimiter, RequestedQuota


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
        self.quotas = [Quota(window_seconds=3600, granularity_seconds=60, limit=10)]
        self.timestamp = 3600

    def add_value(self, value: int) -> Optional[int]:
        request = RequestedQuota(prefix="hello", unit_hashes=[value], quotas=self.quotas)
        new_timestamp, grants = self.limiter.check_within_quotas(
            [request], timestamp=self.timestamp
        )
        self.limiter.use_quotas(grants, new_timestamp)
        (grant,) = grants
        if grant.granted_unit_hashes == [value]:
            return value


def test_basic(limiter: RedisCardinalityLimiter):
    helper = LimiterHelper(limiter)

    for _ in range(20):
        assert helper.add_value(1) == 1

    for _ in range(20):
        assert helper.add_value(2) == 2

    assert [helper.add_value(10 + i) for i in range(100)] == list(range(10, 18)) + [None] * 92

    helper.timestamp += 3600

    # some old keys 1, 2 expired, we should be able to admit the same keys
    # 10..18 again + 2 new keys
    assert [helper.add_value(10 + i) for i in range(100)] == list(range(10, 20)) + [None] * 90


def test_sliding(limiter: RedisCardinalityLimiter):
    helper = LimiterHelper(limiter)

    admissions = []

    for i in range(100):
        admissions.append(helper.add_value(i))
        helper.timestamp += 360

    assert admissions == list(range(100))

    admissions = []
    expected = []

    for i in range(100, 200):
        admissions.append(helper.add_value(i))
        expected.append(i if i % 10 == 0 else None)
        helper.timestamp += 36

    assert admissions == expected


def test_noop(limiter: RedisCardinalityLimiter):
    helper = LimiterHelper(limiter)
    helper.quotas = []
    helper.limiter.client = None
    assert helper.add_value(1) == 1


def test_sampling(limiter: RedisCardinalityLimiter):
    limiter.cluster_num_physical_shards = 1
    limiter.cluster_num_shards = 10
    helper = LimiterHelper(limiter)

    # when adding "hashes" 0..10 in ascending order, the first hash will fill up the physical shard
    admissions = [helper.add_value(i) for i in reversed(range(10))]
    assert admissions == list(reversed(range(10)))

    admissions = [helper.add_value(i) for i in range(100, 110)]
    assert admissions == [None] * 10


def test_sampling_going_bad(limiter: RedisCardinalityLimiter):
    """
    test an edgecase of set sampling in the cardinality limiter. it is not
    exactly desired behavior but a known sampling artifact
    """
    limiter.cluster_num_physical_shards = 1
    limiter.cluster_num_shards = 10
    helper = LimiterHelper(limiter)

    # when adding "hashes" 0..10 in ascending order, the first hash will fill
    # up the physical shard, and a total count of 10 is extrapolated from that
    admissions = [helper.add_value(i) for i in range(10)]
    assert admissions == [0] + [None] * 9

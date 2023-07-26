import pytest

from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RedisSlidingWindowRateLimiter,
    RequestedQuota,
)


@pytest.fixture
def limiter():
    return RedisSlidingWindowRateLimiter()


TIMESTAMP_OFFSET = 100


def test_empty_quota(limiter):
    quotas = [
        Quota(
            window_seconds=10,
            granularity_seconds=1,
            limit=0,
        )
    ]
    resp = limiter.check_and_use_quotas(
        [
            RequestedQuota(
                prefix="foo",
                requested=1,
                quotas=quotas,
            )
        ]
    )
    assert resp == [GrantedQuota(prefix="foo", granted=0, reached_quotas=quotas)]


def test_basic(limiter):
    quotas = [
        Quota(
            window_seconds=10,
            granularity_seconds=1,
            limit=10,
        )
    ]

    for timestamp in range(10):
        resp = limiter.check_and_use_quotas(
            [RequestedQuota(prefix="foo", requested=1, quotas=quotas)],
            timestamp=TIMESTAMP_OFFSET + timestamp,
        )
        assert resp == [GrantedQuota(prefix="foo", granted=1, reached_quotas=[])]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=1, quotas=quotas)], timestamp=TIMESTAMP_OFFSET + 9
    )
    assert resp == [GrantedQuota(prefix="foo", granted=0, reached_quotas=quotas)]

    for timestamp in range(10, 20):
        resp = limiter.check_and_use_quotas(
            [RequestedQuota(prefix="foo", requested=1, quotas=quotas)],
            timestamp=TIMESTAMP_OFFSET + timestamp,
        )

        assert resp == [GrantedQuota(prefix="foo", granted=1, reached_quotas=[])]

        resp = limiter.check_and_use_quotas(
            [RequestedQuota(prefix="foo", requested=1, quotas=quotas)],
            timestamp=TIMESTAMP_OFFSET + timestamp,
        )

        assert resp == [GrantedQuota(prefix="foo", granted=0, reached_quotas=quotas)]

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


def test_empty_quota(limiter):
    resp = limiter.check_and_use_quotas(
        [
            RequestedQuota(
                prefix="foo",
                requested=1,
                quotas=[
                    Quota(
                        window_seconds=10,
                        granularity_seconds=1,
                        limit=0,
                    )
                ],
            )
        ]
    )
    assert resp == [GrantedQuota(prefix="foo", granted=0)]


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
            [RequestedQuota(prefix="foo", requested=1, quotas=quotas)], timestamp=timestamp
        )
        assert resp == [GrantedQuota(prefix="foo", granted=1)]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=1, quotas=quotas)], timestamp=9
    )
    assert resp == [GrantedQuota(prefix="foo", granted=0)]

    for timestamp in range(10, 20):
        resp = limiter.check_and_use_quotas(
            [RequestedQuota(prefix="foo", requested=1, quotas=quotas)], timestamp=timestamp
        )

        assert resp == [GrantedQuota(prefix="foo", granted=1)]

        resp = limiter.check_and_use_quotas(
            [RequestedQuota(prefix="foo", requested=1, quotas=quotas)], timestamp=timestamp
        )

        assert resp == [GrantedQuota(prefix="foo", granted=0)]


def test_multiple_windows(limiter):
    quotas = [
        Quota(window_seconds=10, granularity_seconds=1, limit=10),
        Quota(window_seconds=5, granularity_seconds=1, limit=5),
    ]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=0
    )

    assert resp == [GrantedQuota(prefix="foo", granted=5)]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=0
    )

    assert resp == [GrantedQuota(prefix="foo", granted=0)]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=2
    )

    assert resp == [GrantedQuota(prefix="foo", granted=0)]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=6
    )

    assert resp == [GrantedQuota(prefix="foo", granted=5)]

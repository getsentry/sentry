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


def test_multiple_windows(limiter):
    quotas = [
        Quota(window_seconds=10, granularity_seconds=1, limit=10),
        Quota(window_seconds=5, granularity_seconds=1, limit=5),
    ]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=TIMESTAMP_OFFSET
    )

    assert resp == [GrantedQuota(prefix="foo", granted=5, reached_quotas=quotas[1:])]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=TIMESTAMP_OFFSET
    )

    assert resp == [GrantedQuota(prefix="foo", granted=0, reached_quotas=quotas)]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=TIMESTAMP_OFFSET + 2
    )

    assert resp == [GrantedQuota(prefix="foo", granted=0, reached_quotas=quotas)]

    resp = limiter.check_and_use_quotas(
        [RequestedQuota(prefix="foo", requested=6, quotas=quotas)], timestamp=TIMESTAMP_OFFSET + 6
    )

    assert resp == [GrantedQuota(prefix="foo", granted=5, reached_quotas=quotas[:1])]


def test_conflicting_quotas(limiter):
    quotas = [
        Quota(window_seconds=10, granularity_seconds=1, limit=10, prefix_override="hello"),
    ]

    resp = limiter.check_and_use_quotas(
        [
            RequestedQuota(prefix="foo", requested=6, quotas=quotas),
            RequestedQuota(prefix="bar", requested=6, quotas=quotas),
        ],
        timestamp=TIMESTAMP_OFFSET,
    )

    assert resp == [
        GrantedQuota(prefix="foo", granted=6, reached_quotas=[]),
        GrantedQuota(prefix="bar", granted=4, reached_quotas=quotas),
    ]

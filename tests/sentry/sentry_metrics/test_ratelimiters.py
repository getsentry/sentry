from sentry.ratelimits.sliding_windows import RedisSlidingWindowRateLimiter
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import KeyCollection
from sentry.sentry_metrics.indexer.ratelimiters import WritesLimiter


def get_writes_limiter():
    writes_limiter = WritesLimiter()
    redis_limiter = RedisSlidingWindowRateLimiter()
    writes_limiter.rate_limiters = {
        UseCaseKey.RELEASE_HEALTH: redis_limiter,
        UseCaseKey.PERFORMANCE: redis_limiter,
    }
    return writes_limiter


def test_writes_limiter_no_limits(set_sentry_option):
    set_sentry_option("sentry-metrics.writes-limiter.limits.performance.per-org", [])
    set_sentry_option("sentry-metrics.writes-limiter.limits.performance.global", [])
    writes_limiter = get_writes_limiter()

    key_collection = KeyCollection(
        {
            1: {"a", "b", "c"},
            2: {"a", "b", "c"},
        }
    )

    state, new_key_collection, dropped_strings = writes_limiter.check_write_limits(
        UseCaseKey.PERFORMANCE, key_collection
    )

    assert not dropped_strings
    assert new_key_collection.as_tuples() == key_collection.as_tuples()


def test_writes_limiter_doesnt_limit(set_sentry_option):
    set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.per-org",
        [{"window_seconds": 10, "granularity_seconds": 10, "limit": 3}],
    )
    set_sentry_option("sentry-metrics.writes-limiter.limits.performance.global", [])
    writes_limiter = get_writes_limiter()

    key_collection = KeyCollection(
        {
            1: {"a", "b", "c"},
            2: {"a", "b", "c"},
        }
    )

    state, new_key_collection, dropped_strings = writes_limiter.check_write_limits(
        UseCaseKey.PERFORMANCE, key_collection
    )

    assert not dropped_strings
    assert new_key_collection.as_tuples() == key_collection.as_tuples()


def test_writes_limiter_org_limit(set_sentry_option):
    set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.per-org",
        [{"window_seconds": 10, "granularity_seconds": 10, "limit": 2}],
    )
    set_sentry_option("sentry-metrics.writes-limiter.limits.performance.global", [])
    writes_limiter = get_writes_limiter()

    key_collection = KeyCollection(
        {
            1: {"a", "b", "c"},
            2: {"a", "b", "c"},
        }
    )

    state, new_key_collection, dropped_strings = writes_limiter.check_write_limits(
        UseCaseKey.PERFORMANCE, key_collection
    )

    assert len(dropped_strings) == 2
    assert sorted(ds.key_result.org_id for ds in dropped_strings) == [1, 2]
    assert sorted(org_id for org_id, string in new_key_collection.as_tuples()) == [1, 1, 2, 2]


def test_writes_limiter_global_limit(set_sentry_option):
    set_sentry_option("sentry-metrics.writes-limiter.limits.performance.per-org", [])
    set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.global",
        [{"window_seconds": 10, "granularity_seconds": 10, "limit": 4}],
    )
    writes_limiter = get_writes_limiter()

    # edgecase: each organization's quota fits into the global quota
    # individually, but not in total.
    key_collection = KeyCollection(
        {
            1: {"a", "b", "c"},
            2: {"a", "b", "c"},
        }
    )

    state, new_key_collection, dropped_strings = writes_limiter.check_write_limits(
        UseCaseKey.PERFORMANCE, key_collection
    )

    assert len(dropped_strings) == 2

from sentry.sentry_metrics.configuration import (
    PERFORMANCE_PG_NAMESPACE,
    RELEASE_HEALTH_PG_NAMESPACE,
    UseCaseKey,
)
from sentry.sentry_metrics.indexer.base import KeyCollection
from sentry.sentry_metrics.indexer.limiters.writes import WritesLimiter

WRITES_LIMITERS = {
    RELEASE_HEALTH_PG_NAMESPACE: WritesLimiter(RELEASE_HEALTH_PG_NAMESPACE, **{}),
    PERFORMANCE_PG_NAMESPACE: WritesLimiter(PERFORMANCE_PG_NAMESPACE, **{}),
}


def get_writes_limiter(namespace: str):
    return WRITES_LIMITERS[namespace]


def test_writes_limiter_no_limits(set_sentry_option):
    with set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.per-org", []
    ), set_sentry_option("sentry-metrics.writes-limiter.limits.performance.global", []):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        key_collection = KeyCollection(
            {
                1: {"a", "b", "c"},
                2: {"a", "b", "c"},
            }
        )

        with writes_limiter.check_write_limits(UseCaseKey.PERFORMANCE, key_collection) as state:
            assert not state.dropped_strings
            assert state.accepted_keys.as_tuples() == key_collection.as_tuples()


def test_writes_limiter_doesnt_limit(set_sentry_option):
    with set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.per-org",
        [{"window_seconds": 10, "granularity_seconds": 10, "limit": 3}],
    ), set_sentry_option("sentry-metrics.writes-limiter.limits.performance.global", []):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        key_collection = KeyCollection(
            {
                1: {"a", "b", "c"},
                2: {"a", "b", "c"},
            }
        )

        with writes_limiter.check_write_limits(UseCaseKey.PERFORMANCE, key_collection) as state:
            assert not state.dropped_strings
            assert state.accepted_keys.as_tuples() == key_collection.as_tuples()


def test_writes_limiter_org_limit(set_sentry_option):
    with set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.per-org",
        [{"window_seconds": 10, "granularity_seconds": 10, "limit": 2}],
    ), set_sentry_option("sentry-metrics.writes-limiter.limits.performance.global", []):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        key_collection = KeyCollection(
            {
                1: {"a", "b", "c"},
                2: {"a", "b", "c"},
            }
        )

        with writes_limiter.check_write_limits(UseCaseKey.PERFORMANCE, key_collection) as state:
            assert len(state.dropped_strings) == 2
            assert sorted(ds.key_result.org_id for ds in state.dropped_strings) == [1, 2]
            assert sorted(org_id for org_id, string in state.accepted_keys.as_tuples()) == [
                1,
                1,
                2,
                2,
            ]


def test_writes_limiter_global_limit(set_sentry_option):
    with set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.per-org", []
    ), set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.global",
        [{"window_seconds": 10, "granularity_seconds": 10, "limit": 4}],
    ):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        # edgecase: each organization's quota fits into the global quota
        # individually, but not in total.
        key_collection = KeyCollection(
            {
                1: {"a", "b", "c"},
                2: {"a", "b", "c"},
            }
        )

        with writes_limiter.check_write_limits(UseCaseKey.PERFORMANCE, key_collection) as state:
            assert len(state.dropped_strings) == 2


def test_writes_limiter_respects_namespaces(set_sentry_option):
    """
    Rate limiters can have the same use case but different namespaces,
    so each namespace should have it's own quota.

    Here we test that a namespace currently exceededing quota results in
    dropping all strings for subsequent calls to check_write_limits, while
    a different namespace is unaffected (no strings are dropped).
    """
    with set_sentry_option(
        "sentry-metrics.writes-limiter.limits.performance.per-org",
        [{"window_seconds": 20, "granularity_seconds": 20, "limit": 2}],
    ), set_sentry_option("sentry-metrics.writes-limiter.limits.performance.global", []):
        writes_limiter_perf = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        key_collection = KeyCollection(
            {
                1: {"a", "b", "c"},
                2: {"a", "b", "c"},
            }
        )

        with writes_limiter_perf.check_write_limits(
            UseCaseKey.PERFORMANCE, key_collection
        ) as state:
            assert len(state.dropped_strings) == 2

        key_collection = KeyCollection(
            {
                1: {"d", "e"},
                2: {"d", "e"},
            }
        )

        with writes_limiter_perf.check_write_limits(
            UseCaseKey.PERFORMANCE, key_collection
        ) as state:
            assert len(state.dropped_strings) == 4

        writes_limiter_rh = get_writes_limiter(RELEASE_HEALTH_PG_NAMESPACE)

        with writes_limiter_rh.check_write_limits(UseCaseKey.PERFORMANCE, key_collection) as state:
            assert not state.dropped_strings

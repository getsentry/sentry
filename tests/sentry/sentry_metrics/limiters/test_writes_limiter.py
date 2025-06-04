from unittest.mock import patch

from sentry.sentry_metrics.configuration import (
    PERFORMANCE_PG_NAMESPACE,
    RELEASE_HEALTH_PG_NAMESPACE,
    UseCaseKey,
)
from sentry.sentry_metrics.indexer.base import UseCaseKeyCollection
from sentry.sentry_metrics.indexer.limiters.writes import WritesLimiter
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.helpers.options import override_options

WRITES_LIMITERS = {
    RELEASE_HEALTH_PG_NAMESPACE: WritesLimiter(RELEASE_HEALTH_PG_NAMESPACE, **{}),
    PERFORMANCE_PG_NAMESPACE: WritesLimiter(PERFORMANCE_PG_NAMESPACE, **{}),
}


def get_writes_limiter(namespace: str):
    return WRITES_LIMITERS[namespace]


MOCK_METRIC_PATH_MAPPING = {
    UseCaseID.TRANSACTIONS: UseCaseKey.PERFORMANCE,
    UseCaseID.SPANS: UseCaseKey.PERFORMANCE,
    UseCaseID.ESCALATING_ISSUES: UseCaseKey.PERFORMANCE,
}

MOCK_REVERSE_METRIC_PATH_MAPPING = {
    UseCaseKey.RELEASE_HEALTH: UseCaseID.SESSIONS,
    UseCaseKey.PERFORMANCE: UseCaseID.TRANSACTIONS,
}

MOCK_USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.TRANSACTIONS: "sentry-metrics.writes-limiter.limits.transactions",
    UseCaseID.SPANS: "sentry-metrics.writes-limiter.limits.uc1",
    UseCaseID.ESCALATING_ISSUES: "sentry-metrics.writes-limiter.limits.uc2",
}


@patch(
    "sentry.sentry_metrics.indexer.limiters.writes.USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS",
    MOCK_USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS,
)
def test_writes_limiter_no_limits():
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.transactions.global": [],
            "sentry-metrics.writes-limiter.limits.transactions.per-org": [],
            "sentry-metrics.writes-limiter.limits.uc1.global": [],
            "sentry-metrics.writes-limiter.limits.uc1.per-org": [],
            "sentry-metrics.writes-limiter.limits.uc2.global": [],
            "sentry-metrics.writes-limiter.limits.uc2.per-org": [],
            "sentry-metrics.writes-limiter.limits.generic-metrics.global": [],
            "sentry-metrics.writes-limiter.limits.generic-metrics.per-org": [],
        },
    ):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        use_case_keys = UseCaseKeyCollection(
            {
                UseCaseID.TRANSACTIONS: {
                    1: {"a", "b", "c"},
                    2: {"a", "b", "c"},
                },
                UseCaseID.SPANS: {
                    10: {"x", "y", "z"},
                    11: {"a", "b", "c"},
                },
                UseCaseID.ESCALATING_ISSUES: {
                    3: {"x", "y", "z"},
                    4: {"a", "b", "c"},
                },
            }
        )
        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert not state.dropped_strings
            assert state.accepted_keys.as_tuples() == use_case_keys.as_tuples()


@patch(
    "sentry.sentry_metrics.indexer.limiters.writes.USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS",
    MOCK_USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS,
)
def test_writes_limiter_doesnt_limit():
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.transactions.global": [],
            "sentry-metrics.writes-limiter.limits.transactions.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
            ],
            "sentry-metrics.writes-limiter.limits.uc1.global": [],
            "sentry-metrics.writes-limiter.limits.uc1.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 2}
            ],
            "sentry-metrics.writes-limiter.limits.uc2.global": [],
            "sentry-metrics.writes-limiter.limits.uc2.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 3}
            ],
            "sentry-metrics.writes-limiter.limits.generic-metrics.global": [],
            "sentry-metrics.writes-limiter.limits.generic-metrics.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 4}
            ],
        },
    ):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        use_case_keys = UseCaseKeyCollection(
            {
                UseCaseID.TRANSACTIONS: {
                    1: {"a"},
                    2: {"b"},
                },
                UseCaseID.SPANS: {
                    3: {"c", "d"},
                    4: {"e", "f"},
                },
                UseCaseID.ESCALATING_ISSUES: {
                    5: {"g", "h", "i"},
                    6: {"j", "k", "l"},
                },
            }
        )

        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert not state.dropped_strings
            assert state.accepted_keys.as_tuples() == use_case_keys.as_tuples()


@patch(
    "sentry.sentry_metrics.indexer.limiters.writes.USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS",
    MOCK_USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS,
)
def test_writes_limiter_org_limit():
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.transactions.global": [],
            "sentry-metrics.writes-limiter.limits.transactions.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 0}
            ],
            "sentry-metrics.writes-limiter.limits.uc1.global": [],
            "sentry-metrics.writes-limiter.limits.uc1.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
            ],
            "sentry-metrics.writes-limiter.limits.uc2.global": [],
            "sentry-metrics.writes-limiter.limits.uc2.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 2}
            ],
            "sentry-metrics.writes-limiter.limits.generic-metrics.global": [],
            "sentry-metrics.writes-limiter.limits.generic-metrics.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 3}
            ],
        },
    ):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        use_case_keys = UseCaseKeyCollection(
            {
                UseCaseID.TRANSACTIONS: {
                    1: {"a"},
                    2: {"b"},
                },
                UseCaseID.SPANS: {
                    3: {"c", "d"},
                    4: {"e", "f"},
                },
                UseCaseID.ESCALATING_ISSUES: {
                    5: {"g", "h", "i"},
                    6: {"j", "k", "l"},
                },
            }
        )

        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 6
            assert sorted(ds.use_case_key_result.org_id for ds in state.dropped_strings) == [
                1,
                2,
                3,
                4,
                5,
                6,
            ]
            assert sorted(org_id for _, org_id, _ in state.accepted_keys.as_tuples()) == [
                3,
                4,
                5,
                5,
                6,
                6,
            ]


@patch(
    "sentry.sentry_metrics.indexer.limiters.writes.USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS",
    MOCK_USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS,
)
def test_writes_limiter_global_limit():
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.transactions.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
            ],
            "sentry-metrics.writes-limiter.limits.transactions.per-org": [],
            "sentry-metrics.writes-limiter.limits.uc1.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 2}
            ],
            "sentry-metrics.writes-limiter.limits.uc1.per-org": [],
            "sentry-metrics.writes-limiter.limits.uc2.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 3}
            ],
            "sentry-metrics.writes-limiter.limits.uc2.per-org": [],
            "sentry-metrics.writes-limiter.limits.generic-metrics.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 4}
            ],
            "sentry-metrics.writes-limiter.limits.generic-metrics.per-org": [],
        },
    ):
        writes_limiter = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        # edgecase: each organization's quota fits into the global quota
        # individually, but not in total.
        use_case_keys = UseCaseKeyCollection(
            {
                UseCaseID.TRANSACTIONS: {
                    1: {"a"},
                    2: {"b"},
                },
                UseCaseID.SPANS: {
                    3: {"c", "d"},
                    4: {"e", "f"},
                },
                UseCaseID.ESCALATING_ISSUES: {
                    5: {"g", "h", "i"},
                    6: {"j", "k", "l"},
                },
            }
        )

        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 6


@patch(
    "sentry.sentry_metrics.indexer.limiters.writes.USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS",
    MOCK_USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS,
)
def test_writes_limiter_respects_use_case_id():
    """
    Here we test that a use_case_id currently exceededing quota results in
    dropping all strings for subsequent calls to check_write_limits
    """
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.transactions.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 6}
            ],
            "sentry-metrics.writes-limiter.limits.transactions.per-org": [],
            "sentry-metrics.writes-limiter.limits.uc1.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 6}
            ],
            "sentry-metrics.writes-limiter.limits.uc1.per-org": [],
            "sentry-metrics.writes-limiter.limits.uc2.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 6}
            ],
            "sentry-metrics.writes-limiter.limits.uc2.per-org": [],
            "sentry-metrics.writes-limiter.limits.generic-metrics.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 6}
            ],
            "sentry-metrics.writes-limiter.limits.generic-metrics.per-org": [],
        },
    ):
        writes_limiter_perf = get_writes_limiter(PERFORMANCE_PG_NAMESPACE)

        use_case_keys = UseCaseKeyCollection(
            {
                UseCaseID.TRANSACTIONS: {
                    1: {"a", "b", "c"},
                    2: {"a", "b", "c"},
                },
                UseCaseID.SPANS: {
                    10: {"x", "y", "z"},
                    11: {"a", "b", "c"},
                },
                UseCaseID.ESCALATING_ISSUES: {
                    3: {"x", "y", "z"},
                    4: {"a", "b", "c"},
                },
            }
        )

        with writes_limiter_perf.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 0

        with writes_limiter_perf.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 18

        writes_limiter_rh = get_writes_limiter(RELEASE_HEALTH_PG_NAMESPACE)

        with writes_limiter_rh.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 18

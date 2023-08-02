from enum import Enum
from unittest.mock import patch

from sentry.sentry_metrics.configuration import (
    PERFORMANCE_PG_NAMESPACE,
    RELEASE_HEALTH_PG_NAMESPACE,
    UseCaseKey,
)
from sentry.sentry_metrics.indexer.base import UseCaseKeyCollection
from sentry.sentry_metrics.indexer.limiters.writes import WritesLimiter
from sentry.testutils.helpers.options import override_options

WRITES_LIMITERS = {
    RELEASE_HEALTH_PG_NAMESPACE: WritesLimiter(RELEASE_HEALTH_PG_NAMESPACE, **{}),
    PERFORMANCE_PG_NAMESPACE: WritesLimiter(PERFORMANCE_PG_NAMESPACE, **{}),
}


def get_writes_limiter(namespace: str):
    return WRITES_LIMITERS[namespace]


class MockUseCaseID(Enum):
    SESSIONS = "sessions"
    TRANSACTIONS = "transactions"
    USE_CASE_1 = "uc_1"
    USE_CASE_2 = "uc_2"
    USE_CASE_3 = "uc_3"


MOCK_METRIC_PATH_MAPPING = {
    MockUseCaseID.TRANSACTIONS: UseCaseKey.PERFORMANCE,
    MockUseCaseID.USE_CASE_1: UseCaseKey.PERFORMANCE,
    MockUseCaseID.USE_CASE_2: UseCaseKey.PERFORMANCE,
    MockUseCaseID.USE_CASE_3: UseCaseKey.PERFORMANCE,
}

MOCK_REVERSE_METRIC_PATH_MAPPING = {
    UseCaseKey.RELEASE_HEALTH: MockUseCaseID.SESSIONS,
    UseCaseKey.PERFORMANCE: MockUseCaseID.TRANSACTIONS,
}

MOCK_USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS = {
    MockUseCaseID.TRANSACTIONS: "sentry-metrics.writes-limiter.limits.transactions",
    MockUseCaseID.USE_CASE_1: "sentry-metrics.writes-limiter.limits.uc1",
    MockUseCaseID.USE_CASE_2: "sentry-metrics.writes-limiter.limits.uc2",
}


@patch("sentry.sentry_metrics.indexer.limiters.writes.UseCaseID", MockUseCaseID)
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
                MockUseCaseID.TRANSACTIONS: {
                    1: {"a", "b", "c"},
                    2: {"a", "b", "c"},
                },
                MockUseCaseID.USE_CASE_1: {
                    10: {"x", "y", "z"},
                    11: {"a", "b", "c"},
                },
                MockUseCaseID.USE_CASE_2: {
                    3: {"x", "y", "z"},
                    4: {"a", "b", "c"},
                },
                MockUseCaseID.USE_CASE_3: {
                    1: {"x", "y", "z"},
                    2: {"a", "b", "c"},
                },
            }
        )
        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert not state.dropped_strings
            assert state.accepted_keys.as_tuples() == use_case_keys.as_tuples()


@patch("sentry.sentry_metrics.indexer.limiters.writes.UseCaseID", MockUseCaseID)
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
                MockUseCaseID.TRANSACTIONS: {
                    1: {"a"},
                    2: {"b"},
                },
                MockUseCaseID.USE_CASE_1: {
                    3: {"c", "d"},
                    4: {"e", "f"},
                },
                MockUseCaseID.USE_CASE_2: {
                    5: {"g", "h", "i"},
                    6: {"j", "k", "l"},
                },
                MockUseCaseID.USE_CASE_3: {
                    7: {"m", "n", "o", "p"},
                    8: {"q", "r", "s", "t"},
                },
            }
        )

        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert not state.dropped_strings
            assert state.accepted_keys.as_tuples() == use_case_keys.as_tuples()


@patch("sentry.sentry_metrics.indexer.limiters.writes.UseCaseID", MockUseCaseID)
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
                MockUseCaseID.TRANSACTIONS: {
                    1: {"a"},
                    2: {"b"},
                },
                MockUseCaseID.USE_CASE_1: {
                    3: {"c", "d"},
                    4: {"e", "f"},
                },
                MockUseCaseID.USE_CASE_2: {
                    5: {"g", "h", "i"},
                    6: {"j", "k", "l"},
                },
                MockUseCaseID.USE_CASE_3: {
                    7: {"m", "n", "o", "p"},
                    8: {"q", "r", "s", "t"},
                },
            }
        )

        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 8
            assert sorted(ds.use_case_key_result.org_id for ds in state.dropped_strings) == [
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
            ]
            assert sorted(org_id for _, org_id, _ in state.accepted_keys.as_tuples()) == [
                3,
                4,
                5,
                5,
                6,
                6,
                7,
                7,
                7,
                8,
                8,
                8,
            ]


@patch("sentry.sentry_metrics.indexer.limiters.writes.UseCaseID", MockUseCaseID)
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
                MockUseCaseID.TRANSACTIONS: {
                    1: {"a"},
                    2: {"b"},
                },
                MockUseCaseID.USE_CASE_1: {
                    3: {"c", "d"},
                    4: {"e", "f"},
                },
                MockUseCaseID.USE_CASE_2: {
                    5: {"g", "h", "i"},
                    6: {"j", "k", "l"},
                },
                MockUseCaseID.USE_CASE_3: {
                    7: {"m", "n", "o", "p"},
                    8: {"q", "r", "s", "t"},
                },
            }
        )

        with writes_limiter.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 10


@patch("sentry.sentry_metrics.indexer.limiters.writes.UseCaseID", MockUseCaseID)
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
                MockUseCaseID.TRANSACTIONS: {
                    1: {"a", "b", "c"},
                    2: {"a", "b", "c"},
                },
                MockUseCaseID.USE_CASE_1: {
                    10: {"x", "y", "z"},
                    11: {"a", "b", "c"},
                },
                MockUseCaseID.USE_CASE_2: {
                    3: {"x", "y", "z"},
                    4: {"a", "b", "c"},
                },
                MockUseCaseID.USE_CASE_3: {
                    1: {"x", "y", "z"},
                    2: {"a", "b", "c"},
                },
            }
        )

        with writes_limiter_perf.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 0

        with writes_limiter_perf.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 24

        writes_limiter_rh = get_writes_limiter(RELEASE_HEALTH_PG_NAMESPACE)

        with writes_limiter_rh.check_write_limits(use_case_keys) as state:
            assert len(state.dropped_strings) == 24

import pytest
from snuba_sdk import Column, Function

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_tag_key, resolve_tag_value
from sentry.snuba.metrics.fields.snql import (
    abnormal_sessions,
    abnormal_users,
    addition,
    all_sessions,
    all_users,
    complement,
    count_web_vitals_snql_factory,
    crashed_sessions,
    crashed_users,
    division_float,
    errored_all_users,
    errored_preaggr_sessions,
    rate_snql_factory,
    session_duration_filters,
    subtraction,
    unhandled_sessions,
    unhandled_users,
    uniq_aggregation_on_metric,
)
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class DerivedMetricSnQLTestCase(TestCase):
    def setUp(self) -> None:
        self.org_id = 666
        self.metric_ids = [1, 2]
        indexer.bulk_record(
            {
                UseCaseID.SESSIONS: {
                    self.org_id: {
                        "abnormal",
                        "crashed",
                        "errored_preaggr",
                        "errored",
                        "exited",
                        "init",
                        "unhandled",
                        "session.status",
                    }
                }
            }
        )

    def test_counter_sum_aggregation_on_session_status(self) -> None:
        for status, func in [
            ("init", all_sessions),
            ("crashed", crashed_sessions),
            ("errored_preaggr", errored_preaggr_sessions),
            ("abnormal", abnormal_sessions),
            ("unhandled", unhandled_sessions),
        ]:
            assert func(self.org_id, self.metric_ids, alias=status) == Function(
                "sumIf",
                [
                    Column("value"),
                    Function(
                        "and",
                        [
                            Function(
                                "equals",
                                [
                                    Column(
                                        resolve_tag_key(
                                            UseCaseID.SESSIONS, self.org_id, "session.status"
                                        ),
                                    ),
                                    resolve_tag_value(UseCaseID.SESSIONS, self.org_id, status),
                                ],
                            ),
                            Function("in", [Column("metric_id"), list(self.metric_ids)]),
                        ],
                    ),
                ],
                status,
            )

    def test_set_uniq_aggregation_on_session_status(self) -> None:
        for status, func in [
            ("crashed", crashed_users),
            ("abnormal", abnormal_users),
            ("errored", errored_all_users),
            ("unhandled", unhandled_users),
        ]:
            assert func(self.org_id, self.metric_ids, alias=status) == Function(
                "uniqIf",
                [
                    Column("value"),
                    Function(
                        "and",
                        [
                            Function(
                                "equals",
                                [
                                    Column(
                                        resolve_tag_key(
                                            UseCaseID.SESSIONS, self.org_id, "session.status"
                                        )
                                    ),
                                    resolve_tag_value(UseCaseID.SESSIONS, self.org_id, status),
                                ],
                            ),
                            Function("in", [Column("metric_id"), list(self.metric_ids)]),
                        ],
                    ),
                ],
                status,
            )

    def test_set_uniq_aggregation_all_users(self) -> None:
        assert all_users(self.org_id, self.metric_ids, alias="foo") == Function(
            "uniqIf",
            [
                Column("value"),
                Function("in", [Column("metric_id"), list(self.metric_ids)]),
            ],
            alias="foo",
        )

    def test_set_sum_aggregation_for_errored_sessions(self) -> None:
        alias = "whatever"
        assert uniq_aggregation_on_metric(self.metric_ids, alias) == Function(
            "uniqIf",
            [
                Column("value"),
                Function(
                    "in",
                    [
                        Column("metric_id"),
                        list(self.metric_ids),
                    ],
                ),
            ],
            alias,
        )

    def test_complement_in_sql(self) -> None:
        alias = "foo.complement"
        assert complement(0.64, alias=alias) == Function("minus", [1, 0.64], alias)

    def test_addition_in_snql(self) -> None:
        alias = "session.crashed_and_abnormal_user"
        arg1_snql = crashed_users(self.org_id, self.metric_ids, alias="session.crashed_user")
        arg2_snql = abnormal_users(self.org_id, self.metric_ids, alias="session.abnormal_user")
        assert addition(
            arg1_snql,
            arg2_snql,
            alias=alias,
        ) == Function("plus", [arg1_snql, arg2_snql], alias=alias)

    def test_subtraction_in_snql(self) -> None:
        arg1_snql = all_users(self.org_id, self.metric_ids, alias="session.all_user")
        arg2_snql = errored_all_users(
            self.org_id, self.metric_ids, alias="session.errored_user_all"
        )

        assert subtraction(
            arg1_snql,
            arg2_snql,
            alias="session.healthy_user",
        ) == Function("minus", [arg1_snql, arg2_snql], alias="session.healthy_user")

    def test_division_in_snql(self) -> None:
        alias = "session.crash_rate"
        crashed = crashed_sessions(self.org_id, self.metric_ids, "session.crashed")
        all_sess = all_sessions(self.org_id, self.metric_ids, "session.all")

        assert division_float(crashed, all_sess, alias=alias) == Function(
            "divide",
            [crashed, all_sess],
            alias=alias,
        )

    def test_session_duration_filters(self) -> None:
        assert session_duration_filters(self.org_id) == [
            Function(
                "equals",
                (
                    Column(
                        resolve_tag_key(UseCaseID.SESSIONS, self.org_id, "session.status"),
                    ),
                    resolve_tag_value(UseCaseID.SESSIONS, self.org_id, "exited"),
                ),
            )
        ]

    def test_rate_snql(self) -> None:
        assert rate_snql_factory(
            aggregate_filter=Function(
                "equals",
                [Column("metric_id"), 5],
            ),
            numerator=3600,
            denominator=60,
            alias="rate_alias",
        ) == Function(
            "divide",
            [
                Function(
                    "countIf", [Column("value"), Function("equals", [Column("metric_id"), 5])]
                ),
                Function("divide", [3600, 60]),
            ],
            alias="rate_alias",
        )

        assert rate_snql_factory(
            aggregate_filter=Function(
                "equals",
                [Column("metric_id"), 5],
            ),
            numerator=3600,
            alias="rate_alias",
        ) == Function(
            "divide",
            [
                Function(
                    "countIf", [Column("value"), Function("equals", [Column("metric_id"), 5])]
                ),
                Function("divide", [3600, 1]),
            ],
            alias="rate_alias",
        )

    def test_count_web_vitals_snql(self) -> None:
        assert count_web_vitals_snql_factory(
            aggregate_filter=Function(
                "equals",
                [Column("metric_id"), 5],
            ),
            org_id=self.org_id,
            measurement_rating="good",
            alias="count_web_vitals_alias",
        ) == Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [Column("metric_id"), 5],
                        ),
                        Function(
                            "equals",
                            (
                                Column(
                                    resolve_tag_key(
                                        UseCaseID.TRANSACTIONS, self.org_id, "measurement_rating"
                                    )
                                ),
                                resolve_tag_value(UseCaseID.TRANSACTIONS, self.org_id, "good"),
                            ),
                        ),
                    ],
                ),
            ],
            alias="count_web_vitals_alias",
        )

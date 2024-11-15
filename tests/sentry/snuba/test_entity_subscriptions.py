from datetime import datetime
from unittest.mock import patch

import pytest
from snuba_sdk import And, Column, Condition, Entity, Function, Join, Op, Relationship

from sentry.exceptions import (
    IncompatibleMetricsQuery,
    InvalidQuerySubscription,
    UnsupportedQuerySubscription,
)
from sentry.models.group import GroupStatus
from sentry.search.events.builder.metrics import AlertMetricsQueryBuilder
from sentry.search.events.constants import METRICS_MAP
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve, resolve_tag_key, resolve_tag_value
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.entity_subscription import (
    EventsEntitySubscription,
    MetricsCountersEntitySubscription,
    MetricsSetsEntitySubscription,
    PerformanceMetricsEntitySubscription,
    PerformanceSpansEAPRpcEntitySubscription,
    PerformanceTransactionsEntitySubscription,
    get_entity_key_from_snuba_query,
    get_entity_subscription,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


@pytest.mark.snuba_ci
class EntitySubscriptionTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        for tag in [
            SessionMRI.RAW_SESSION.value,
            SessionMRI.RAW_USER.value,
            "session.status",
            "init",
            "crashed",
        ]:
            indexer.record(use_case_id=UseCaseID.SESSIONS, org_id=self.organization.id, string=tag)

    def test_get_entity_subscriptions_for_sessions_dataset_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with pytest.raises(UnsupportedQuerySubscription):
            get_entity_subscription(
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Metrics,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )

    def test_get_entity_subscriptions_for_sessions_dataset_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with pytest.raises(InvalidQuerySubscription):
            get_entity_subscription(
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Metrics,
                aggregate=aggregate,
                time_window=3600,
            )

    def test_build_query_builder_invalid_fields_raise_error(self) -> None:
        entities = [
            get_entity_subscription(
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Metrics,
                aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            ),
            get_entity_subscription(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                aggregate="count_unique(user)",
                time_window=3600,
            ),
        ]
        for entity in entities:
            with pytest.raises(Exception):
                entity.build_query_builder("timestamp:-24h", [self.project.id], None)

    def test_get_entity_subscription_for_metrics_dataset_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with pytest.raises(UnsupportedQuerySubscription):
            get_entity_subscription(
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Metrics,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )

    def test_get_entity_subscription_for_metrics_dataset_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with pytest.raises(InvalidQuerySubscription):
            get_entity_subscription(
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Metrics,
                aggregate=aggregate,
                time_window=3600,
            )

    def test_get_entity_subscription_for_metrics_dataset_for_users_with_metrics_layer(self) -> None:
        with Feature("organizations:custom-metrics"):
            org_id = self.organization.id
            use_case_id = UseCaseID.SESSIONS

            aggregate = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
            entity_subscription = get_entity_subscription(
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Metrics,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )
            assert isinstance(entity_subscription, MetricsSetsEntitySubscription)
            assert entity_subscription.aggregate == aggregate
            assert entity_subscription.get_entity_extra_params() == {
                "organization": self.organization.id,
                "granularity": 10,
            }
            assert entity_subscription.dataset == Dataset.Metrics
            session_status = resolve_tag_key(use_case_id, org_id, "session.status")
            session_status_crashed = resolve_tag_value(use_case_id, org_id, "crashed")
            metric_id = resolve(use_case_id, org_id, entity_subscription.metric_key.value)
            snql_query = entity_subscription.build_query_builder(
                "", [self.project.id], None, {"organization_id": self.organization.id}
            ).get_snql_query()
            key = lambda func: func.alias
            assert sorted(snql_query.query.select, key=key) == sorted(
                [
                    Function(
                        "uniqIf",
                        parameters=[
                            Column("value"),
                            Function("equals", [Column("metric_id"), metric_id]),
                        ],
                        alias="count",
                    ),
                    Function(
                        "uniqIf",
                        parameters=[
                            Column("value"),
                            Function(
                                "and",
                                parameters=[
                                    Function("equals", [Column("metric_id"), metric_id]),
                                    Function(
                                        "equals", [Column(session_status), session_status_crashed]
                                    ),
                                ],
                            ),
                        ],
                        alias="crashed",
                    ),
                ],
                key=key,
            )
            assert snql_query.query.where == [
                Condition(Column("org_id"), Op.EQ, self.organization.id),
                Condition(Column("project_id"), Op.IN, [self.project.id]),
                Condition(Column("metric_id"), Op.IN, [metric_id]),
            ]

    # This test has been kept in order to validate whether the old queries through metrics are supported, in the future
    # this should be removed.
    def test_get_entity_subscription_for_metrics_dataset_for_sessions(self) -> None:
        org_id = self.organization.id
        use_case_id = UseCaseID.SESSIONS
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        entity_subscription = get_entity_subscription(
            query_type=SnubaQuery.Type.CRASH_RATE,
            dataset=Dataset.Metrics,
            aggregate=aggregate,
            time_window=3600,
            extra_fields={"org_id": self.organization.id},
        )
        assert isinstance(entity_subscription, MetricsCountersEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {
            "organization": self.organization.id,
            "granularity": 10,
        }
        assert entity_subscription.dataset == Dataset.Metrics
        session_status = resolve_tag_key(use_case_id, org_id, "session.status")
        session_status_crashed = resolve_tag_value(use_case_id, org_id, "crashed")
        session_status_init = resolve_tag_value(use_case_id, org_id, "init")
        snql_query = entity_subscription.build_query_builder(
            "", [self.project.id], None, {"organization_id": self.organization.id}
        ).get_snql_query()
        key = lambda func: func.alias
        assert sorted(snql_query.query.select, key=key) == sorted(
            [
                Function(
                    function="sumIf",
                    parameters=[
                        Column("value"),
                        Function(
                            "equals", parameters=[Column(session_status), session_status_init]
                        ),
                    ],
                    alias="count",
                ),
                Function(
                    "sumIf",
                    parameters=[
                        Column(name="value"),
                        Function(
                            "equals", parameters=[Column(session_status), session_status_crashed]
                        ),
                    ],
                    alias="crashed",
                ),
            ],
            key=key,
        )
        assert snql_query.query.where == [
            Condition(Column("project_id"), Op.IN, [self.project.id]),
            Condition(Column("org_id"), Op.EQ, self.organization.id),
            Condition(
                Column("metric_id"),
                Op.EQ,
                resolve(use_case_id, self.organization.id, entity_subscription.metric_key.value),
            ),
            Condition(
                Column(session_status),
                Op.IN,
                [session_status_crashed, session_status_init],
            ),
        ]

    def test_get_entity_subscription_for_metrics_dataset_for_sessions_with_metrics_layer(
        self,
    ) -> None:
        with Feature("organizations:custom-metrics"):
            org_id = self.organization.id
            use_case_id = UseCaseID.SESSIONS
            aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
            entity_subscription = get_entity_subscription(
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Metrics,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )
            assert isinstance(entity_subscription, MetricsCountersEntitySubscription)
            assert entity_subscription.aggregate == aggregate
            assert entity_subscription.get_entity_extra_params() == {
                "organization": self.organization.id,
                "granularity": 10,
            }
            assert entity_subscription.dataset == Dataset.Metrics
            session_status = resolve_tag_key(use_case_id, org_id, "session.status")
            session_status_crashed = resolve_tag_value(use_case_id, org_id, "crashed")
            session_status_init = resolve_tag_value(use_case_id, org_id, "init")
            metric_id = resolve(use_case_id, org_id, entity_subscription.metric_key.value)
            snql_query = entity_subscription.build_query_builder(
                "", [self.project.id], None, {"organization_id": self.organization.id}
            ).get_snql_query()
            key = lambda func: func.alias
            assert sorted(snql_query.query.select, key=key) == sorted(
                [
                    Function(
                        "sumIf",
                        parameters=[
                            Column("value"),
                            Function(
                                "and",
                                parameters=[
                                    Function("equals", [Column("metric_id"), metric_id]),
                                    Function(
                                        "equals", [Column(session_status), session_status_init]
                                    ),
                                ],
                            ),
                        ],
                        alias="count",
                    ),
                    Function(
                        "sumIf",
                        parameters=[
                            Column("value"),
                            Function(
                                "and",
                                parameters=[
                                    Function("equals", [Column("metric_id"), metric_id]),
                                    Function(
                                        "equals", [Column(session_status), session_status_crashed]
                                    ),
                                ],
                            ),
                        ],
                        alias="crashed",
                    ),
                ],
                key=key,
            )
            assert snql_query.query.where == [
                Condition(Column("org_id"), Op.EQ, self.organization.id),
                Condition(Column("project_id"), Op.IN, [self.project.id]),
                Condition(
                    Column(session_status),
                    Op.IN,
                    [session_status_crashed, session_status_init],
                ),
                Condition(Column("metric_id"), Op.IN, [metric_id]),
            ]

    def test_get_entity_subscription_for_performance_transactions_dataset(self) -> None:
        aggregate = "percentile(transaction.duration,.95)"
        entity_subscription = get_entity_subscription(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            aggregate=aggregate,
            time_window=3600,
        )
        assert isinstance(entity_subscription, PerformanceTransactionsEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {}
        assert entity_subscription.dataset == Dataset.Transactions
        snql_query = entity_subscription.build_query_builder(
            "", [self.project.id], None
        ).get_snql_query()
        assert snql_query.query.select == [
            Function(
                "quantile(0.95)",
                parameters=[Column(name="duration")],
                alias="percentile_transaction_duration__95",
            )
        ]
        assert snql_query.query.where == [Condition(Column("project_id"), Op.IN, [self.project.id])]

    # This test has been kept in order to validate whether the old queries through metrics are supported, in the future
    # this should be removed.
    def test_get_entity_subscription_for_performance_metrics_dataset(self) -> None:
        aggregate = "percentile(transaction.duration,.95)"
        entity_subscription = get_entity_subscription(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            aggregate=aggregate,
            time_window=3600,
            extra_fields={"org_id": self.organization.id},
        )
        assert isinstance(entity_subscription, PerformanceMetricsEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {
            "organization": self.organization.id,
            "granularity": 60,
        }
        assert entity_subscription.dataset == Dataset.PerformanceMetrics
        snql_query = entity_subscription.build_query_builder(
            "",
            [self.project.id],
            None,
            {
                "organization_id": self.organization.id,
            },
        ).get_snql_query()

        metric_id = resolve(
            UseCaseID.TRANSACTIONS, self.organization.id, METRICS_MAP["transaction.duration"]
        )

        assert snql_query.query.select == [
            Function(
                function="arrayElement",
                parameters=[
                    Function(
                        function="quantilesIf(0.95)",
                        parameters=[
                            Column(name="value"),
                            Function(
                                function="equals",
                                parameters=[Column(name="metric_id"), metric_id],
                            ),
                        ],
                    ),
                    1,
                ],
                alias="percentile_transaction_duration__95",
            )
        ]
        assert snql_query.query.where == [
            Condition(Column("project_id"), Op.IN, [self.project.id]),
            Condition(Column("org_id"), Op.EQ, self.organization.id),
            Condition(Column("metric_id"), Op.IN, [metric_id]),
        ]

    def test_get_entity_subscription_for_performance_metrics_dataset_with_metrics_layer(
        self,
    ) -> None:
        with Feature("organizations:custom-metrics"):
            aggregate = "percentile(transaction.duration,.95)"
            entity_subscription = get_entity_subscription(
                query_type=SnubaQuery.Type.PERFORMANCE,
                dataset=Dataset.PerformanceMetrics,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )
            assert isinstance(entity_subscription, PerformanceMetricsEntitySubscription)
            assert entity_subscription.aggregate == aggregate
            assert entity_subscription.get_entity_extra_params() == {
                "organization": self.organization.id,
                "granularity": 60,
            }
            assert entity_subscription.dataset == Dataset.PerformanceMetrics
            snql_query = entity_subscription.build_query_builder(
                "",
                [self.project.id],
                None,
                {
                    "organization_id": self.organization.id,
                },
            ).get_snql_query()

            metric_id = resolve(
                UseCaseID.TRANSACTIONS, self.organization.id, METRICS_MAP["transaction.duration"]
            )

            assert snql_query.query.select == [
                Function(
                    "arrayElement",
                    parameters=[
                        Function(
                            "quantilesIf(0.95)",
                            parameters=[
                                Column("value"),
                                Function(
                                    "equals",
                                    parameters=[Column("metric_id"), metric_id],
                                ),
                            ],
                        ),
                        1,
                    ],
                    alias="percentile_transaction_duration__95",
                )
            ]
            assert snql_query.query.where == [
                Condition(Column("org_id"), Op.EQ, self.organization.id),
                Condition(Column("project_id"), Op.IN, [self.project.id]),
                Condition(Column("metric_id"), Op.IN, [metric_id]),
            ]

    def test_get_entity_subscription_for_performance_metrics_dataset_with_custom_metric_and_metrics_layer(
        self,
    ) -> None:
        mri = "d:custom/sentry.process_profile.track_outcome@second"
        indexer.record(use_case_id=UseCaseID.CUSTOM, org_id=self.organization.id, string=mri)

        with Feature("organizations:custom-metrics"):
            aggregate = f"max({mri})"
            entity_subscription = get_entity_subscription(
                query_type=SnubaQuery.Type.PERFORMANCE,
                dataset=Dataset.PerformanceMetrics,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )
            assert isinstance(entity_subscription, PerformanceMetricsEntitySubscription)
            assert entity_subscription.aggregate == aggregate
            assert entity_subscription.get_entity_extra_params() == {
                "organization": self.organization.id,
                "granularity": 60,
            }
            assert entity_subscription.dataset == Dataset.PerformanceMetrics
            snql_query = entity_subscription.build_query_builder(
                "",
                [self.project.id],
                None,
                {
                    "organization_id": self.organization.id,
                },
            ).get_snql_query()

            metric_id = resolve(UseCaseID.CUSTOM, self.organization.id, mri)

            assert snql_query.query.select == [
                Function(
                    "maxIf",
                    parameters=[
                        Column(
                            "value",
                        ),
                        Function(
                            "equals",
                            parameters=[
                                Column("metric_id"),
                                10000,
                            ],
                            alias=None,
                        ),
                    ],
                    alias="max_d_custom_sentry_process_profile_track_outcome_second",
                )
            ]
            assert snql_query.query.where == [
                Condition(Column("org_id"), Op.EQ, self.organization.id),
                Condition(Column("project_id"), Op.IN, [self.project.id]),
                Condition(Column("metric_id"), Op.IN, [metric_id]),
            ]

    def test_get_entity_subscription_with_multiple_entities_with_metrics_layer(
        self,
    ) -> None:
        with Feature("organizations:custom-metrics"):
            aggregate = "percentile(transaction.duration,.95)"
            entity_subscription = get_entity_subscription(
                query_type=SnubaQuery.Type.PERFORMANCE,
                dataset=Dataset.PerformanceMetrics,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )
            with patch(
                "sentry.snuba.entity_subscription.PerformanceMetricsEntitySubscription.get_snql_aggregations",
                # We have two aggregates on the metrics dataset but one with generic_metrics_sets and the other with
                # generic_metrics_distributions.
                return_value=[aggregate, "count_unique(user)"],
            ):
                with pytest.raises(IncompatibleMetricsQuery):
                    entity_subscription.build_query_builder(
                        "",
                        [self.project.id],
                        None,
                        {"organization_id": self.organization.id},
                    ).get_snql_query()

    def test_get_entity_subscription_for_events_dataset(self) -> None:
        aggregate = "count_unique(user)"
        entity_subscription = get_entity_subscription(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            aggregate=aggregate,
            time_window=3600,
        )
        assert isinstance(entity_subscription, EventsEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {}
        assert entity_subscription.dataset == Dataset.Events

        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)

        snql_query = entity_subscription.build_query_builder(
            "release:latest", [self.project.id], None
        ).get_snql_query()
        assert snql_query.query.select == [
            Function(
                function="uniq",
                parameters=[Column(name="tags[sentry:user]", entity=entity)],
                alias="count_unique_user",
            )
        ]
        assert snql_query.query.where == [
            And(
                [
                    Condition(Column("type", entity=entity), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull",
                            parameters=[Column(name="tags[sentry:release]", entity=entity), ""],
                        ),
                        Op.IN,
                        [""],
                    ),
                ]
            ),
            Condition(Column("project_id", entity=entity), Op.IN, [self.project.id]),
        ]

    def test_get_entity_subscription_for_events_dataset_with_join(self) -> None:
        aggregate = "count_unique(user)"
        entity_subscription = get_entity_subscription(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            aggregate=aggregate,
            time_window=3600,
        )
        assert isinstance(entity_subscription, EventsEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {}
        assert entity_subscription.dataset == Dataset.Events

        e_entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)
        g_entity = Entity("group_attributes", alias="ga")

        snql_query = entity_subscription.build_query_builder(
            "status:unresolved", [self.project.id], None
        ).get_snql_query()
        assert snql_query.query.match == Join([Relationship(e_entity, "attributes", g_entity)])
        assert snql_query.query.select == [
            Function(
                function="uniq",
                parameters=[Column(name="tags[sentry:user]", entity=e_entity)],
                alias="count_unique_user",
            )
        ]
        assert snql_query.query.where == [
            And(
                [
                    Condition(Column("type", entity=e_entity), Op.EQ, "error"),
                    Condition(
                        Column("group_status", entity=g_entity), Op.IN, [GroupStatus.UNRESOLVED]
                    ),
                ]
            ),
            Condition(Column("project_id", entity=e_entity), Op.IN, [self.project.id]),
            Condition(Column("project_id", entity=g_entity), Op.IN, [self.project.id]),
        ]

    def test_get_entity_subscription_for_insights_queries(self) -> None:
        indexer.record(use_case_id=UseCaseID.SPANS, org_id=self.organization.id, string="cache.hit")
        with Feature("organizations:custom-metrics"):
            cases = [
                ("count()", "", True),
                ("avg(transaction.duration)", "", True),
                ("count()", "span.module:http", False),
                ("count()", "span.category:http", False),
                ("count()", "span.op:http.client", False),
                ("count()", "span.description:abc", False),
                ("performance_score(measurements.score.lcp)", "", False),
                ("cache_miss_rate()", "", False),
                ("http_response_rate(3)", "", False),
                ("avg(span.self_time)", "", False),
                ("spm()", "", False),
            ]
            for aggregate, query, use_metrics_layer in cases:
                entity_subscription = get_entity_subscription(
                    query_type=SnubaQuery.Type.PERFORMANCE,
                    dataset=Dataset.PerformanceMetrics,
                    aggregate=aggregate,
                    time_window=3600,
                    extra_fields={"org_id": self.organization.id},
                )
                builder = entity_subscription.build_query_builder(
                    query,
                    [self.project.id],
                    None,
                    {
                        "organization_id": self.organization.id,
                        "start": datetime(2024, 1, 1),
                        "end": datetime(2024, 1, 2),
                    },
                )
                assert isinstance(builder, AlertMetricsQueryBuilder)
                assert builder.use_metrics_layer is use_metrics_layer

    def test_get_entity_subscription_for_eap_rpc_query(self) -> None:
        aggregate = "count(span.duration)"
        query = "span.op:http.client"
        entity_subscription = get_entity_subscription(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.EventsAnalyticsPlatform,
            aggregate=aggregate,
            time_window=3600,
            extra_fields={"org_id": self.organization.id},
        )
        assert isinstance(entity_subscription, PerformanceSpansEAPRpcEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {}
        assert entity_subscription.dataset == Dataset.EventsAnalyticsPlatform

        rpc_timeseries_request = entity_subscription.build_rpc_request(
            query, [self.project.id], None
        )

        assert rpc_timeseries_request.granularity_secs == 3600
        assert rpc_timeseries_request.filter.comparison_filter.value.val_str == "http.client"
        assert rpc_timeseries_request.aggregations[0].label == "count(span.duration)"


class GetEntitySubscriptionFromSnubaQueryTest(TestCase):
    def test(self):
        cases = [
            (EventsEntitySubscription, SnubaQuery.Type.ERROR, Dataset.Events, "count()"),
            (
                PerformanceTransactionsEntitySubscription,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Transactions,
                "count()",
            ),
            (
                PerformanceMetricsEntitySubscription,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Metrics,
                "count()",
            ),
            (
                PerformanceMetricsEntitySubscription,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "count()",
            ),
            (
                PerformanceMetricsEntitySubscription,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Metrics,
                "count_unique(user)",
            ),
            (
                PerformanceMetricsEntitySubscription,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "count_unique(user)",
            ),
            (
                PerformanceMetricsEntitySubscription,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "max(d:custom/sentry.process_profile.track_outcome@second)",
            ),
            (
                MetricsCountersEntitySubscription,
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            ),
            (
                MetricsSetsEntitySubscription,
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            ),
        ]

        for expected_entity_subscription, query_type, dataset, aggregate in cases:
            snuba_query = SnubaQuery.objects.create(
                time_window=60,
                type=query_type.value,
                dataset=dataset.value,
                aggregate=aggregate,
                resolution=5,
            )
            assert isinstance(
                get_entity_subscription_from_snuba_query(snuba_query, self.organization.id),
                expected_entity_subscription,
            )


class GetEntityKeyFromSnubaQueryTest(TestCase):
    def test(self):
        cases = [
            (EntityKey.Events, SnubaQuery.Type.ERROR, Dataset.Events, "count()", "", True, True),
            (
                EntityKey.Transactions,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Transactions,
                "count()",
                "",
                True,
                True,
            ),
            (
                EntityKey.GenericMetricsDistributions,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Metrics,
                "count()",
                "",
                True,
                True,
            ),
            (
                EntityKey.GenericMetricsSets,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.Metrics,
                "count_unique(user)",
                "",
                True,
                True,
            ),
            (
                EntityKey.GenericMetricsDistributions,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "count()",
                "",
                True,
                True,
            ),
            (
                EntityKey.GenericMetricsSets,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "count_unique(user)",
                "",
                True,
                True,
            ),
            (
                EntityKey.GenericMetricsCounters,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "sum(c:custom/sentry.process_profile.track_outcome@second)",
                "",
                # Custom metrics are not supported when the metrics layer integration with mqb is disabled.
                False,
                True,
            ),
            (
                EntityKey.GenericMetricsDistributions,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "max(d:custom/sentry.process_profile.track_outcome@second)",
                "",
                # Custom metrics are not supported when the metrics layer integration with mqb is disabled.
                False,
                True,
            ),
            (
                EntityKey.GenericMetricsSets,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "count_unique(s:custom/sentry.process_profile.track_outcome@second)",
                "",
                # Custom metrics are not supported when the metrics layer integration with mqb is disabled.
                False,
                True,
            ),
            (
                EntityKey.GenericMetricsGauges,
                SnubaQuery.Type.PERFORMANCE,
                Dataset.PerformanceMetrics,
                "last(g:custom/sentry.process_profile.track_outcome@second)",
                "",
                # Custom metrics are not supported when the metrics layer integration with mqb is disabled.
                False,
                True,
            ),
            (
                EntityKey.MetricsCounters,
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
                "",
                True,
                True,
            ),
            (
                EntityKey.MetricsSets,
                SnubaQuery.Type.CRASH_RATE,
                Dataset.Metrics,
                "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
                "",
                True,
                True,
            ),
        ]

        for (
            expected_entity_key,
            query_type,
            dataset,
            aggregate,
            query,
            supported_with_no_metrics_layer,
            supported_with_metrics_layer,
        ) in cases:
            snuba_query = SnubaQuery.objects.create(
                time_window=60,
                type=query_type.value,
                dataset=dataset.value,
                aggregate=aggregate,
                query=query,
                resolution=5,
            )

            if supported_with_no_metrics_layer:
                assert expected_entity_key == get_entity_key_from_snuba_query(
                    snuba_query, self.organization.id, self.project.id
                )

            if supported_with_metrics_layer:
                with Feature("organizations:custom-metrics"):
                    assert expected_entity_key == get_entity_key_from_snuba_query(
                        snuba_query, self.organization.id, self.project.id
                    )

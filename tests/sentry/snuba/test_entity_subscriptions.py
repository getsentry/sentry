import pytest
from snuba_sdk import And, Column, Condition, Function, Op

from sentry.exceptions import (
    InvalidQuerySubscription,
    InvalidSearchQuery,
    UnsupportedQuerySubscription,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.utils import resolve, resolve_tag_key
from sentry.snuba.dataset import EntityKey
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    EventsEntitySubscription,
    MetricsCountersEntitySubscription,
    MetricsSetsEntitySubscription,
    SessionsEntitySubscription,
    TransactionsEntitySubscription,
    get_entity_subscription_for_dataset,
)
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.models import QueryDatasets
from sentry.testutils import TestCase


class EntitySubscriptionTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        for tag in [
            SessionMRI.SESSION.value,
            SessionMRI.USER.value,
            "session.status",
            "init",
            "crashed",
        ]:
            indexer.record(
                use_case_id=UseCaseKey.RELEASE_HEALTH, org_id=self.organization.id, string=tag
            )

    def test_get_entity_subscriptions_for_sessions_dataset_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with pytest.raises(UnsupportedQuerySubscription):
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.SESSIONS,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )

    def test_get_entity_subscriptions_for_sessions_dataset_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with pytest.raises(InvalidQuerySubscription):
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.SESSIONS, aggregate=aggregate, time_window=3600
            )

    def test_build_query_builder_invalid_fields_raise_error(self) -> None:
        entities = [
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.SESSIONS,
                aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            ),
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.EVENTS,
                aggregate="count_unique(user)",
                time_window=3600,
            ),
        ]
        for entity in entities:
            with pytest.raises(InvalidSearchQuery, match="Invalid key for this search: timestamp"):
                entity.build_query_builder("timestamp:-24h", [self.project.id], None)

    def test_get_entity_subscriptions_for_sessions_dataset(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.SESSIONS,
            aggregate=aggregate,
            time_window=3600,
            extra_fields={"org_id": self.organization.id},
        )
        assert isinstance(entity_subscription, SessionsEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {
            "organization": self.organization.id
        }
        assert entity_subscription.entity_key == EntityKey.Sessions
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.Sessions]
        assert entity_subscription.dataset == QueryDatasets.SESSIONS
        snql_query = entity_subscription.build_query_builder(
            "", [self.project.id], None
        ).get_snql_query()
        snql_query.query.select.sort(key=lambda q: q.function)
        assert snql_query.query.select == [
            Function(
                function="identity", parameters=[Column(name="sessions")], alias="_total_count"
            ),
            Function(
                function="if",
                parameters=[
                    Function(function="greater", parameters=[Column(name="sessions"), 0]),
                    Function(
                        function="divide",
                        parameters=[Column(name="sessions_crashed"), Column(name="sessions")],
                    ),
                    None,
                ],
                alias="_crash_rate_alert_aggregate",
            ),
        ]
        assert snql_query.query.where == [
            Condition(Column(name="project_id"), Op.IN, [self.project.id]),
            Condition(Column(name="org_id"), Op.EQ, None),
        ]

    def test_get_entity_subscription_for_metrics_dataset_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with pytest.raises(UnsupportedQuerySubscription):
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.METRICS,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )

    def test_get_entity_subscription_for_metrics_dataset_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with pytest.raises(InvalidQuerySubscription):
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.METRICS, aggregate=aggregate, time_window=3600
            )

    def test_get_entity_subscription_for_metrics_dataset_for_users(self) -> None:
        org_id = self.organization.id

        aggregate = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
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
        assert entity_subscription.entity_key == EntityKey.MetricsSets
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.MetricsSets]
        assert entity_subscription.dataset == QueryDatasets.METRICS
        session_status = resolve_tag_key(org_id, "session.status")
        session_status_crashed = resolve(org_id, "crashed")
        snql_query = entity_subscription.build_query_builder(
            "", [self.project.id], None, {"organization_id": self.organization.id}
        ).get_snql_query()
        key = lambda func: func.alias
        assert sorted(snql_query.query.select, key=key) == sorted(
            [
                Function("uniq", parameters=[Column("value")], alias="count"),
                Function(
                    "uniqIf",
                    parameters=[
                        Column(name="value"),
                        Function(
                            function="equals",
                            parameters=[
                                Column(session_status),
                                session_status_crashed,
                            ],
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
                resolve(self.organization.id, entity_subscription.metric_key.value),
            ),
        ]

    def test_get_entity_subscription_for_metrics_dataset_for_sessions(self) -> None:
        org_id = self.organization.id
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.METRICS,
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
        assert entity_subscription.entity_key == EntityKey.MetricsCounters
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.MetricsCounters]
        assert entity_subscription.dataset == QueryDatasets.METRICS
        session_status = resolve_tag_key(org_id, "session.status")
        session_status_crashed = resolve(org_id, "crashed")
        session_status_init = resolve(org_id, "init")
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
                resolve(self.organization.id, entity_subscription.metric_key.value),
            ),
            Condition(
                Column(session_status),
                Op.IN,
                [session_status_crashed, session_status_init],
            ),
        ]

    def test_get_entity_subscription_for_transactions_dataset(self) -> None:
        aggregate = "percentile(transaction.duration,.95)"
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.TRANSACTIONS, aggregate=aggregate, time_window=3600
        )
        assert isinstance(entity_subscription, TransactionsEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {}
        assert entity_subscription.entity_key == EntityKey.Transactions
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.Transactions]
        assert entity_subscription.dataset == QueryDatasets.TRANSACTIONS
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

    def test_get_entity_subscription_for_events_dataset(self) -> None:
        aggregate = "count_unique(user)"
        entity_subscription = get_entity_subscription_for_dataset(
            dataset=QueryDatasets.EVENTS, aggregate=aggregate, time_window=3600
        )
        assert isinstance(entity_subscription, EventsEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        assert entity_subscription.get_entity_extra_params() == {}
        assert entity_subscription.entity_key == EntityKey.Events
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.Events]
        assert entity_subscription.dataset == QueryDatasets.EVENTS

        snql_query = entity_subscription.build_query_builder(
            "release:latest", [self.project.id], None
        ).get_snql_query()
        assert snql_query.query.select == [
            Function(
                function="uniq",
                parameters=[Column(name="tags[sentry:user]")],
                alias="count_unique_user",
            )
        ]
        assert snql_query.query.where == [
            And(
                [
                    Condition(Column("type"), Op.EQ, "error"),
                    Condition(
                        Function(
                            function="ifNull", parameters=[Column(name="tags[sentry:release]"), ""]
                        ),
                        Op.IN,
                        [],
                    ),
                ]
            ),
            Condition(Column("project_id"), Op.IN, [self.project.id]),
        ]

from sentry.exceptions import InvalidQuerySubscription, UnsupportedQuerySubscription
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.utils import resolve, resolve_many_weak, resolve_tag_key
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
            indexer.record(self.organization.id, tag)

    def test_get_entity_subscriptions_for_sessions_dataset_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with self.assertRaises(UnsupportedQuerySubscription):
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.SESSIONS,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )

    def test_get_entity_subscriptions_for_sessions_dataset_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with self.assertRaises(InvalidQuerySubscription):
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.SESSIONS, aggregate=aggregate, time_window=3600
            )

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
        snuba_filter = entity_subscription.build_snuba_filter("", None, None)
        assert snuba_filter
        assert snuba_filter.aggregations == [
            [
                "if(greater(sessions,0),divide(sessions_crashed,sessions),null)",
                None,
                "_crash_rate_alert_aggregate",
            ],
            ["identity", "sessions", "_total_count"],
        ]

    def test_get_entity_subscription_for_metrics_dataset_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with self.assertRaises(UnsupportedQuerySubscription):
            get_entity_subscription_for_dataset(
                dataset=QueryDatasets.METRICS,
                aggregate=aggregate,
                time_window=3600,
                extra_fields={"org_id": self.organization.id},
            )

    def test_get_entity_subscription_for_metrics_dataset_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with self.assertRaises(InvalidQuerySubscription):
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
        groupby = [resolve_tag_key(org_id, "session.status")]
        assert entity_subscription.get_entity_extra_params() == {
            "organization": self.organization.id,
            "groupby": groupby,
            "granularity": 10,
        }
        assert entity_subscription.entity_key == EntityKey.MetricsSets
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.MetricsSets]
        assert entity_subscription.dataset == QueryDatasets.METRICS
        session_status = resolve_tag_key(org_id, "session.status")
        session_status_tag_values = resolve_many_weak(org_id, ["crashed", "init"])
        snuba_filter = entity_subscription.build_snuba_filter("", None, None)
        assert snuba_filter
        assert snuba_filter.aggregations == [["uniq(value)", None, "value"]]
        assert snuba_filter.conditions == [
            ["metric_id", "=", resolve(org_id, SessionMRI.USER.value)],
            [session_status, "IN", session_status_tag_values],
        ]
        assert snuba_filter.groupby == groupby
        assert snuba_filter.rollup == entity_subscription.get_granularity()

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
        groupby = [resolve_tag_key(org_id, "session.status")]
        assert entity_subscription.get_entity_extra_params() == {
            "organization": self.organization.id,
            "groupby": groupby,
            "granularity": 10,
        }
        assert entity_subscription.entity_key == EntityKey.MetricsCounters
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.MetricsCounters]
        assert entity_subscription.dataset == QueryDatasets.METRICS
        session_status = resolve_tag_key(org_id, "session.status")
        session_status_tag_values = resolve_many_weak(org_id, ["crashed", "init"])
        snuba_filter = entity_subscription.build_snuba_filter("", None, None)
        assert snuba_filter
        assert snuba_filter.aggregations == [["sum(value)", None, "value"]]
        assert snuba_filter.conditions == [
            ["metric_id", "=", resolve(org_id, SessionMRI.SESSION.value)],
            [session_status, "IN", session_status_tag_values],
        ]
        assert snuba_filter.groupby == groupby
        assert snuba_filter.rollup == entity_subscription.get_granularity()

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
        snuba_filter = entity_subscription.build_snuba_filter("", None, None)
        assert snuba_filter
        assert snuba_filter.aggregations == [
            ["quantile(0.95)", "duration", "percentile_transaction_duration__95"]
        ]

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
        snuba_filter = entity_subscription.build_snuba_filter("release:latest", None, None)
        assert snuba_filter
        assert snuba_filter.conditions == [
            ["type", "=", "error"],
            ["tags[sentry:release]", "=", "latest"],
        ]
        assert snuba_filter.aggregations == [["uniq", "tags[sentry:user]", "count_unique_user"]]

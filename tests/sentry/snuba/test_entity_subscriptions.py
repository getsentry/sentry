from sentry.exceptions import InvalidQuerySubscription, UnsupportedQuerySubscription
from sentry.release_health.metrics import get_tag_values_list, metric_id, tag_key
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.sessions import SessionMetricKey
from sentry.snuba.dataset import EntityKey
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    EventsEntitySubscription,
    MetricsCountersEntitySubscription,
    SessionsEntitySubscription,
    TransactionsEntitySubscription,
    map_aggregate_to_entity_subscription,
)
from sentry.snuba.models import QueryDatasets
from sentry.testutils import TestCase


class EntitySubscriptionTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        for tag in [SessionMetricKey.SESSION.value, "session.status", "init", "crashed"]:
            indexer.record(tag)

    def test_map_aggregate_to_sessions_entity_subscription_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with self.assertRaises(UnsupportedQuerySubscription):
            map_aggregate_to_entity_subscription(
                dataset=QueryDatasets.SESSIONS,
                aggregate=aggregate,
                extra_fields={"org_id": self.organization.id},
            )

    def test_map_aggregate_to_sessions_entity_subscription_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with self.assertRaises(InvalidQuerySubscription):
            map_aggregate_to_entity_subscription(
                dataset=QueryDatasets.SESSIONS, aggregate=aggregate
            )

    def test_map_aggregate_to_sessions_entity_subscription(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        entity_subscription = map_aggregate_to_entity_subscription(
            dataset=QueryDatasets.SESSIONS,
            aggregate=aggregate,
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

    def test_map_aggregate_to_metrics_entity_subscription_non_supported_aggregate(self) -> None:
        aggregate = "count(sessions)"
        with self.assertRaises(UnsupportedQuerySubscription):
            map_aggregate_to_entity_subscription(
                dataset=QueryDatasets.METRICS,
                aggregate=aggregate,
                extra_fields={"org_id": self.organization.id},
            )

    def test_map_aggregate_to_metrics_entity_subscription_missing_organization(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        with self.assertRaises(InvalidQuerySubscription):
            map_aggregate_to_entity_subscription(dataset=QueryDatasets.METRICS, aggregate=aggregate)

    def test_map_aggregate_to_metrics_entity_subscription_unsupported_crash_free_users(
        self,
    ) -> None:
        aggregate = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
        with self.assertRaises(UnsupportedQuerySubscription):
            map_aggregate_to_entity_subscription(
                dataset=QueryDatasets.METRICS,
                aggregate=aggregate,
                extra_fields={"org_id": self.organization.id},
            )

    def test_map_aggregate_to_metrics_entity_subscription(self) -> None:
        aggregate = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        entity_subscription = map_aggregate_to_entity_subscription(
            dataset=QueryDatasets.METRICS,
            aggregate=aggregate,
            extra_fields={"org_id": self.organization.id},
        )
        assert isinstance(entity_subscription, MetricsCountersEntitySubscription)
        assert entity_subscription.aggregate == aggregate
        org_id = self.organization.id
        groupby = [tag_key(org_id, "session.status")]
        assert entity_subscription.get_entity_extra_params() == {
            "organization": self.organization.id,
            "groupby": groupby,
        }
        assert entity_subscription.entity_key == EntityKey.MetricsCounters
        assert entity_subscription.time_col == ENTITY_TIME_COLUMNS[EntityKey.MetricsCounters]
        assert entity_subscription.dataset == QueryDatasets.METRICS
        session_status = tag_key(org_id, "session.status")
        session_status_tag_values = get_tag_values_list(org_id, ["crashed", "init"])
        snuba_filter = entity_subscription.build_snuba_filter("", None, None)
        assert snuba_filter
        assert snuba_filter.aggregations == [["sum(value)", None, "value"]]
        assert snuba_filter.conditions == [
            ["metric_id", "=", metric_id(org_id, SessionMetricKey.SESSION)],
            [session_status, "IN", session_status_tag_values],
        ]
        assert snuba_filter.groupby == groupby

    def test_map_aggregate_to_transactions_entity_subscription(self) -> None:
        aggregate = "percentile(transaction.duration,.95)"
        entity_subscription = map_aggregate_to_entity_subscription(
            dataset=QueryDatasets.TRANSACTIONS, aggregate=aggregate
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

    def test_map_aggregate_to_events_entity_subscription(self) -> None:
        aggregate = "count_unique(user)"
        entity_subscription = map_aggregate_to_entity_subscription(
            dataset=QueryDatasets.EVENTS, aggregate=aggregate
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

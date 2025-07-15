import pytest

from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import TestMigrations


@pytest.mark.migrations
class FixSpanItemEventTypeAlertsTest(TestMigrations):
    migrate_from = "0948_ds_waiver_org_fk_not_db_constr"
    migrate_to = "0949_fix_span_item_event_type_alerts"

    def setup_before_migration(self, apps):
        self.snuba_query_with_transaction = SnubaQuery.objects.create(
            type=1,
            dataset="events_analytics_platform",
            query="test query",
            aggregate="count()",
            time_window=600,
            resolution=60,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=self.snuba_query_with_transaction,
            type=SnubaQueryEventType.EventType.TRANSACTION.value,
        )

        self.snuba_query_with_span = SnubaQuery.objects.create(
            type=1,
            dataset="events_analytics_platform",
            query="correct query",
            aggregate="count()",
            time_window=600,
            resolution=60,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=self.snuba_query_with_span,
            type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value,
        )

        self.snuba_query_events = SnubaQuery.objects.create(
            type=0,
            dataset="events",
            query="events query",
            aggregate="count()",
            time_window=600,
            resolution=60,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=self.snuba_query_events,
            type=0,
        )

        self.snuba_query_with_logs = SnubaQuery.objects.create(
            type=1,
            dataset="events_analytics_platform",
            query="test query",
            aggregate="count()",
            time_window=600,
            resolution=60,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=self.snuba_query_with_logs,
            type=SnubaQueryEventType.EventType.TRACE_ITEM_LOG.value,
        )

        self.snuba_query_both = SnubaQuery.objects.create(
            type=1,
            dataset="events_analytics_platform",
            query="both query",
            aggregate="count()",
            time_window=600,
            resolution=60,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=self.snuba_query_both,
            type=SnubaQueryEventType.EventType.TRANSACTION.value,
        )
        SnubaQueryEventType.objects.create(
            snuba_query=self.snuba_query_both,
            type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value,
        )

    def test_fixes_events_analytics_platform_transaction_event_types(self):
        snuba_query = SnubaQuery.objects.get(id=self.snuba_query_with_transaction.id)
        assert not SnubaQueryEventType.objects.filter(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRANSACTION.value
        ).exists()
        assert SnubaQueryEventType.objects.filter(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value
        ).exists()

    def test_skips_queries_without_transaction_event_type(self):
        span_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.snuba_query_with_span.id,
            type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value,
        ).first()

        assert span_event_type is not None
        assert span_event_type.snuba_query_id == self.snuba_query_with_span.id

    def test_skips_queries_with_other_datasets(self):
        error_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.snuba_query_events.id, type=0
        ).first()

        assert error_event_type is not None
        assert error_event_type.snuba_query_id == self.snuba_query_events.id

    def test_handles_queries_with_logs_event_type(self):
        snuba_query = SnubaQuery.objects.get(id=self.snuba_query_with_logs.id)

        assert not SnubaQueryEventType.objects.filter(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRANSACTION.value
        ).exists()
        assert not SnubaQueryEventType.objects.filter(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value
        ).exists()
        assert SnubaQueryEventType.objects.filter(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRACE_ITEM_LOG.value
        ).exists()

    def test_handles_queries_with_both_event_types(self):
        assert not SnubaQueryEventType.objects.filter(
            snuba_query_id=self.snuba_query_both.id,
            type=SnubaQueryEventType.EventType.TRANSACTION.value,
        ).exists()

        span_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.snuba_query_both.id,
            type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value,
        ).first()
        assert span_event_type is not None

    def test_creates_span_event_type_when_missing(self):
        span_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.snuba_query_with_transaction.id,
            type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value,
        ).first()

        assert span_event_type is not None
        assert span_event_type.snuba_query_id == self.snuba_query_with_transaction.id

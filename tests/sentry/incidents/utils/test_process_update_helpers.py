from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.incidents.utils.process_update_helpers import get_aggregation_value
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.search.events.datasets.discover import InvalidIssueSearchQuery
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import get_entity_subscription_from_snuba_query
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import TestCase


class InvalidIssueSearchQueryTest(TestCase):
    def test_exception_stores_and_renders_invalid_ids(self):
        invalid_ids = ["PROJECT-123", "PROJECT-456"]
        exc = InvalidIssueSearchQuery(invalid_ids)

        assert exc.invalid_ids == invalid_ids
        assert "PROJECT-123" in str(exc)
        assert "PROJECT-456" in str(exc)
        assert "do not exist" in str(exc)


class GetAggregationValueTest(TestCase):
    def test_missing_issue_ids_returns_none_gracefully(self):
        now = timezone.now()
        start = now - timedelta(minutes=5)
        end = now

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="issue:NONEXISTENT-123",
            aggregate="count()",
            time_window=timedelta(minutes=1),
            resolution=timedelta(minutes=1),
            environment=None,
            event_types=[
                SnubaQueryEventType.EventType.ERROR,
                SnubaQueryEventType.EventType.DEFAULT,
            ],
        )

        entity_subscription = get_entity_subscription_from_snuba_query(
            snuba_query, self.organization.id
        )

        subscription_update: QuerySubscriptionUpdate = {
            "entity": "events",
            "subscription_id": "test-sub-id",
            "timestamp": end,
            "values": {"data": [{"count": 0}]},
        }

        with mock.patch("sentry.incidents.utils.process_update_helpers.logger") as mock_logger:
            result = get_aggregation_value(
                entity_subscription=entity_subscription,
                subscription_update=subscription_update,
                snuba_query=snuba_query,
                project_ids=[self.project.id],
                organization_id=self.organization.id,
                start=start,
                end=end,
                alert_rule_id=None,
            )

            assert result is None
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args
            assert "non-existent issue IDs" in call_args[0][0]

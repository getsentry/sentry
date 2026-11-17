from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.incidents.utils.query_helpers import (
    coerce_aggregation_value,
    run_query_for_window,
)
from sentry.search.exceptions import InvalidIssueSearchQuery
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import TestCase


class InvalidIssueSearchQueryTest(TestCase):
    def test_exception_stores_and_renders_invalid_ids(self) -> None:
        invalid_ids = ["PROJECT-123", "PROJECT-456"]
        exc = InvalidIssueSearchQuery(invalid_ids)

        assert exc.invalid_ids == invalid_ids
        assert "PROJECT-123" in str(exc)
        assert "PROJECT-456" in str(exc)
        assert "do not exist" in str(exc)


class RunQueryForWindowTest(TestCase):
    def test_missing_issue_ids_returns_none_gracefully(self) -> None:
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

        with mock.patch("sentry.incidents.utils.query_helpers.logger") as mock_logger:
            result = run_query_for_window(
                snuba_query=snuba_query,
                subscription_id="test-sub-id",
                org_id=self.organization.id,
                project_ids=[self.project.id],
                window_start=start,
                window_end=end,
                referrer="test.referrer",
            )

            assert result is None
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args
            assert "invalid search query" in call_args[0][0]


class NormalizeSnubaQueryResultTest(TestCase):
    def test_none(self) -> None:
        assert coerce_aggregation_value(None) is None
        assert coerce_aggregation_value(None, none_defaults_to_zero=True) == 0.0

    def test_numeric_values(self) -> None:
        assert coerce_aggregation_value(12.5) == 12.5
        assert coerce_aggregation_value(3) == 3.0

    def test_empty_string_returns_none(self) -> None:
        assert coerce_aggregation_value("") is None
        assert coerce_aggregation_value("   ") is None

    def test_numeric_string(self) -> None:
        assert coerce_aggregation_value("42.5") == 42.5

    def test_non_numeric_string_returns_none(self) -> None:
        assert coerce_aggregation_value("not-a-number") is None

    def test_bool_values(self) -> None:
        assert coerce_aggregation_value(True) == 1.0
        assert coerce_aggregation_value(False) == 0.0

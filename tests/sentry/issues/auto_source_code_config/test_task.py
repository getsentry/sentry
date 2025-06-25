from unittest.mock import patch, MagicMock
from google.api_core.exceptions import DeadlineExceeded

from sentry.issues.auto_source_code_config.task import fetch_event
from sentry.issues.auto_source_code_config.constants import METRIC_PREFIX
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba


class FetchEventTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project_id = self.project.id
        self.event_id = "event123"
        self.group_id = 456
        self.extra = {
            "project_id": self.project_id,
            "event_id": self.event_id,
            "group_id": self.group_id,
        }

    @requires_snuba
    @patch("sentry.utils.metrics.incr")
    @patch("sentry.eventstore.backend.get_event_by_id")
    def test_fetch_event_successful(self, mock_get_event, mock_metrics_incr):
        """Test successful event fetching with no metrics calls"""
        mock_event = MagicMock()
        mock_get_event.return_value = mock_event

        result = fetch_event(self.project_id, self.event_id, self.group_id, self.extra)

        assert result == mock_event
        mock_get_event.assert_called_once_with(self.project_id, self.event_id, self.group_id)
        mock_metrics_incr.assert_not_called()

    @requires_snuba
    @patch("sentry.utils.metrics.incr")
    @patch("sentry.eventstore.backend.get_event_by_id")
    def test_fetch_event_not_found(self, mock_get_event, mock_metrics_incr):
        """Test when event is not found - should increment event_not_found metric"""
        mock_get_event.return_value = None

        result = fetch_event(self.project_id, self.event_id, self.group_id, self.extra)

        assert result is None
        mock_get_event.assert_called_once_with(self.project_id, self.event_id, self.group_id)
        mock_metrics_incr.assert_called_once_with(
            key=f"{METRIC_PREFIX}.failure", 
            tags={"reason": "event_not_found"}, 
            sample_rate=1.0
        )

    @requires_snuba
    @patch("sentry.utils.metrics.incr")
    @patch("sentry.eventstore.backend.get_event_by_id")
    def test_fetch_event_deadline_exceeded(self, mock_get_event, mock_metrics_incr):
        """Test when DeadlineExceeded exception is raised - should increment nodestore_deadline_exceeded metric"""
        mock_get_event.side_effect = DeadlineExceeded("Request deadline exceeded")

        result = fetch_event(self.project_id, self.event_id, self.group_id, self.extra)

        assert result is None
        mock_get_event.assert_called_once_with(self.project_id, self.event_id, self.group_id)
        mock_metrics_incr.assert_called_once_with(
            key=f"{METRIC_PREFIX}.failure", 
            tags={"reason": "nodestore_deadline_exceeded"}, 
            sample_rate=1.0
        )

    @requires_snuba
    @patch("sentry.issues.auto_source_code_config.task.logger")
    @patch("sentry.utils.metrics.incr")
    @patch("sentry.eventstore.backend.get_event_by_id")
    def test_fetch_event_generic_exception(self, mock_get_event, mock_metrics_incr, mock_logger):
        """Test when generic exception is raised - should log exception and increment event_fetching_exception metric"""
        exception_message = "Database connection error"
        mock_get_event.side_effect = Exception(exception_message)

        result = fetch_event(self.project_id, self.event_id, self.group_id, self.extra)

        assert result is None
        mock_get_event.assert_called_once_with(self.project_id, self.event_id, self.group_id)
        mock_logger.exception.assert_called_once_with("Error fetching event.", extra=self.extra)
        mock_metrics_incr.assert_called_once_with(
            key=f"{METRIC_PREFIX}.failure", 
            tags={"reason": "event_fetching_exception"}, 
            sample_rate=1.0
        )

    @requires_snuba
    @patch("sentry.issues.auto_source_code_config.task.logger")
    @patch("sentry.utils.metrics.incr")
    @patch("sentry.eventstore.backend.get_event_by_id")
    def test_fetch_event_runtime_error(self, mock_get_event, mock_metrics_incr, mock_logger):
        """Test when RuntimeError is raised - should log exception and increment event_fetching_exception metric"""
        mock_get_event.side_effect = RuntimeError("Runtime error occurred")

        result = fetch_event(self.project_id, self.event_id, self.group_id, self.extra)

        assert result is None
        mock_get_event.assert_called_once_with(self.project_id, self.event_id, self.group_id)
        mock_logger.exception.assert_called_once_with("Error fetching event.", extra=self.extra)
        mock_metrics_incr.assert_called_once_with(
            key=f"{METRIC_PREFIX}.failure", 
            tags={"reason": "event_fetching_exception"}, 
            sample_rate=1.0
        )

    @requires_snuba
    @patch("sentry.issues.auto_source_code_config.task.logger")
    @patch("sentry.utils.metrics.incr")
    @patch("sentry.eventstore.backend.get_event_by_id")
    def test_fetch_event_value_error(self, mock_get_event, mock_metrics_incr, mock_logger):
        """Test when ValueError is raised - should log exception and increment event_fetching_exception metric"""
        mock_get_event.side_effect = ValueError("Invalid value provided")

        result = fetch_event(self.project_id, self.event_id, self.group_id, self.extra)

        assert result is None
        mock_get_event.assert_called_once_with(self.project_id, self.event_id, self.group_id)
        mock_logger.exception.assert_called_once_with("Error fetching event.", extra=self.extra)
        mock_metrics_incr.assert_called_once_with(
            key=f"{METRIC_PREFIX}.failure", 
            tags={"reason": "event_fetching_exception"}, 
            sample_rate=1.0
        )

    @requires_snuba
    def test_fetch_event_with_different_extra_data(self):
        """Test that the function works with different extra data structures"""
        different_extra = {
            "organization.slug": "test-org",
            "project_id": self.project_id,
            "group_id": self.group_id,
            "event_id": self.event_id,
            "additional_field": "test_value"
        }

        with patch("sentry.eventstore.backend.get_event_by_id") as mock_get_event:
            mock_event = MagicMock()
            mock_get_event.return_value = mock_event

            result = fetch_event(self.project_id, self.event_id, self.group_id, different_extra)

            assert result == mock_event
            mock_get_event.assert_called_once_with(self.project_id, self.event_id, self.group_id)

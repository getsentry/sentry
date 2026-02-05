from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

from urllib3.exceptions import MaxRetryError, TimeoutError
from urllib3.response import HTTPResponse

from sentry.seer.anomaly_detection.get_anomaly_data import (
    get_anomaly_data_from_seer,
    get_anomaly_threshold_data_from_seer,
)
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
from sentry.snuba.models import QuerySubscription
from sentry.utils import json
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class GetAnomalyThresholdDataFromSeerTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        with self.tasks():
            self.snuba_query = self.create_snuba_query()
            self.subscription = QuerySubscription.objects.create(
                project=self.project,
                status=QuerySubscription.Status.ACTIVE.value,
                subscription_id="123",
                snuba_query=self.snuba_query,
            )

    def _mock_response(self, status: int, data: bytes) -> Mock:
        response = Mock(spec=HTTPResponse)
        response.status = status
        response.data = data
        return response

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_successful_response(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(
            200,
            b'{"success": true, "data": [{"external_alert_id": 24, "timestamp": 1.0, "value": 0, "yhat_lower": 10.5, "yhat_upper": 20.5}]}',
        )

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result == [
            {
                "external_alert_id": 24,
                "timestamp": 1.0,
                "value": 0,
                "yhat_lower": 10.5,
                "yhat_upper": 20.5,
            }
        ]

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_timeout_error(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = TimeoutError()

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_http_error(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(500, b"Internal Server Error")

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_invalid_json(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(200, b"Invalid JSON{")

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_seer_success_false(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(
            200, b'{"success": false, "message": "Alert not found"}'
        )

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_request_includes_timestamps(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(200, b'{"success": true, "data": []}')

        get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1729178100.0, end=1729179000.0
        )

        body = mock_request.call_args.kwargs["body"]
        assert b"1729178100.0" in body
        assert b"1729179000.0" in body
        assert str(self.subscription.id).encode() in body

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_max_retry_error(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = MaxRetryError(pool=MagicMock(), url="test")

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_returns_empty_data(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(200, b'{"success": true, "data": []}')

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result == []

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_adjusts_timestamps_for_data_after_detector_creation(
        self, mock_request: MagicMock
    ) -> None:
        detector_created_ts = self.subscription.date_added.timestamp()
        # Timestamp after detector creation
        future_timestamp = detector_created_ts + 1000

        mock_request.return_value = self._mock_response(
            200,
            f'{{"success": true, "data": [{{"external_alert_id": 24, "timestamp": {future_timestamp}, "value": 0, "yhat_lower": 10.5, "yhat_upper": 20.5}}]}}'.encode(),
        )

        result = get_anomaly_threshold_data_from_seer(
            subscription=self.subscription, start=1.0, end=2.0
        )

        assert result is not None
        assert len(result) == 1
        # Timestamp should be adjusted by time_window (default 60 seconds)
        assert result[0]["timestamp"] == future_timestamp - self.snuba_query.time_window


class GetAnomalyDataAggregateTypeTest(BaseWorkflowTest):
    """Test aggregate type determination in get_anomaly_data_from_seer"""

    def setUp(self) -> None:
        super().setUp()
        with self.tasks():
            self.snuba_query = self.create_snuba_query()
            self.subscription = QuerySubscription.objects.create(
                project=self.project,
                status=QuerySubscription.Status.ACTIVE.value,
                subscription_id="123",
                snuba_query=self.snuba_query,
            )

    def _mock_response(self, status: int, data: bytes) -> Mock:
        response = Mock(spec=HTTPResponse)
        response.status = status
        response.data = data
        return response

    def _call_get_anomaly_data_and_get_aggregate(
        self, mock_request: MagicMock, aggregate: str
    ) -> str | None:
        self.snuba_query.aggregate = aggregate
        self.snuba_query.save()

        mock_request.return_value = self._mock_response(
            200,
            b'{"success": true, "timeseries": [{"timestamp": 1.0, "value": 100}]}',
        )

        get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update={
                "value": 100,
                "source_id": self.subscription.id,
                "subscription_id": self.subscription.id,
                "timestamp": datetime(2024, 1, 1, tzinfo=timezone.utc),
            },
        )

        # Body is the 3rd positional argument to make_signed_seer_api_request
        body = json.loads(mock_request.call_args[0][2])
        return body["config"].get("aggregate")

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_count_aggregates_sent_as_count(self, mock_request: MagicMock) -> None:
        """Test that count-based aggregates are sent as 'count' to Seer"""
        count_aggregates = [
            "count()",
            "COUNT()",
            "count_unique(user)",
            "count_unique(tags[sentry:user])",
            "count_if(transaction.duration,greater,300)",
        ]

        for aggregate in count_aggregates:
            result = self._call_get_anomaly_data_and_get_aggregate(mock_request, aggregate)
            assert result == "count", f"Expected 'count' for {aggregate}, got {result}"

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_non_count_aggregates_sent_as_other(self, mock_request: MagicMock) -> None:
        """Test that non-count aggregates are sent as 'other' to Seer"""
        other_aggregates = [
            "avg(transaction.duration)",
            "p50(transaction.duration)",
            "p95(transaction.duration)",
            "p99(transaction.duration)",
            "max(transaction.duration)",
            "min(transaction.duration)",
            "sum(transaction.duration)",
            "failure_rate()",
            "apdex(300)",
        ]

        for aggregate in other_aggregates:
            result = self._call_get_anomaly_data_and_get_aggregate(mock_request, aggregate)
            assert result == "other", f"Expected 'other' for {aggregate}, got {result}"

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_empty_aggregate_not_sent(self, mock_request: MagicMock) -> None:
        """Test that empty aggregate results in no 'aggregate' field sent to Seer"""
        result = self._call_get_anomaly_data_and_get_aggregate(mock_request, "")
        assert result is None, f"Expected None for empty aggregate, got {result}"

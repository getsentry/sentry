from typing import Any
from unittest.mock import MagicMock, Mock, patch

from django.utils import timezone
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
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context
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

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_detect_anomalies_request")
    def test_detect_establishes_viewer_context(self, mock_request: MagicMock) -> None:
        observed_contexts: list[ViewerContext | None] = []

        def make_request(*args: Any, **kwargs: Any) -> Mock:
            observed_contexts.append(get_viewer_context())
            return self._mock_response(200, b'{"success": true, "timeseries": []}')

        mock_request.side_effect = make_request
        subscription_id = self.subscription.subscription_id
        assert subscription_id is not None

        result = get_anomaly_data_from_seer(
            AnomalyDetectionSensitivity.HIGH,
            AnomalyDetectionSeasonality.AUTO,
            AnomalyDetectionThresholdType.ABOVE,
            self.subscription,
            {
                "source_id": str(self.project.id),
                "subscription_id": subscription_id,
                "timestamp": timezone.now(),
                "value": 1.0,
            },
        )

        assert result is None
        assert observed_contexts == [
            ViewerContext(
                organization_id=self.organization.id,
                project_id=self.project.id,
                actor_type=ActorType.SYSTEM,
            )
        ]

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

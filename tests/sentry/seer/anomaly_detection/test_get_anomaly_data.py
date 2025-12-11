from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

from urllib3.exceptions import MaxRetryError, TimeoutError
from urllib3.response import HTTPResponse

from sentry.seer.anomaly_detection.get_anomaly_data import (
    _adjust_timestamps_for_time_window,
    get_anomaly_data_from_seer,
    get_anomaly_threshold_data_from_seer,
)
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
from sentry.snuba.models import QuerySubscription
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class AdjustTimestampsForTimeWindowTest(BaseWorkflowTest):
    def test_adjusts_timestamps_after_detector_creation(self) -> None:
        detector_created_at = 1000.0
        time_window_seconds = 900  # 15 minutes

        data_points = [
            {"timestamp": 1100.0, "value": 10.0},  # After creation, should be adjusted
            {"timestamp": 1200.0, "value": 20.0},  # After creation, should be adjusted
        ]

        _adjust_timestamps_for_time_window(
            data_points=data_points,
            time_window_seconds=time_window_seconds,
            detector_created_at=detector_created_at,
        )

        assert data_points[0]["timestamp"] == 1100.0 - 900
        assert data_points[1]["timestamp"] == 1200.0 - 900

    def test_does_not_adjust_timestamps_before_detector_creation(self) -> None:
        detector_created_at = 1000.0
        time_window_seconds = 900

        data_points = [
            {"timestamp": 500.0, "value": 10.0},  # Before creation, should NOT be adjusted
            {"timestamp": 800.0, "value": 20.0},  # Before creation, should NOT be adjusted
        ]

        _adjust_timestamps_for_time_window(
            data_points=data_points,
            time_window_seconds=time_window_seconds,
            detector_created_at=detector_created_at,
        )

        assert data_points[0]["timestamp"] == 500.0
        assert data_points[1]["timestamp"] == 800.0

    def test_mixed_timestamps(self) -> None:
        detector_created_at = 1000.0
        time_window_seconds = 900

        data_points = [
            {"timestamp": 500.0, "value": 10.0},  # Before, not adjusted
            {"timestamp": 1000.0, "value": 20.0},  # Exactly at, should be adjusted
            {"timestamp": 1500.0, "value": 30.0},  # After, should be adjusted
        ]

        _adjust_timestamps_for_time_window(
            data_points=data_points,
            time_window_seconds=time_window_seconds,
            detector_created_at=detector_created_at,
        )

        assert data_points[0]["timestamp"] == 500.0
        assert data_points[1]["timestamp"] == 1000.0 - 900
        assert data_points[2]["timestamp"] == 1500.0 - 900

    def test_empty_data_points(self) -> None:
        data_points: list = []

        _adjust_timestamps_for_time_window(
            data_points=data_points,
            time_window_seconds=900,
            detector_created_at=1000.0,
        )

        assert data_points == []


class GetAnomalyDataFromSeerTest(BaseWorkflowTest):
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

    def _create_subscription_update(self, value: int = 100) -> dict:
        return {
            "value": value,
            "source_id": self.subscription.id,
            "subscription_id": self.subscription.id,
            "timestamp": datetime.now(tz=timezone.utc),
        }

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_successful_response(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(
            200,
            b'{"success": true, "timeseries": [{"timestamp": 1.0, "value": 100.0, "anomaly": {"anomaly_type": "none", "anomaly_score": 0.5}}]}',
        )

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is not None
        assert len(result) == 1
        assert result[0]["value"] == 100.0

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_returns_none_when_aggregation_value_is_none(self, mock_request: MagicMock) -> None:
        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(value=None),
        )

        assert result is None
        mock_request.assert_not_called()

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_timeout_error(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = TimeoutError()

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_max_retry_error(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = MaxRetryError(pool=None, url="test")

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_http_error(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(500, b"Internal Server Error")

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_invalid_json(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(200, b"Invalid JSON{")

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_seer_success_false(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(
            200, b'{"success": false, "message": "Not enough data"}'
        )

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_empty_timeseries(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(200, b'{"success": true, "timeseries": []}')

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is None

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_response_decode_error(self, mock_request: MagicMock) -> None:
        response = Mock(spec=HTTPResponse)
        response.status = 200
        response.data = None  # This will cause AttributeError on decode()

        mock_request.return_value = response

        result = get_anomaly_data_from_seer(
            sensitivity=AnomalyDetectionSensitivity.MEDIUM,
            seasonality=AnomalyDetectionSeasonality.AUTO,
            threshold_type=AnomalyDetectionThresholdType.ABOVE,
            subscription=self.subscription,
            subscription_update=self._create_subscription_update(),
        )

        assert result is None


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
        mock_request.side_effect = MaxRetryError(pool=None, url="test")

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

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.features.has")
    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_adjusts_timestamps_when_feature_flag_enabled(
        self, mock_request: MagicMock, mock_feature: MagicMock
    ) -> None:
        mock_feature.return_value = True
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

    @patch("sentry.seer.anomaly_detection.get_anomaly_data.features.has")
    @patch("sentry.seer.anomaly_detection.get_anomaly_data.make_signed_seer_api_request")
    def test_does_not_adjust_timestamps_when_feature_flag_disabled(
        self, mock_request: MagicMock, mock_feature: MagicMock
    ) -> None:
        mock_feature.return_value = False
        detector_created_ts = self.subscription.date_added.timestamp()
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
        # Timestamp should NOT be adjusted
        assert result[0]["timestamp"] == future_timestamp

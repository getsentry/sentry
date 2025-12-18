from datetime import UTC, datetime
from unittest import mock

import orjson
from urllib3.response import HTTPResponse

from sentry.incidents.utils.types import AnomalyDetectionUpdate
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyType,
    DataSourceType,
    DetectAnomaliesResponse,
)
from sentry.snuba.subscriptions import create_snuba_subscription
from sentry.workflow_engine.models import Condition, DataPacket
from sentry.workflow_engine.types import ConditionError, DetectorPriorityLevel
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestAnomalyDetectionHandler(ConditionTestCase):
    condition = Condition.ANOMALY_DETECTION

    def setUp(self) -> None:
        super().setUp()
        self.snuba_query = self.create_snuba_query()
        self.subscription = create_snuba_subscription(self.project, "test", self.snuba_query)

        (self.workflow, self.detector, self.detector_workflow, self.workflow_triggers) = (
            self.create_detector_and_workflow()
        )
        self.detector.update(config={"detection_type": "dynamic", "comparison_delta": None})
        self.detector.save()

        packet = AnomalyDetectionUpdate(
            subscription_id=str(self.subscription.id),
            values={
                "value": 1,
                "source_id": str(self.subscription.id),
                "subscription_id": str(self.subscription.id),
                "timestamp": datetime.now(UTC),
            },
            timestamp=datetime.now(UTC),
            entity="test-entity",
        )

        self.data_source = self.create_data_source(
            source_id=str(packet.subscription_id),
            organization=self.organization,
        )
        self.data_source.detectors.add(self.detector)

        self.data_packet = DataPacket[AnomalyDetectionUpdate](
            source_id=str(packet.subscription_id),
            packet=packet,
        )

        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "sensitivity": AnomalyDetectionSensitivity.MEDIUM,
                "seasonality": AnomalyDetectionSeasonality.AUTO,
                "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
            },
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.workflow_triggers,
        )
        self.high_confidence_seer_response: DetectAnomaliesResponse = {
            "success": True,
            "timeseries": [
                {
                    "anomaly": {
                        "anomaly_score": 0.9,
                        "anomaly_type": AnomalyType.HIGH_CONFIDENCE,
                    },
                    "timestamp": 1,
                    "value": 10,
                }
            ],
        }

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    def test_passes(self, mock_seer_request: mock.MagicMock) -> None:
        seer_return_value = self.high_confidence_seer_response
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        assert (
            self.dc.evaluate_value(self.data_packet.packet.values)
            == DetectorPriorityLevel.HIGH.value
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    def test_passes_medium(self, mock_seer_request: mock.MagicMock) -> None:
        seer_return_value: DetectAnomaliesResponse = {
            "success": True,
            "timeseries": [
                {
                    "anomaly": {
                        "anomaly_score": 0.2,
                        "anomaly_type": AnomalyType.LOW_CONFIDENCE,
                    },
                    "timestamp": 1,
                    "value": 10,
                }
            ],
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        assert (
            self.dc.evaluate_value(self.data_packet.packet.values) == DetectorPriorityLevel.OK.value
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @mock.patch("sentry.seer.anomaly_detection.get_anomaly_data.logger")
    def test_seer_call_nan_aggregation_value(
        self, mock_logger: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        seer_return_value = self.high_confidence_seer_response
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        packet = AnomalyDetectionUpdate(
            subscription_id=str(self.subscription.id),
            values={
                "value": float("nan"),
                "source_id": str(self.subscription.id),
                "subscription_id": str(self.subscription.id),
                "timestamp": datetime.now(UTC),
            },
            timestamp=datetime.now(UTC),
            entity="test-entity",
        )
        data_packet = DataPacket[AnomalyDetectionUpdate](
            source_id=str(packet.subscription_id),
            packet=packet,
        )

        assert self.dc.evaluate_value(data_packet.packet.values) == ConditionError(
            msg="Error during Seer data evaluation process."
        )
        mock_logger.warning.assert_called_with(
            "Invalid aggregation value",
            extra={
                "source_id": self.subscription.id,
                "source_type": DataSourceType.SNUBA_QUERY_SUBSCRIPTION,
            },
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @mock.patch("sentry.seer.anomaly_detection.get_anomaly_data.logger")
    def test_seer_call_timeout_error(
        self, mock_logger: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        from urllib3.exceptions import TimeoutError

        mock_seer_request.side_effect = TimeoutError
        timeout_extra = {
            "subscription_id": self.subscription.id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "source_id": self.subscription.id,
            "source_type": DataSourceType.SNUBA_QUERY_SUBSCRIPTION,
            "dataset": self.subscription.snuba_query.dataset,
        }
        self.dc.evaluate_value(self.data_packet.packet.values)
        mock_logger.warning.assert_called_with(
            "Timeout error when hitting anomaly detection endpoint", extra=timeout_extra
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @mock.patch("sentry.seer.anomaly_detection.get_anomaly_data.logger")
    def test_seer_call_empty_list(
        self, mock_logger: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        seer_return_value: DetectAnomaliesResponse = {"success": True, "timeseries": []}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        self.dc.evaluate_value(self.data_packet.packet.values)
        assert mock_logger.warning.call_args[0] == (
            "Seer anomaly detection response returned no potential anomalies",
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @mock.patch("sentry.seer.anomaly_detection.get_anomaly_data.logger")
    def test_seer_call_bad_status(
        self, mock_logger: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        mock_seer_request.return_value = HTTPResponse(status=403)
        extra = {
            "subscription_id": self.subscription.id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "source_id": self.subscription.id,
            "source_type": DataSourceType.SNUBA_QUERY_SUBSCRIPTION,
            "dataset": self.subscription.snuba_query.dataset,
            "response_data": None,
        }
        self.dc.evaluate_value(self.data_packet.packet.values)
        mock_logger.error.assert_called_with(
            "Error when hitting Seer detect anomalies endpoint", extra=extra
        )

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @mock.patch("sentry.seer.anomaly_detection.get_anomaly_data.logger")
    def test_seer_call_failed_parse(
        self, mock_logger: mock.MagicMock, mock_seer_request: mock.MagicMock
    ) -> None:
        # XXX: coercing a response into something that will fail to parse
        mock_seer_request.return_value = HTTPResponse(None, status=200)  # type: ignore[arg-type]
        self.dc.evaluate_value(self.data_packet.packet.values)
        mock_logger.exception.assert_called_with(
            "Failed to parse Seer anomaly detection response", extra=mock.ANY
        )

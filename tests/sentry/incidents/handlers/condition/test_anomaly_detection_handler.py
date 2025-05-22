from datetime import UTC, datetime
from unittest import mock

import orjson
from urllib3.response import HTTPResponse

from sentry.incidents.utils.types import MetricDetectorUpdate
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyType,
    DetectAnomaliesResponse,
)
from sentry.snuba.subscriptions import create_snuba_subscription
from sentry.workflow_engine.models import Condition, DataPacket
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestAnomalyDetectionHandler(ConditionTestCase):
    condition = Condition.ANOMALY_DETECTION

    def setUp(self):
        super().setUp()
        self.snuba_query = self.create_snuba_query()
        self.subscription = create_snuba_subscription(self.project, "test", self.snuba_query)

        (self.workflow, self.detector, self.detector_workflow, self.workflow_triggers) = (
            self.create_detector_and_workflow()
        )

        subscription_update: MetricDetectorUpdate = {
            "subscription_id": str(self.subscription.id),
            "values": {"value": 1},
            "timestamp": datetime.now(UTC),
            "entity": "test-entity",
        }

        self.data_source = self.create_data_source(
            source_id=str(subscription_update["subscription_id"]),
            organization=self.organization,
        )
        self.data_source.detectors.add(self.detector)

        self.data_packet = DataPacket[MetricDetectorUpdate](
            source_id=str(subscription_update["subscription_id"]),
            packet=subscription_update,
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

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    def test_passes(self, mock_seer_request):
        seer_return_value: DetectAnomaliesResponse = {
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
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        self.assert_passes(self.dc, self.data_packet)

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    def test_does_not_pass(self, mock_seer_request):
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
        self.assert_does_not_pass(self.dc, self.data_packet)

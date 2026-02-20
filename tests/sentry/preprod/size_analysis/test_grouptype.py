from __future__ import annotations

from unittest import mock

import pytest

from sentry.preprod.size_analysis.grouptype import (
    PreprodSizeAnalysisDetectorHandler,
    PreprodSizeAnalysisDetectorValidator,
    PreprodSizeAnalysisGroupType,
    SizeAnalysisDataPacket,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.types import DetectorPriorityLevel


@region_silo_test
class PreprodSizeAnalysisDetectorValidatorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_create_detector(self):
        condition_group = self.create_data_condition_group(organization=self.project.organization)
        data = {
            "name": "Test Detector",
            "type": PreprodSizeAnalysisGroupType.slug,
            "conditionGroup": {
                "logicType": condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                    },
                ],
            },
            "config": {
                "threshold_type": "absolute_threshold",
                "measurement": "install_size",
            },
        }
        detector = PreprodSizeAnalysisDetectorValidator(data=data, context=self.context)
        assert detector.is_valid(), detector.errors
        detector.save()


@region_silo_test
class PreprodSizeAnalysisDetectorHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=self.condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )

    def test_evaluate_creates_occurrence_when_condition_met(self):
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_threshold", "measurement": "install_size"},
            workflow_condition_group=self.condition_group,
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        result = evaluation_result[None]
        assert result.priority == DetectorPriorityLevel.HIGH
        assert result.result is not None

    def test_evaluate_no_occurrence_when_condition_not_met(self):
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_threshold", "measurement": "install_size"},
            workflow_condition_group=self.condition_group,
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 500,
                "head_download_size_bytes": 200,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_returns_highest_matched_priority(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500000,
            condition_result=DetectorPriorityLevel.MEDIUM,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_threshold", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # Value exceeds both thresholds — should return HIGH (the max)
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate_returns_medium_when_only_medium_condition_met(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500000,
            condition_result=DetectorPriorityLevel.MEDIUM,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=10000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_threshold", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # Value exceeds MEDIUM threshold but not HIGH
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 750000,
                "head_download_size_bytes": 200,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.MEDIUM

    def test_evaluate_no_occurrence_when_no_condition_group(self):
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_threshold", "measurement": "install_size"},
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_absolute_diff(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # head - base = 5000000 - 4000000 = 1000000 > 100000
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4000000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate_absolute_diff_no_trigger_when_below_threshold(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # head - base = 5000000 - 4950000 = 50000 < 100000
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4950000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_relative_diff(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        # Trigger when relative diff > 0.1 (10%)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=0.1,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "relative_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # (5000000 - 4000000) / 4000000 = 0.25 > 0.1
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4000000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate_relative_diff_no_trigger_when_below_threshold(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        # Trigger when relative diff > 0.1 (10%)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=0.1,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "relative_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # (5000000 - 4900000) / 4900000 ≈ 0.02 < 0.1
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4900000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_diff_raises_when_base_missing(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        with pytest.raises(ValueError, match="Missing base value"):
            handler.evaluate(data_packet)


@region_silo_test
class PreprodSizeAnalysisDetectorHandlerIntegrationTest(TestCase):
    def test_e2e(self):
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_threshold", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )

        with mock.patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_produce_occurrence_to_kafka:
            process_detectors(packet, [detector])

        assert mock_produce_occurrence_to_kafka.call_count == 1

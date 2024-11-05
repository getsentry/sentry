from unittest import mock

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.detector import DetectorEvaluationResult, DetectorHandler
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest


class TestProcessDetectors(BaseGroupTypeTest):
    def setUp(self):
        super().setUp()

        class NoHandlerGroupType(GroupType):
            type_id = 1
            slug = "no_handler"
            description = "no handler"
            category = GroupCategory.METRIC_ALERT.value

        class MockDetectorHandler(DetectorHandler[dict]):
            def evaluate(self, data_packet: DataPacket[dict]) -> list[DetectorEvaluationResult]:
                return [
                    DetectorEvaluationResult(None, True, DetectorPriorityLevel.HIGH, data_packet)
                ]

        class HandlerGroupType(GroupType):
            type_id = 2
            slug = "handler"
            description = "handler"
            category = GroupCategory.METRIC_ALERT.value
            detector_handler = MockDetectorHandler

        class MockDetectorStateHandler(DetectorHandler[dict]):
            def evaluate(self, data_packet: DataPacket[dict]) -> list[DetectorEvaluationResult]:
                group_keys = data_packet.packet.get("group_keys", [None])
                return [
                    DetectorEvaluationResult(
                        group_key,
                        True,
                        DetectorPriorityLevel.HIGH,
                        data_packet,
                    )
                    for group_key in group_keys
                ]

        class HandlerStateGroupType(GroupType):
            type_id = 3
            slug = "handler_with_state"
            description = "handler with state"
            category = GroupCategory.METRIC_ALERT.value
            detector_handler = MockDetectorStateHandler

        self.no_handler_type = NoHandlerGroupType
        self.handler_type = HandlerGroupType
        self.handler_state_type = HandlerStateGroupType

    def build_data_packet(self, **kwargs):
        query_id = "1234"
        return DataPacket[dict](query_id, {"query_id": query_id, "some": "data", **kwargs})

    def test(self):
        detector = self.create_detector(type=self.handler_type.slug)
        data_packet = self.build_data_packet()
        results = process_detectors(data_packet, [detector])
        assert results == [
            (
                detector,
                [DetectorEvaluationResult(None, True, DetectorPriorityLevel.HIGH, data_packet)],
            )
        ]

    def test_state_results(self):
        detector = self.create_detector(type=self.handler_state_type.slug)
        data_packet = self.build_data_packet()
        results = process_detectors(data_packet, [detector])
        result = DetectorEvaluationResult(
            None,
            True,
            DetectorPriorityLevel.HIGH,
            data_packet,
        )
        assert results == [
            (
                detector,
                [result],
            )
        ]

    def test_state_results_multi_group(self):
        detector = self.create_detector(type=self.handler_state_type.slug)
        data_packet = self.build_data_packet(group_keys=["group_1", "group_2"])
        results = process_detectors(data_packet, [detector])
        result_1 = DetectorEvaluationResult(
            "group_1",
            True,
            DetectorPriorityLevel.HIGH,
            data_packet,
        )
        result_2 = DetectorEvaluationResult(
            "group_2",
            True,
            DetectorPriorityLevel.HIGH,
            data_packet,
        )
        assert results == [
            (
                detector,
                [result_1, result_2],
            )
        ]

    def test_state_results_multi_group_dupe(self):
        detector = self.create_detector(type=self.handler_state_type.slug)
        data_packet = self.build_data_packet(group_keys=["dupe", "dupe"])
        with mock.patch("sentry.workflow_engine.processors.detector.logger") as mock_logger:
            results = process_detectors(data_packet, [detector])
            assert mock_logger.error.call_args[0][0] == "Duplicate detector state group keys found"
        result = DetectorEvaluationResult(
            "dupe",
            True,
            DetectorPriorityLevel.HIGH,
            data_packet,
        )
        assert results == [
            (
                detector,
                [result, result],
            )
        ]

    def test_no_issue_type(self):
        detector = self.create_detector(type="invalid slug")
        data_packet = self.build_data_packet()
        with mock.patch("sentry.workflow_engine.models.detector.logger") as mock_logger:
            results = process_detectors(data_packet, [detector])
            assert mock_logger.error.call_args[0][0] == "No registered grouptype for detector"
        assert results == []

    def test_no_handler(self):
        detector = self.create_detector(type=self.no_handler_type.slug)
        data_packet = self.build_data_packet()
        with mock.patch("sentry.workflow_engine.models.detector.logger") as mock_logger:
            results = process_detectors(data_packet, [detector])
            assert (
                mock_logger.error.call_args[0][0]
                == "Registered grouptype for detector has no detector_handler"
            )
        assert results == []

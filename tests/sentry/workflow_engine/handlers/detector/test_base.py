from typing import Any
from unittest import mock

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.abstract import Abstract
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import (
    DataPacketEvaluationType,
    DetectorHandler,
    DetectorOccurrence,
    GroupedDetectorEvaluationResult,
    StatefulDetectorHandler,
)
from sentry.workflow_engine.handlers.detector.stateful import DetectorCounters
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
)
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest


def build_mock_occurrence_and_event(
    handler: DetectorHandler,
    value: DataPacketEvaluationType,
    priority: PriorityLevel | None,
) -> tuple[DetectorOccurrence, dict[str, Any]]:
    assert handler.detector.group_type is not None
    return (
        DetectorOccurrence(
            issue_title="Some Issue",
            subtitle="Some subtitle",
            type=handler.detector.group_type,
            level="error",
            culprit="Some culprit",
            priority=priority,
        ),
        {},
    )


def status_change_comparator(self: StatusChangeMessage, other: StatusChangeMessage):
    return (
        isinstance(other, StatusChangeMessage)
        and self.fingerprint == other.fingerprint
        and self.project_id == other.project_id
        and self.new_status == other.new_status
        and self.new_substatus == other.new_substatus
    )


class MockDetectorStateHandler(StatefulDetectorHandler[dict, int | None]):
    def test_get_empty_counter_state(self):
        return {name: None for name in self.state_manager.counter_names}

    def extract_dedupe_value(self, data_packet: DataPacket[dict]) -> int:
        return data_packet.packet.get("dedupe", 0)

    def extract_value(self, data_packet: DataPacket[dict]) -> int:
        if data_packet.packet.get("value"):
            return data_packet.packet["value"]

        return data_packet.packet.get("group_vals", 0)

    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[dict],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        value = self.extract_value(data_packet)
        # PriorityLevel doesn't have an OK value, so we pass None for that case
        priority_level = None if priority == DetectorPriorityLevel.OK else PriorityLevel(priority)
        return build_mock_occurrence_and_event(self, value, priority_level)


class BaseDetectorHandlerTest(BaseGroupTypeTest):
    __test__ = Abstract(__module__, __qualname__)

    def setUp(self) -> None:
        super().setUp()
        self.sm_comp_patcher = mock.patch.object(
            StatusChangeMessage, "__eq__", status_change_comparator
        )
        self.sm_comp_patcher.__enter__()
        # Set up UUID mocking at the base class level
        self.uuid_patcher = mock.patch("sentry.workflow_engine.handlers.detector.stateful.uuid4")
        self.mock_uuid4 = self.uuid_patcher.start()
        self.mock_uuid4.return_value = self.get_mock_uuid()
        project_id = self.project.id

        class NoHandlerGroupType(GroupType):
            type_id = 1
            slug = "no_handler"
            description = "no handler"
            category = GroupCategory.METRIC_ALERT.value
            category_v2 = GroupCategory.METRIC_ALERT.value

        class MockDetectorHandler(DetectorHandler[dict, int]):
            def evaluate_impl(
                self, data_packet: DataPacket[dict]
            ) -> GroupedDetectorEvaluationResult:
                return GroupedDetectorEvaluationResult(
                    result={None: DetectorEvaluationResult(None, True, DetectorPriorityLevel.HIGH)},
                    tainted=False,
                )

            def extract_value(self, data_packet: DataPacket[dict]) -> int:
                return data_packet.packet.get("value", 0)

            def create_occurrence(
                self,
                evaluation_result: ProcessedDataConditionGroup,
                data_packet: DataPacket[dict],
                priority: DetectorPriorityLevel,
            ) -> tuple[DetectorOccurrence, dict[str, Any]]:
                value = self.extract_value(data_packet)
                return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))

            def extract_dedupe_value(self, data_packet: DataPacket[dict]) -> int:
                return data_packet.packet.get("dedupe", 0)

        class MockDetectorWithUpdateHandler(DetectorHandler[dict, int]):
            def evaluate_impl(
                self, data_packet: DataPacket[dict]
            ) -> GroupedDetectorEvaluationResult:
                status_change = StatusChangeMessage(
                    "test_update",
                    project_id,
                    DetectorPriorityLevel.HIGH,
                    None,
                )

                return GroupedDetectorEvaluationResult(
                    result={
                        None: DetectorEvaluationResult(
                            None, True, DetectorPriorityLevel.HIGH, status_change
                        )
                    },
                    tainted=False,
                )

            def create_occurrence(
                self,
                evaluation_result: ProcessedDataConditionGroup,
                data_packet: DataPacket[dict],
                priority: DetectorPriorityLevel,
            ) -> tuple[DetectorOccurrence, dict[str, Any]]:
                value = self.extract_value(data_packet)
                return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))

            def extract_value(self, data_packet: DataPacket[dict]) -> int:
                return data_packet.packet.get("value", 0)

            def extract_dedupe_value(self, data_packet: DataPacket[dict]) -> int:
                return data_packet.packet.get("dedupe", 0)

        class HandlerGroupType(GroupType):
            type_id = 2
            slug = "handler"
            description = "handler"
            category = GroupCategory.METRIC_ALERT.value
            category_v2 = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDetectorHandler)

        class HandlerStateGroupType(GroupType):
            type_id = 3
            slug = "handler_with_state"
            description = "handler with state"
            category = GroupCategory.METRIC_ALERT.value
            category_v2 = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDetectorStateHandler)

        class HandlerUpdateGroupType(GroupType):
            type_id = 4
            slug = "handler_update"
            description = "handler update"
            category = GroupCategory.METRIC_ALERT.value
            category_v2 = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDetectorWithUpdateHandler)

        self.no_handler_type = NoHandlerGroupType
        self.handler_type = HandlerGroupType
        self.handler_state_type = HandlerStateGroupType
        self.update_handler_type = HandlerUpdateGroupType

    def tearDown(self) -> None:
        super().tearDown()
        self.uuid_patcher.stop()
        self.sm_comp_patcher.stop()

    def create_detector_and_condition(self, type: str | None = None):
        if type is None:
            type = "handler_with_state"
        self.project = self.create_project()
        detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=type,
        )
        data_condition = self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=detector.workflow_condition_group,
        )

        # add a default resolution case
        self.create_data_condition(
            type=Condition.LESS_OR_EQUAL,
            comparison=5,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=detector.workflow_condition_group,
        )
        return detector, data_condition

    def build_handler(
        self, detector: Detector | None = None, detector_type=None
    ) -> MockDetectorStateHandler:
        if detector is None:
            detector, _ = self.create_detector_and_condition(detector_type)
        return MockDetectorStateHandler(detector)

    def assert_updates(
        self,
        handler: StatefulDetectorHandler,
        group_key: DetectorGroupKey | None,
        dedupe_value: int | None,
        counter_updates: DetectorCounters | None,
        is_triggered: bool | None,
        priority: DetectorPriorityLevel | None,
    ):
        """
        Use this method when testing state updates that have been executed by evaluate
        """
        saved_state = handler.state_manager.get_state_data([group_key])
        state_data = saved_state.get(group_key)

        if not state_data:
            raise AssertionError(f"No state data found for group key: {group_key}")

        if dedupe_value is not None:
            assert state_data.dedupe_value == dedupe_value

        if counter_updates is not None:
            assert state_data.counter_updates == counter_updates

        if is_triggered is not None:
            assert state_data.is_triggered == is_triggered

        if priority is not None:
            assert state_data.status == priority

    def detector_to_issue_occurrence(
        self,
        detector_occurrence: DetectorOccurrence,
        detector: Detector,
        group_key: DetectorGroupKey,
        value: int,
        priority: DetectorPriorityLevel,
        occurrence_id: str,
    ) -> tuple[IssueOccurrence, dict[str, Any]]:
        fingerprint = [f"{detector.id}{':' + group_key if group_key is not None else ''}"]
        evidence_data = {
            **detector_occurrence.evidence_data,
            "detector_id": detector.id,
            "value": value,
        }
        issue_occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id=occurrence_id,
            project_id=detector.project_id,
            status=priority,
            additional_evidence_data=evidence_data,
            fingerprint=fingerprint,
        )
        event_data: dict[str, Any] = {}
        if hasattr(detector_occurrence, "event_data"):
            event_data = (
                detector_occurrence.event_data.copy() if detector_occurrence.event_data else {}
            )
        event_data["environment"] = detector.config.get("environment")
        event_data["timestamp"] = issue_occurrence.detection_time
        event_data["project_id"] = detector.project_id
        event_data["event_id"] = occurrence_id
        event_data.setdefault("platform", "python")
        event_data.setdefault("received", issue_occurrence.detection_time)
        event_data.setdefault("tags", {})
        return issue_occurrence, event_data

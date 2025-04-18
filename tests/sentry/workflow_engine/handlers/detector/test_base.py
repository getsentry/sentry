from datetime import datetime
from typing import Any
from unittest import mock

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.abstract import Abstract
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import (
    DetectorEvaluationResult,
    DetectorHandler,
    DetectorOccurrence,
)
from sentry.workflow_engine.handlers.detector.stateful import StatefulDetectorHandler
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel, DetectorSettings
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest


def build_mock_occurrence_and_event(
    handler: StatefulDetectorHandler,
    group_key: DetectorGroupKey,
    new_status: PriorityLevel,
) -> tuple[DetectorOccurrence, dict[str, Any]]:
    assert handler.detector.group_type is not None
    return (
        DetectorOccurrence(
            issue_title="Some Issue",
            subtitle="Some subtitle",
            type=handler.detector.group_type,
            level="error",
            culprit="Some culprit",
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


class MockDetectorStateHandler(StatefulDetectorHandler[dict]):
    counter_names = ["test1", "test2"]

    def get_dedupe_value(self, data_packet: DataPacket[dict]) -> int:
        return data_packet.packet.get("dedupe", 0)

    def get_group_key_values(self, data_packet: DataPacket[dict]) -> dict[str | None, int]:
        return data_packet.packet.get("group_vals", {})

    def build_occurrence_and_event_data(
        self, group_key: DetectorGroupKey, new_status: PriorityLevel
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        return build_mock_occurrence_and_event(self, group_key, new_status)


class BaseDetectorHandlerTest(BaseGroupTypeTest):
    __test__ = Abstract(__module__, __qualname__)

    def setUp(self):
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

        class MockDetectorHandler(DetectorHandler[dict]):
            def evaluate(
                self, data_packet: DataPacket[dict]
            ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
                return {None: DetectorEvaluationResult(None, True, DetectorPriorityLevel.HIGH)}

        class MockDetectorWithUpdateHandler(DetectorHandler[dict]):
            def evaluate(
                self, data_packet: DataPacket[dict]
            ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
                status_change = StatusChangeMessage(
                    "test_update",
                    project_id,
                    DetectorPriorityLevel.HIGH,
                    None,
                )

                return {
                    None: DetectorEvaluationResult(
                        None, True, DetectorPriorityLevel.HIGH, status_change
                    )
                }

        class HandlerGroupType(GroupType):
            type_id = 2
            slug = "handler"
            description = "handler"
            category = GroupCategory.METRIC_ALERT.value
            detector_settings = DetectorSettings(handler=MockDetectorHandler)

        class HandlerStateGroupType(GroupType):
            type_id = 3
            slug = "handler_with_state"
            description = "handler with state"
            category = GroupCategory.METRIC_ALERT.value
            detector_settings = DetectorSettings(handler=MockDetectorStateHandler)

        class HandlerUpdateGroupType(GroupType):
            type_id = 4
            slug = "handler_update"
            description = "handler update"
            category = GroupCategory.METRIC_ALERT.value
            detector_settings = DetectorSettings(handler=MockDetectorWithUpdateHandler)

        self.no_handler_type = NoHandlerGroupType
        self.handler_type = HandlerGroupType
        self.handler_state_type = HandlerStateGroupType
        self.update_handler_type = HandlerUpdateGroupType

    def tearDown(self):
        super().tearDown()
        self.uuid_patcher.stop()
        self.sm_comp_patcher.stop()

    def create_detector_and_conditions(self, type: str | None = None):
        if type is None:
            type = "handler_with_state"
        self.project = self.create_project()
        detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=type,
        )
        self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=detector.workflow_condition_group,
        )
        return detector

    def build_handler(
        self, detector: Detector | None = None, detector_type=None
    ) -> MockDetectorStateHandler:
        if detector is None:
            detector = self.create_detector_and_conditions(detector_type)
        return MockDetectorStateHandler(detector)

    def assert_updates(self, handler, group_key, dedupe_value, counter_updates, active, priority):
        if dedupe_value is not None:
            assert handler.dedupe_updates.get(group_key) == dedupe_value
        else:
            assert group_key not in handler.dedupe_updates
        if counter_updates is not None:
            assert handler.counter_updates.get(group_key) == counter_updates
        else:
            assert group_key not in handler.counter_updates
        if active is not None or priority is not None:
            assert handler.state_updates.get(group_key) == (active, priority)
        else:
            assert group_key not in handler.state_updates

    def detector_to_issue_occurrence(
        self,
        detector_occurrence: DetectorOccurrence,
        detector: Detector,
        group_key: DetectorGroupKey,
        value: int,
        priority: DetectorPriorityLevel,
        detection_time: datetime,
        occurrence_id: str,
    ) -> tuple[IssueOccurrence, dict[str, Any]]:
        fingerprint = [f"{detector.id}{':' + group_key if group_key is not None else ''}"]
        evidence_data = {
            **detector_occurrence.evidence_data,
            "detector_id": detector.id,
            "value": value,
        }
        issue_occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id,
            detector.project_id,
            priority,
            detection_time,
            evidence_data,
            fingerprint,
        )
        event_data: dict[str, Any] = {}
        if hasattr(detector_occurrence, "event_data"):
            event_data = (
                detector_occurrence.event_data.copy() if detector_occurrence.event_data else {}
            )

        event_data["timestamp"] = detection_time
        event_data["project_id"] = detector.project_id
        event_data["event_id"] = occurrence_id
        event_data.setdefault("platform", "python")
        event_data.setdefault("received", detection_time)
        event_data.setdefault("tags", {})
        return issue_occurrence, event_data

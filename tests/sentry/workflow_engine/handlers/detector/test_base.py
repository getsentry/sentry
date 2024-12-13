from datetime import datetime, timezone
from typing import Any
from unittest import mock

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.abstract import Abstract
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import DetectorEvaluationResult, DetectorHandler
from sentry.workflow_engine.handlers.detector.stateful import StatefulDetectorHandler
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest


def build_mock_occurrence_and_event(
    handler: StatefulDetectorHandler,
    group_key: DetectorGroupKey,
    value: int,
    new_status: PriorityLevel,
) -> tuple[IssueOccurrence, dict[str, Any]]:
    assert handler.detector.group_type is not None
    occurrence = IssueOccurrence(
        id="eb4b0acffadb4d098d48cb14165ab578",
        project_id=handler.detector.project_id,
        event_id="43878ab4419f4ab181f6379ac376d5aa",
        fingerprint=handler.build_fingerprint(group_key),
        issue_title="Some Issue",
        subtitle="Some subtitle",
        resource_id=None,
        evidence_data={},
        evidence_display=[],
        type=handler.detector.group_type,
        detection_time=datetime.now(timezone.utc),
        level="error",
        culprit="Some culprit",
        initial_issue_priority=new_status.value,
    )
    event_data = {
        "timestamp": occurrence.detection_time,
        "project_id": occurrence.project_id,
        "event_id": occurrence.event_id,
        "platform": "python",
        "received": occurrence.detection_time,
        "tags": {},
    }
    return occurrence, event_data


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
        self, group_key: DetectorGroupKey, value: int, new_status: PriorityLevel
    ) -> tuple[IssueOccurrence, dict[str, Any]]:
        return build_mock_occurrence_and_event(self, group_key, value, new_status)


class BaseDetectorHandlerTest(BaseGroupTypeTest):
    __test__ = Abstract(__module__, __qualname__)

    def setUp(self):
        super().setUp()
        self.sm_comp_patcher = mock.patch.object(
            StatusChangeMessage, "__eq__", status_change_comparator
        )
        self.sm_comp_patcher.__enter__()

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

        class HandlerGroupType(GroupType):
            type_id = 2
            slug = "handler"
            description = "handler"
            category = GroupCategory.METRIC_ALERT.value
            detector_handler = MockDetectorHandler

        class HandlerStateGroupType(GroupType):
            type_id = 3
            slug = "handler_with_state"
            description = "handler with state"
            category = GroupCategory.METRIC_ALERT.value
            detector_handler = MockDetectorStateHandler

        self.no_handler_type = NoHandlerGroupType
        self.handler_type = HandlerGroupType
        self.handler_state_type = HandlerStateGroupType

    def tearDown(self):
        super().tearDown()
        self.sm_comp_patcher.__exit__(None, None, None)

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
            condition="gt",
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

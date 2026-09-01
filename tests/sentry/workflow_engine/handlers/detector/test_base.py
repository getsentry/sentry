from typing import Any
from unittest import mock
from uuid import UUID

import pytest

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, _prepare_occurrence_message
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.abstract import Abstract
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import (
    BaseDetectorHandler,
    ConditionDetectorHandler,
    DataPacketEvaluationType,
    DetectorHandler,
    DetectorOccurrence,
    GroupedDetectorEvaluationResult,
    StatefulDetectorHandler,
)
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.handlers.detector.stateful import DetectorCounters
from sentry.workflow_engine.models import DataConditionGroup, DataPacket, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors import (
    CustomDetectorEvaluation,
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    DetectorEvaluation,
)
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
from sentry.workflow_engine.processors.evaluations.detector import CustomDetectorEvaluationArtifact
from sentry.workflow_engine.types import (
    ConditionError,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorResult,
    DetectorSettings,
)
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest


def build_mock_group_evaluation() -> DataConditionGroupEvaluation:
    """A minimal trigger-group evaluation for use in mock detector evaluations."""
    return DataConditionGroupEvaluation(
        result=True,
        triggered=True,
        data={"condition_evaluations": [], "logic_type": "any"},
    )


def build_mock_occurrence_and_event(
    handler: BaseDetectorHandler[Any, Any, Any],
    value: DataPacketEvaluationType,
    priority: PriorityLevel,
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


def status_change_comparator(self: StatusChangeMessage, other: StatusChangeMessage) -> bool:
    return (
        isinstance(other, StatusChangeMessage)
        and self.fingerprint == other.fingerprint
        and self.project_id == other.project_id
        and self.new_status == other.new_status
        and self.new_substatus == other.new_substatus
    )


class MockDetectorStateHandler(StatefulDetectorHandler[dict[str, Any], int | None]):
    def test_get_empty_counter_state(self) -> dict[Any, int | None]:
        return {name: None for name in self.state_manager.counter_names}

    def extract_dedupe_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
        return data_packet.packet.get("dedupe", 0)

    def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
        if data_packet.packet.get("value"):
            return data_packet.packet["value"]

        return data_packet.packet.get("group_vals", 0)

    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        value = self.extract_value(data_packet)
        return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))


class MockDefaultConditionDetectorHandler(ConditionDetectorHandler[dict[str, Any], int]):
    """Relies on the default `evaluate` flow; it only fills in the hooks."""

    def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
        return data_packet.packet["value"]

    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        value = self.extract_value(data_packet)
        return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))


class MockFingerprintedConditionDetectorHandler(MockDefaultConditionDetectorHandler):
    """Replaces the fingerprint the default `evaluate` would build."""

    def get_issue_fingerprint(self) -> list[str]:
        return ["mock-fingerprint"]


class MockEventIdConditionDetectorHandler(MockDefaultConditionDetectorHandler):
    """Supplies its own event id from `create_occurrence`, as preprod size analysis does."""

    event_id = "0123456789abcdef0123456789abcdef"

    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        detector_occurrence, event_data = super().create_occurrence(
            evaluation, data_packet, priority
        )
        event_data["event_id"] = self.event_id
        return detector_occurrence, event_data


class MockOccurrenceIdConditionDetectorHandler(MockDefaultConditionDetectorHandler):
    """Supplies the occurrence id through the hook rather than through event data."""

    occurrence_id = "11111111111111111111111111111111"

    def get_occurrence_id(self, event_data: EventData) -> str:
        return self.occurrence_id


class MockGroupedConditionDetectorHandler(ConditionDetectorHandler[dict[str, Any], int]):
    """Returns grouped values, which the default `evaluate` does not support."""

    def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> dict[DetectorGroupKey, int]:
        return {"group-one": data_packet.packet["value"]}

    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        raise AssertionError("grouped values must bail before create_occurrence")


class MockDetectorHandler(DetectorHandler[dict[str, Any], int, CustomDetectorEvaluation]):
    """
    Decides without a data condition group, and relies on the default `evaluate`.

    Any value above zero triggers; the detector it runs on has no condition group at all.
    """

    def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
        return data_packet.packet["value"]

    def evaluate_extracted_value(
        self, extracted_value: int
    ) -> tuple[CustomDetectorEvaluation | None, DetectorPriorityLevel]:
        priority = DetectorPriorityLevel.HIGH if extracted_value > 0 else DetectorPriorityLevel.OK

        return (
            CustomDetectorEvaluation(
                result=priority != DetectorPriorityLevel.OK,
                data={"value": extracted_value},
                triggered=priority != DetectorPriorityLevel.OK,
            ),
            priority,
        )

    def create_occurrence(
        self,
        evaluation: CustomDetectorEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        value = self.extract_value(data_packet)
        return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))


class MockUndecidedDetectorHandler(MockDetectorHandler):
    """Reaches no decision at all, the way a misconfigured detector would."""

    def evaluate_extracted_value(
        self, extracted_value: int
    ) -> tuple[CustomDetectorEvaluation | None, DetectorPriorityLevel]:
        return None, DetectorPriorityLevel.OK


class MockTaintedDetectorHandler(MockDetectorHandler):
    """Triggers, but carries an error that should taint the result."""

    def evaluate_extracted_value(
        self, extracted_value: int
    ) -> tuple[CustomDetectorEvaluation | None, DetectorPriorityLevel]:
        return (
            CustomDetectorEvaluation(
                result=True,
                data={"value": extracted_value},
                triggered=True,
                error=ConditionError(msg="decision blew up"),
            ),
            DetectorPriorityLevel.HIGH,
        )


class MockFingerprintedDetectorHandler(MockDetectorHandler):
    """Replaces the fingerprint the default `evaluate` would build."""

    def get_issue_fingerprint(self) -> list[str]:
        return ["mock-detector-fingerprint"]


class MockGroupedDetectorHandler(DetectorHandler[dict[str, Any], int, CustomDetectorEvaluation]):
    """Returns grouped values, which the default `evaluate` does not support."""

    def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> dict[DetectorGroupKey, int]:
        return {"group-one": data_packet.packet["value"]}

    def evaluate_extracted_value(
        self, extracted_value: int
    ) -> tuple[CustomDetectorEvaluation | None, DetectorPriorityLevel]:
        raise AssertionError("grouped values must bail before evaluate_extracted_value")

    def create_occurrence(
        self,
        evaluation: CustomDetectorEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        raise AssertionError("grouped values must bail before create_occurrence")


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
            category = GroupCategory.METRIC.value

        class MockConditionDetectorHandler(ConditionDetectorHandler[dict[str, Any], int]):
            def evaluate(
                self, data_packet: DataPacket[dict[str, Any]]
            ) -> GroupedDetectorEvaluationResult:
                return GroupedDetectorEvaluationResult(
                    result={
                        None: DetectorEvaluation(
                            result=None,
                            data=DetectorEvaluationData(
                                group_key=None,
                                trigger_group_evaluation=build_mock_group_evaluation(),
                                event_data=None,
                            ),
                            triggered=True,
                            priority=DetectorPriorityLevel.HIGH,
                        )
                    },
                    tainted=False,
                )

            def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
                return data_packet.packet.get("value", 0)

            def create_occurrence(
                self,
                evaluation: DataConditionGroupEvaluation,
                data_packet: DataPacket[dict[str, Any]],
                priority: DetectorPriorityLevel,
            ) -> tuple[DetectorOccurrence, dict[str, Any]]:
                value = self.extract_value(data_packet)
                return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))

        class MockConditionDetectorWithUpdateHandler(ConditionDetectorHandler[dict[str, Any], int]):
            def evaluate(
                self, data_packet: DataPacket[dict[str, Any]]
            ) -> GroupedDetectorEvaluationResult:
                status_change = StatusChangeMessage(
                    "test_update",
                    project_id,
                    DetectorPriorityLevel.HIGH,
                    None,
                )

                return GroupedDetectorEvaluationResult(
                    result={
                        None: DetectorEvaluation(
                            result=status_change,
                            data=DetectorEvaluationData(
                                group_key=None,
                                trigger_group_evaluation=build_mock_group_evaluation(),
                                event_data=None,
                            ),
                            triggered=True,
                            priority=DetectorPriorityLevel.HIGH,
                        )
                    },
                    tainted=False,
                )

            def create_occurrence(
                self,
                evaluation: DataConditionGroupEvaluation,
                data_packet: DataPacket[dict[str, Any]],
                priority: DetectorPriorityLevel,
            ) -> tuple[DetectorOccurrence, dict[str, Any]]:
                value = self.extract_value(data_packet)
                return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))

            def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
                return data_packet.packet.get("value", 0)

        class HandlerGroupType(GroupType):
            type_id = 2
            slug = "handler"
            description = "handler"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockConditionDetectorHandler)

        class HandlerStateGroupType(GroupType):
            type_id = 3
            slug = "handler_with_state"
            description = "handler with state"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDetectorStateHandler)

        class HandlerUpdateGroupType(GroupType):
            type_id = 4
            slug = "handler_update"
            description = "handler update"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockConditionDetectorWithUpdateHandler)

        self.no_handler_type = NoHandlerGroupType
        self.handler_type = HandlerGroupType
        self.handler_state_type = HandlerStateGroupType
        self.update_handler_type = HandlerUpdateGroupType

    def tearDown(self) -> None:
        super().tearDown()
        self.uuid_patcher.stop()
        self.sm_comp_patcher.stop()

    def create_detector_and_condition(self, type: str | None = None) -> tuple[Detector, Any]:
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
        self, detector: Detector | None = None, detector_type: str | None = None
    ) -> MockDetectorStateHandler:
        if detector is None:
            detector, _ = self.create_detector_and_condition(detector_type)
        return MockDetectorStateHandler(detector)

    def assert_updates(
        self,
        handler: StatefulDetectorHandler[Any, Any],
        group_key: DetectorGroupKey | None,
        dedupe_value: int | None,
        counter_updates: DetectorCounters | None,
        is_triggered: bool | None,
        priority: DetectorPriorityLevel | None,
    ) -> None:
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

    def assert_evaluation(
        self,
        evaluation: DetectorEvaluation,
        *,
        group_key: DetectorGroupKey,
        triggered: bool,
        priority: DetectorPriorityLevel,
        result: DetectorResult = None,
        event_data: dict[str, Any] | None = None,
    ) -> None:
        """
        Assert the meaningful fields of a DetectorEvaluation. We assert on fields
        rather than whole-object equality because the evaluation's `data` carries a
        DataConditionGroupEvaluation that is impractical to reconstruct in tests.
        """
        assert evaluation.data["group_key"] == group_key
        assert evaluation.triggered is triggered
        assert evaluation.priority == priority
        assert evaluation.result == result
        assert evaluation.data["event_data"] == event_data

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
        event_data.setdefault("environment", detector.config.get("environment"))
        event_data["timestamp"] = issue_occurrence.detection_time
        event_data["project_id"] = detector.project_id
        event_data["event_id"] = occurrence_id
        event_data.setdefault("platform", "python")
        event_data.setdefault("received", issue_occurrence.detection_time)
        event_data.setdefault("tags", {})
        return issue_occurrence, event_data


class TestConditionDetectorHandlerEvaluate(BaseGroupTypeTest):
    """
    Covers the default stateless `evaluate` flow, with ConditionDetectorHandler supplying
    `evaluate_extracted_value` from the detector's condition group.

    MockDefaultConditionDetectorHandler implements only `extract_value` and
    `create_occurrence`, so every assertion here is about the inherited orchestration.
    """

    def setUp(self) -> None:
        super().setUp()

        class DefaultConditionGroupType(GroupType):
            type_id = 5
            slug = "default_condition_handler"
            description = "default condition handler"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDefaultConditionDetectorHandler)

        self.group_type = DefaultConditionGroupType

        self.detector = self.create_detector_with_condition(
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.handler = MockDefaultConditionDetectorHandler(self.detector)

    def create_detector_with_condition(
        self,
        comparison: int,
        condition_result: Any,
    ) -> Detector:
        detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=self.group_type.slug,
        )

        self.create_data_condition(
            type=Condition.GREATER,
            comparison=comparison,
            condition_result=condition_result,
            condition_group=detector.workflow_condition_group,
        )

        return detector

    def packet(self, value: int) -> DataPacket[dict[str, Any]]:
        return DataPacket(source_id=str(self.detector.id), packet={"value": value})

    def evaluate_triggered(self, value: int = 10) -> DetectorEvaluation:
        result = self.handler.evaluate(self.packet(value))

        assert list(result.result.keys()) == [None]

        return result.result[None]

    def test_evaluate__creates_occurrence_when_triggered(self) -> None:
        result = self.handler.evaluate(self.packet(10))

        assert result.tainted is False
        assert list(result.result.keys()) == [None]

        evaluation = result.result[None]

        assert isinstance(evaluation.result, IssueOccurrence)
        assert evaluation.triggered is True
        assert evaluation.priority == DetectorPriorityLevel.HIGH

    def test_evaluate__no_result_when_not_triggered(self) -> None:
        result = self.handler.evaluate(self.packet(1))

        assert result.result == {}
        assert result.tainted is False

    def test_evaluate__no_result_without_condition_group(self) -> None:
        detector = self.create_detector(project=self.project, type=self.group_type.slug)
        handler = MockDefaultConditionDetectorHandler(detector)

        assert handler.evaluate(self.packet(10)).result == {}

    def test_evaluate__uses_highest_triggered_priority(self) -> None:
        self.create_data_condition(
            type=Condition.GREATER,
            comparison=1,
            condition_result=DetectorPriorityLevel.LOW,
            condition_group=self.detector.workflow_condition_group,
        )

        assert self.evaluate_triggered().priority == DetectorPriorityLevel.HIGH

    def test_evaluate__no_result_when_conditions_carry_no_priority(self) -> None:
        detector = self.create_detector_with_condition(comparison=5, condition_result=True)
        handler = MockDefaultConditionDetectorHandler(detector)

        assert handler.evaluate(self.packet(10)).result == {}

    def test_evaluate__group_key_is_none(self) -> None:
        assert self.evaluate_triggered().data["group_key"] is None

    def test_evaluate__default_fingerprint(self) -> None:
        occurrence = self.evaluate_triggered().result

        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.fingerprint == [f"detector:{self.detector.id}"]

    def test_evaluate__custom_fingerprint(self) -> None:
        handler = MockFingerprintedConditionDetectorHandler(self.detector)

        evaluation = handler.evaluate(self.packet(10)).result[None]
        occurrence = evaluation.result

        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.fingerprint == ["mock-fingerprint"]

    def test_evaluate__event_data_matches_occurrence(self) -> None:
        evaluation = self.evaluate_triggered()
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None
        assert event_data["event_id"] == occurrence.event_id
        assert event_data["project_id"] == self.detector.project_id
        assert event_data["timestamp"] == occurrence.detection_time
        assert event_data["received"] == occurrence.detection_time
        assert event_data["environment"] is None
        assert event_data["platform"] == "python"
        assert event_data["tags"] == {}

    def test_evaluate__preserves_event_id_from_create_occurrence(self) -> None:
        handler = MockEventIdConditionDetectorHandler(self.detector)

        evaluation = handler.evaluate(self.packet(10)).result[None]
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None
        assert occurrence.event_id == MockEventIdConditionDetectorHandler.event_id
        assert event_data["event_id"] == MockEventIdConditionDetectorHandler.event_id

    def test_evaluate__produces_valid_issue_platform_payload(self) -> None:
        evaluation = self.evaluate_triggered()
        occurrence = evaluation.result

        assert isinstance(occurrence, IssueOccurrence)

        # Raises when the occurrence and event data disagree on the event id.
        payload = _prepare_occurrence_message(occurrence, evaluation.data["event_data"])

        assert payload is not None
        assert payload["event"]["event_id"] == occurrence.event_id

    def test_evaluate__propagates_taint(self) -> None:
        condition = self.detector.get_conditions()[0]
        tainted_evaluation = DataConditionGroupEvaluation(
            result=True,
            triggered=True,
            error=ConditionError(msg="condition blew up"),
            data={
                "condition_evaluations": [
                    DataConditionEvaluation(
                        result=DetectorPriorityLevel.HIGH,
                        data=10,
                        triggered=True,
                        condition=condition,
                    )
                ],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.base.process_data_condition_group",
            return_value=(tainted_evaluation, []),
        ):
            result = self.handler.evaluate(self.packet(10))

        assert result.tainted is True
        assert result.result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate__generates_occurrence_id_when_absent(self) -> None:
        first = self.evaluate_triggered().result
        second = self.evaluate_triggered().result

        assert isinstance(first, IssueOccurrence)
        assert isinstance(second, IssueOccurrence)

        # create_occurrence supplies no event id, so the hook mints a fresh one each time.
        assert UUID(first.event_id) != UUID(second.event_id)

    def test_evaluate__uses_occurrence_id_hook(self) -> None:
        handler = MockOccurrenceIdConditionDetectorHandler(self.detector)

        evaluation = handler.evaluate(self.packet(10)).result[None]
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None
        assert occurrence.event_id == MockOccurrenceIdConditionDetectorHandler.occurrence_id
        assert event_data["event_id"] == MockOccurrenceIdConditionDetectorHandler.occurrence_id

    def test_evaluate__warns_when_extract_value_returns_grouped_values(self) -> None:
        handler = MockGroupedConditionDetectorHandler(self.detector)

        with mock.patch("sentry.workflow_engine.handlers.detector.base.logger") as mock_logger:
            result = handler.evaluate(self.packet(10))

        assert result.result == {}
        assert result.tainted is False

        assert mock_logger.warning.call_count == 1
        assert "override the evaluate method" in mock_logger.warning.call_args[0][0]

    def test_evaluate__warns_when_slow_conditions_remain(self) -> None:
        self.create_data_condition(
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 7},
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )

        with mock.patch("sentry.workflow_engine.handlers.detector.base.logger") as mock_logger:
            result = self.handler.evaluate(self.packet(1))

        assert result.result == {}

        mock_logger.warning.assert_called_once_with(
            "Slow conditions present for detector",
            extra={
                "detector_id": self.detector.id,
                "condition_group_id": self.detector.workflow_condition_group_id,
            },
        )

    def test__evaluate__returns_the_evaluation_map(self) -> None:
        result = self.handler._evaluate(self.packet(10))

        assert list(result.keys()) == [None]
        assert isinstance(result[None].result, IssueOccurrence)


class TestDetectorHandlerEvaluate(BaseGroupTypeTest):
    """
    Covers the default `evaluate` flow as it runs on DetectorHandler, which reaches its
    decision without any DataConditionGroup.

    The detector under test deliberately has no `workflow_condition_group`, so anything
    that passes here is orchestration that never touched conditions.
    """

    def setUp(self) -> None:
        super().setUp()

        class ConditionFreeGroupType(GroupType):
            type_id = 6
            slug = "condition_free_handler"
            description = "condition free handler"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDetectorHandler)

        self.group_type = ConditionFreeGroupType

        self.detector = self.create_detector(project=self.project, type=self.group_type.slug)

        self.handler = MockDetectorHandler(self.detector)

    def packet(self, value: int) -> DataPacket[dict[str, Any]]:
        return DataPacket(source_id=str(self.detector.id), packet={"value": value})

    def evaluate_triggered(self, value: int = 1) -> DetectorEvaluation:
        result = self.handler.evaluate(self.packet(value))

        assert list(result.result.keys()) == [None]

        return result.result[None]

    def test_detector_has_no_condition_group(self) -> None:
        assert self.detector.workflow_condition_group is None
        assert not hasattr(self.handler, "condition_group")

    def test_evaluate__creates_occurrence_when_triggered(self) -> None:
        result = self.handler.evaluate(self.packet(1))

        assert result.tainted is False
        assert list(result.result.keys()) == [None]

        evaluation = result.result[None]

        assert isinstance(evaluation.result, IssueOccurrence)
        assert evaluation.triggered is True
        assert evaluation.priority == DetectorPriorityLevel.HIGH

    def test_evaluate__no_result_when_not_triggered(self) -> None:
        result = self.handler.evaluate(self.packet(0))

        assert result.result == {}
        assert result.tainted is False

    def test_evaluate__no_result_when_undecided(self) -> None:
        handler = MockUndecidedDetectorHandler(self.detector)

        result = handler.evaluate(self.packet(1))

        assert result.result == {}
        assert result.tainted is False

    def test_evaluate__group_key_is_none(self) -> None:
        assert self.evaluate_triggered().data["group_key"] is None

    def test_evaluate__carries_the_trigger_evaluation(self) -> None:
        trigger_evaluation = self.evaluate_triggered().data["trigger_group_evaluation"]

        assert isinstance(trigger_evaluation, CustomDetectorEvaluation)
        assert trigger_evaluation.result is True
        assert trigger_evaluation.data == {"value": 1}

    def test_evaluate__trigger_evaluation_is_loggable(self) -> None:
        artifact = self.evaluate_triggered().to_artifact()

        assert artifact.trigger_evaluation == CustomDetectorEvaluationArtifact(
            triggered=True,
            error=None,
            result=True,
            data={"value": 1},
        )

    def test_evaluate__default_fingerprint(self) -> None:
        occurrence = self.evaluate_triggered().result

        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.fingerprint == [f"detector:{self.detector.id}"]

    def test_evaluate__custom_fingerprint(self) -> None:
        handler = MockFingerprintedDetectorHandler(self.detector)

        occurrence = handler.evaluate(self.packet(1)).result[None].result

        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.fingerprint == ["mock-detector-fingerprint"]

    def test_evaluate__event_data_matches_occurrence(self) -> None:
        evaluation = self.evaluate_triggered()
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None
        assert event_data["event_id"] == occurrence.event_id
        assert event_data["project_id"] == self.detector.project_id
        assert event_data["timestamp"] == occurrence.detection_time
        assert event_data["received"] == occurrence.detection_time
        assert event_data["environment"] is None
        assert event_data["platform"] == "python"
        assert event_data["tags"] == {}

    def test_evaluate__produces_valid_issue_platform_payload(self) -> None:
        evaluation = self.evaluate_triggered()
        occurrence = evaluation.result

        assert isinstance(occurrence, IssueOccurrence)

        # Raises when the occurrence and event data disagree on the event id.
        payload = _prepare_occurrence_message(occurrence, evaluation.data["event_data"])

        assert payload is not None
        assert payload["event"]["event_id"] == occurrence.event_id

    def test_evaluate__generates_occurrence_id_when_absent(self) -> None:
        first = self.evaluate_triggered().result
        second = self.evaluate_triggered().result

        assert isinstance(first, IssueOccurrence)
        assert isinstance(second, IssueOccurrence)

        assert UUID(first.event_id) != UUID(second.event_id)

    def test_evaluate__propagates_taint(self) -> None:
        handler = MockTaintedDetectorHandler(self.detector)

        result = handler.evaluate(self.packet(1))

        assert result.tainted is True
        assert result.result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate__warns_when_extract_value_returns_grouped_values(self) -> None:
        handler = MockGroupedDetectorHandler(self.detector)

        with mock.patch("sentry.workflow_engine.handlers.detector.base.logger") as mock_logger:
            result = handler.evaluate(self.packet(1))

        assert result.result == {}
        assert result.tainted is False

        assert mock_logger.warning.call_count == 1
        assert "override the evaluate method" in mock_logger.warning.call_args[0][0]

    def test__evaluate__returns_the_evaluation_map(self) -> None:
        result = self.handler._evaluate(self.packet(1))

        assert list(result.keys()) == [None]
        assert isinstance(result[None].result, IssueOccurrence)

    def test__evaluate__records_the_evaluation_metric(self) -> None:
        with mock.patch("sentry.workflow_engine.handlers.detector.base.metrics.incr") as mock_incr:
            self.handler._evaluate(self.packet(1))

        mock_incr.assert_called_once_with(
            "workflow_engine_detector.evaluation",
            tags={"detector_type": self.group_type.slug, "result": "success"},
            sample_rate=1.0,
        )

    def test__evaluate__records_a_failure_metric(self) -> None:
        with mock.patch.object(
            MockDetectorHandler, "extract_value", side_effect=ValueError("boom")
        ):
            with mock.patch(
                "sentry.workflow_engine.handlers.detector.base.metrics.incr"
            ) as mock_incr:
                with pytest.raises(ValueError):
                    self.handler._evaluate(self.packet(1))

        assert mock_incr.call_args.kwargs["tags"]["result"] == "failure"

    def test_handler_resolves_from_the_group_type_registry(self) -> None:
        assert isinstance(self.detector.detector_handler, MockDetectorHandler)


class MockIntDetectorHandler(DetectorHandler[int, int, CustomDetectorEvaluation]):
    """
    Triggers on any data packet carrying an integer above the threshold.

    The threshold lives on the handler rather than in a DataConditionGroup, so this
    detector reaches its decision without touching the database.
    """

    threshold = 10

    def extract_value(self, data_packet: DataPacket[int]) -> int:
        return data_packet.packet

    def evaluate_extracted_value(
        self, extracted_value: int
    ) -> tuple[CustomDetectorEvaluation | None, DetectorPriorityLevel]:
        priority = (
            DetectorPriorityLevel.HIGH
            if extracted_value > self.threshold
            else DetectorPriorityLevel.OK
        )

        return (
            CustomDetectorEvaluation(
                result=priority != DetectorPriorityLevel.OK,
                data={"value": extracted_value, "threshold": self.threshold},
                triggered=priority != DetectorPriorityLevel.OK,
            ),
            priority,
        )

    def create_occurrence(
        self,
        evaluation: CustomDetectorEvaluation,
        data_packet: DataPacket[int],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        assert self.detector.group_type is not None

        return (
            DetectorOccurrence(
                issue_title="Value above threshold",
                subtitle=f"{evaluation.data['value']} is above {evaluation.data['threshold']}",
                type=self.detector.group_type,
                level="error",
                culprit="",
            ),
            {},
        )


class TestMockIntDetectorHandler(BaseGroupTypeTest):
    """
    End to end proof that a condition-free DetectorHandler works: a detector with no
    condition group, driven by integer data packets, reaching the issue platform.
    """

    def setUp(self) -> None:
        super().setUp()

        class IntThresholdGroupType(GroupType):
            type_id = 7
            slug = "int_threshold"
            description = "int threshold"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockIntDetectorHandler)

        self.group_type = IntThresholdGroupType

        self.detector = self.create_detector(project=self.project, type=self.group_type.slug)

        self.handler = MockIntDetectorHandler(self.detector)

    def packet(self, value: int) -> DataPacket[int]:
        return DataPacket(source_id=str(self.detector.id), packet=value)

    def test_evaluate__triggers_above_the_threshold(self) -> None:
        result = self.handler.evaluate(self.packet(11))

        evaluation = result.result[None]

        assert isinstance(evaluation.result, IssueOccurrence)
        assert evaluation.triggered is True
        assert evaluation.priority == DetectorPriorityLevel.HIGH

    def test_evaluate__does_nothing_at_the_threshold(self) -> None:
        assert self.handler.evaluate(self.packet(10)).result == {}

    def test_evaluate__does_nothing_below_the_threshold(self) -> None:
        assert self.handler.evaluate(self.packet(0)).result == {}

    def test_evaluate__does_nothing_for_negative_values(self) -> None:
        assert self.handler.evaluate(self.packet(-100)).result == {}

    def test_evaluate__occurrence_describes_the_value(self) -> None:
        occurrence = self.handler.evaluate(self.packet(42)).result[None].result

        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.issue_title == "Value above threshold"
        assert occurrence.subtitle == "42 is above 10"
        assert occurrence.fingerprint == [f"detector:{self.detector.id}"]

    def test_evaluate__records_the_decision_for_logging(self) -> None:
        evaluation = self.handler.evaluate(self.packet(42)).result[None]

        assert evaluation.to_artifact().trigger_evaluation == CustomDetectorEvaluationArtifact(
            triggered=True,
            error=None,
            result=True,
            data={"value": 42, "threshold": 10},
        )

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    def test_process_detectors__sends_the_occurrence_to_the_issue_platform(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        results = process_detectors(self.packet(11), [self.detector])

        assert len(results) == 1

        detector, evaluations = results[0]

        assert detector == self.detector

        occurrence = evaluations[None].result

        assert isinstance(occurrence, IssueOccurrence)

        mock_produce_occurrence_to_kafka.assert_called_once_with(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            status_change=None,
            event_data=evaluations[None].data["event_data"],
        )

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    def test_process_detectors__sends_nothing_below_the_threshold(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        assert process_detectors(self.packet(3), [self.detector]) == []

        assert mock_produce_occurrence_to_kafka.call_count == 0

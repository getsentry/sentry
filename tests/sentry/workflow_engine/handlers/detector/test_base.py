from typing import Any
from unittest import mock
from uuid import UUID

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import _prepare_occurrence_message
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.abstract import Abstract
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import (
    BaseDetectorHandler,
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
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    DetectorEvaluation,
)
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
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
    handler: BaseDetectorHandler[Any, Any],
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
        evaluation_result: DataConditionGroupEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        value = self.extract_value(data_packet)
        return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))


class MockDefaultDetectorHandler(DetectorHandler[dict[str, Any], int]):
    """Relies on DetectorHandler's default `evaluate`; it only fills in the hooks."""

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


class MockFingerprintedDetectorHandler(MockDefaultDetectorHandler):
    """Replaces the fingerprint the default `evaluate` would build."""

    def get_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        return ["mock-fingerprint"]


class MockEventIdDetectorHandler(MockDefaultDetectorHandler):
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


class MockOccurrenceIdDetectorHandler(MockDefaultDetectorHandler):
    """Supplies the occurrence id through the hook rather than through event data."""

    occurrence_id = "11111111111111111111111111111111"

    def get_occurrence_id(self, event_data: EventData) -> str:
        return self.occurrence_id


class MockGroupedDetectorHandler(DetectorHandler[dict[str, Any], int]):
    """Returns a value per group key, which the default `evaluate` evaluates group by group."""

    def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> dict[DetectorGroupKey, int]:
        return data_packet.packet["values"]

    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[dict[str, Any]],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        values = self.extract_value(data_packet)
        return build_mock_occurrence_and_event(self, values, PriorityLevel(priority))


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

        class MockDetectorHandler(DetectorHandler[dict[str, Any], int]):
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
                evaluation_result: DataConditionGroupEvaluation,
                data_packet: DataPacket[dict[str, Any]],
                priority: DetectorPriorityLevel,
            ) -> tuple[DetectorOccurrence, dict[str, Any]]:
                value = self.extract_value(data_packet)
                return build_mock_occurrence_and_event(self, value, PriorityLevel(priority))

        class MockDetectorWithUpdateHandler(DetectorHandler[dict[str, Any], int]):
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
                evaluation_result: DataConditionGroupEvaluation,
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
            detector_settings = DetectorSettings(handler=MockDetectorHandler)

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
            detector_settings = DetectorSettings(handler=MockDetectorWithUpdateHandler)

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


class TestDetectorHandlerEvaluate(BaseGroupTypeTest):
    """
    Covers the default stateless `evaluate` that DetectorHandler provides.

    MockDefaultDetectorHandler implements only `extract_value` and
    `create_occurrence`, so every assertion here is about the inherited orchestration.
    """

    def setUp(self) -> None:
        super().setUp()

        class DefaultConditionGroupType(GroupType):
            type_id = 5
            slug = "default_condition_handler"
            description = "default condition handler"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockDefaultDetectorHandler)

        self.group_type = DefaultConditionGroupType

        self.detector = self.create_detector_with_condition(
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.handler = MockDefaultDetectorHandler(self.detector)

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
        handler = MockDefaultDetectorHandler(detector)

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
        handler = MockDefaultDetectorHandler(detector)

        assert handler.evaluate(self.packet(10)).result == {}

    def test_evaluate__group_key_is_none(self) -> None:
        assert self.evaluate_triggered().data["group_key"] is None

    def test_evaluate__default_fingerprint(self) -> None:
        occurrence = self.evaluate_triggered().result

        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.fingerprint == [f"detector:{self.detector.id}"]

    def test_evaluate__custom_fingerprint(self) -> None:
        handler = MockFingerprintedDetectorHandler(self.detector)

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
        handler = MockEventIdDetectorHandler(self.detector)

        evaluation = handler.evaluate(self.packet(10)).result[None]
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None
        assert occurrence.event_id == MockEventIdDetectorHandler.event_id
        assert event_data["event_id"] == MockEventIdDetectorHandler.event_id

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
        handler = MockOccurrenceIdDetectorHandler(self.detector)

        evaluation = handler.evaluate(self.packet(10)).result[None]
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None
        assert occurrence.event_id == MockOccurrenceIdDetectorHandler.occurrence_id
        assert event_data["event_id"] == MockOccurrenceIdDetectorHandler.occurrence_id

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


class TestDetectorHandlerGroupedEvaluate(BaseGroupTypeTest):
    """
    Covers the default `evaluate` when `extract_value` returns a value per group key.

    Every group is evaluated against the same condition group, and each group that
    triggers contributes its own entry to the returned evaluation map.
    """

    def setUp(self) -> None:
        super().setUp()

        class GroupedConditionGroupType(GroupType):
            type_id = 6
            slug = "grouped_condition_handler"
            description = "grouped condition handler"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=MockGroupedDetectorHandler)

        self.group_type = GroupedConditionGroupType

        self.detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=self.group_type.slug,
        )

        self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )

        self.handler = MockGroupedDetectorHandler(self.detector)

    def packet(self, values: dict[DetectorGroupKey, int]) -> DataPacket[dict[str, Any]]:
        return DataPacket(source_id=str(self.detector.id), packet={"values": values})

    def build_condition_group_evaluation(
        self, *, triggered: bool, error: ConditionError | None = None
    ) -> DataConditionGroupEvaluation:
        condition = self.detector.get_conditions()[0]

        return DataConditionGroupEvaluation(
            result=triggered,
            triggered=triggered,
            error=error,
            data={
                "condition_evaluations": [
                    DataConditionEvaluation(
                        result=DetectorPriorityLevel.HIGH,
                        data=10,
                        triggered=triggered,
                        condition=condition,
                    )
                ],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )

    def test_evaluate__creates_an_occurrence_for_each_triggered_group(self) -> None:
        result = self.handler.evaluate(self.packet({"group-one": 10, "group-two": 20}))

        assert set(result.result.keys()) == {"group-one", "group-two"}
        assert result.tainted is False

        first = result.result["group-one"]
        second = result.result["group-two"]

        assert isinstance(first.result, IssueOccurrence)
        assert first.triggered is True
        assert first.priority == DetectorPriorityLevel.HIGH

        assert isinstance(second.result, IssueOccurrence)
        assert second.triggered is True
        assert second.priority == DetectorPriorityLevel.HIGH

    def test_evaluate__carries_the_group_key_into_each_evaluation(self) -> None:
        result = self.handler.evaluate(self.packet({"group-one": 10, "group-two": 20}))

        assert result.result["group-one"].data["group_key"] == "group-one"
        assert result.result["group-two"].data["group_key"] == "group-two"

    def test_evaluate__only_returns_the_groups_that_triggered(self) -> None:
        result = self.handler.evaluate(self.packet({"loud": 10, "quiet": 1}))

        assert set(result.result.keys()) == {"loud"}

    def test_evaluate__no_result_when_no_group_triggers(self) -> None:
        result = self.handler.evaluate(self.packet({"group-one": 1, "group-two": 2}))

        assert result.result == {}
        assert result.tainted is False

    def test_evaluate__no_result_without_values(self) -> None:
        result = self.handler.evaluate(self.packet({}))

        assert result.result == {}
        assert result.tainted is False

    def test_evaluate__fingerprints_each_group_separately(self) -> None:
        result = self.handler.evaluate(self.packet({"group-one": 10, "group-two": 20}))

        first = result.result["group-one"].result
        second = result.result["group-two"].result

        assert isinstance(first, IssueOccurrence)
        assert isinstance(second, IssueOccurrence)

        assert first.fingerprint == [f"detector:{self.detector.id}:group-one"]
        assert second.fingerprint == [f"detector:{self.detector.id}:group-two"]

    def test_evaluate__each_group_gets_its_own_occurrence(self) -> None:
        result = self.handler.evaluate(self.packet({"group-one": 10, "group-two": 20}))

        first = result.result["group-one"].result
        second = result.result["group-two"].result

        assert isinstance(first, IssueOccurrence)
        assert isinstance(second, IssueOccurrence)

        assert UUID(first.event_id) != UUID(second.event_id)

    def test_evaluate__event_data_matches_each_groups_occurrence(self) -> None:
        result = self.handler.evaluate(self.packet({"group-one": 10, "group-two": 20}))

        occurrence = result.result["group-two"].result
        event_data = result.result["group-two"].data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None

        assert event_data["event_id"] == occurrence.event_id
        assert event_data["project_id"] == self.detector.project_id
        assert event_data["timestamp"] == occurrence.detection_time
        assert event_data["received"] == occurrence.detection_time
        assert event_data["environment"] is None
        assert event_data["platform"] == "python"
        assert event_data["tags"] == {}

    def test_evaluate__taints_the_result_when_any_group_is_tainted(self) -> None:
        clean_evaluation = self.build_condition_group_evaluation(triggered=False)

        tainted_evaluation = self.build_condition_group_evaluation(
            triggered=True, error=ConditionError(msg="condition blew up")
        )

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.base.process_data_condition_group",
            side_effect=[(clean_evaluation, []), (tainted_evaluation, [])],
        ):
            result = self.handler.evaluate(self.packet({"quiet": 1, "loud": 10}))

        assert result.tainted is True
        assert set(result.result.keys()) == {"loud"}

    def test__evaluate__returns_the_evaluation_map_for_every_group(self) -> None:
        result = self.handler._evaluate(self.packet({"group-one": 10, "group-two": 20}))

        assert set(result.keys()) == {"group-one", "group-two"}
        assert isinstance(result["group-one"].result, IssueOccurrence)
        assert isinstance(result["group-two"].result, IssueOccurrence)

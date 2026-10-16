from collections.abc import Mapping
from typing import Any
from unittest import mock
from uuid import UUID

from sentry.deletions.base import ModelRelation
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import _prepare_occurrence_message
from sentry.models.organization import Organization
from sentry.testutils.abstract import Abstract
from sentry.utils.registry import AlreadyRegisteredError
from sentry.workflow_engine.handlers.detector import (
    BaseDetectorHandler,
    DetectorEvaluations,
    DetectorGroupValues,
    DetectorHandler,
    DetectorOccurrence,
    StatefulDetectorHandler,
)
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models import DataConditionGroup, DataPacket, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    DetectorEvaluation,
)
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
from sentry.workflow_engine.registry import data_source_type_registry, detector_settings_registry
from sentry.workflow_engine.types import (
    ConditionError,
    DataConditionResult,
    DataSourceTypeHandler,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
)
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest

MOCK_DATA_SOURCE_TYPE = "detector_handler_test_source"

EVENT_ID = "0123456789abcdef0123456789abcdef"


class MockDataSourceTypeHandler(DataSourceTypeHandler[None]):
    """A data source type with no query object, so evidence data can be built without one."""

    @staticmethod
    def bulk_get_query_object(data_sources: list[DataSource]) -> dict[int, None]:
        return {data_source.id: None for data_source in data_sources}

    @staticmethod
    def related_model(instance: DataSource) -> list[ModelRelation]:
        return []

    @staticmethod
    def get_instance_limit(org: Organization) -> int | None:
        return None

    @staticmethod
    def get_current_instance_count(org: Organization) -> int:
        return 0

    @staticmethod
    def get_relocation_model_name() -> str:
        return "sentry.querysubscription"


try:
    data_source_type_registry.register(MOCK_DATA_SOURCE_TYPE)(MockDataSourceTypeHandler)
except AlreadyRegisteredError:
    # This module is imported under more than one name, but the registry is global.
    pass


def build_mock_group_evaluation() -> DataConditionGroupEvaluation:
    """A minimal trigger-group evaluation for use in mock detector evaluations."""
    return DataConditionGroupEvaluation(
        result=True,
        triggered=True,
        data={"condition_evaluations": [], "logic_type": "any"},
    )


def build_mock_occurrence_and_event(
    handler: BaseDetectorHandler[Any, Any],
) -> tuple[DetectorOccurrence, EventData]:
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


def assert_event_matches_occurrence(
    event_data: EventData | None,
    occurrence: IssueOccurrence,
) -> None:
    assert event_data is not None
    assert event_data["event_id"] == occurrence.event_id
    assert event_data["project_id"] == occurrence.project_id
    assert event_data["timestamp"] == occurrence.detection_time
    assert event_data["received"] == occurrence.detection_time
    assert event_data["environment"] is None
    assert event_data["platform"] == "python"
    assert event_data["tags"] == {}


class MockDetectorStateHandler(StatefulDetectorHandler[dict[str, Any], int | None]):
    """
    Packets carry a `dedupe` value, and either a single `value` or grouped `group_vals`.
    """

    def extract_dedupe_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
        return data_packet.packet.get("dedupe", 0)

    def extract_value(
        self, data_packet: DataPacket[dict[str, Any]]
    ) -> int | None | DetectorGroupValues[int | None]:
        if data_packet.packet.get("value"):
            return data_packet.packet["value"]

        group_vals = data_packet.packet.get("group_vals", 0)

        if isinstance(group_vals, dict):
            return DetectorGroupValues(group_vals)

        return group_vals

    def create_occurrence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[dict[str, Any]],
    ) -> tuple[DetectorOccurrence, EventData]:
        return build_mock_occurrence_and_event(self)


class MockTriggeredDetectorHandler(DetectorHandler[dict[str, Any], int]):
    """Triggers at HIGH for every packet, without evaluating its conditions."""

    def extract_value(self, data_packet: DataPacket[dict[str, Any]]) -> int:
        return data_packet.packet.get("value", 0)

    def evaluate(
        self,
        data_packet: DataPacket[dict[str, Any]],
        values: Mapping[DetectorGroupKey, int],
    ) -> DetectorEvaluations:
        return DetectorEvaluations(
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

    def create_occurrence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[dict[str, Any]],
    ) -> tuple[DetectorOccurrence, EventData]:
        return build_mock_occurrence_and_event(self)


class MockDefaultDetectorHandler(DetectorHandler[dict[str, Any], int]):
    """
    Relies on DetectorHandler's default `evaluate`; it only fills in the hooks.

    Packets carry either a single `value` or grouped `values`, and optionally the `event_id`
    that `create_occurrence` returns.
    """

    def extract_value(
        self, data_packet: DataPacket[dict[str, Any]]
    ) -> int | DetectorGroupValues[int]:
        if "values" in data_packet.packet:
            return DetectorGroupValues(data_packet.packet["values"])

        return data_packet.packet["value"]

    def create_occurrence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[dict[str, Any]],
    ) -> tuple[DetectorOccurrence, EventData]:
        detector_occurrence, event_data = build_mock_occurrence_and_event(self)

        if "event_id" in data_packet.packet:
            event_data["event_id"] = data_packet.packet["event_id"]

        return detector_occurrence, event_data


class MockFingerprintedDetectorHandler(MockDefaultDetectorHandler):
    def get_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        return ["mock-fingerprint"]


class MockOccurrenceIdDetectorHandler(MockDefaultDetectorHandler):
    occurrence_id = "11111111111111111111111111111111"

    def get_occurrence_id(self, group_key: DetectorGroupKey, event_id: str) -> str:
        return self.occurrence_id


class BaseDetectorHandlerTest(BaseGroupTypeTest):
    """
    Registers group types for a detector without a handler, one whose handler always triggers,
    and one with a stateful handler.
    """

    __test__ = Abstract(__module__, __qualname__)

    def setUp(self) -> None:
        super().setUp()

        class NoHandlerGroupType(GroupType):
            type_id = 1
            slug = "no_handler"
            description = "no handler"
            category = GroupCategory.METRIC.value

        class HandlerGroupType(GroupType):
            type_id = 2
            slug = "handler"
            description = "handler"
            category = GroupCategory.METRIC.value

        class HandlerStateGroupType(GroupType):
            type_id = 3
            slug = "handler_with_state"
            description = "handler with state"
            category = GroupCategory.METRIC.value

        @detector_settings_registry.register(HandlerGroupType.slug)
        class HandlerDetectorSettings(DetectorSettings):
            handler = MockTriggeredDetectorHandler

        @detector_settings_registry.register(HandlerStateGroupType.slug)
        class HandlerStateDetectorSettings(DetectorSettings):
            handler = MockDetectorStateHandler

        self.no_handler_type = NoHandlerGroupType
        self.handler_type = HandlerGroupType
        self.handler_state_type = HandlerStateGroupType

    def create_stateful_detector(self) -> Detector:
        """A stateful detector that triggers at HIGH above 5, and resolves at or below 5."""
        detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=self.handler_state_type.slug,
        )

        self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=detector.workflow_condition_group,
        )
        self.create_data_condition(
            type=Condition.LESS_OR_EQUAL,
            comparison=5,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=detector.workflow_condition_group,
        )

        return detector


class ConditionDetectorHandlerTest(BaseGroupTypeTest):
    """
    A detector with one `value > 5 → HIGH` trigger condition, evaluated by
    MockDefaultDetectorHandler through DetectorHandler's default `evaluate`.
    """

    __test__ = Abstract(__module__, __qualname__)

    source_id = "condition-source"

    def setUp(self) -> None:
        super().setUp()

        class ConditionGroupType(GroupType):
            type_id = 5
            slug = "condition_handler"
            description = "condition handler"
            category = GroupCategory.METRIC.value

        @detector_settings_registry.register(ConditionGroupType.slug)
        class ConditionDetectorSettings(DetectorSettings):
            handler = MockDefaultDetectorHandler

        self.group_type = ConditionGroupType
        self.detector = self.create_condition_detector()
        self.handler = MockDefaultDetectorHandler(self.detector)

    def create_condition_detector(
        self, condition_result: DataConditionResult = DetectorPriorityLevel.HIGH
    ) -> Detector:
        detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=self.group_type.slug,
        )

        self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=condition_result,
            condition_group=detector.workflow_condition_group,
        )

        return detector

    def packet(self, value: Any = 10, **packet: Any) -> DataPacket[dict[str, Any]]:
        return DataPacket(source_id=self.source_id, packet={"value": value, **packet})

    def grouped_packet(
        self, values: dict[DetectorGroupKey, int], **packet: Any
    ) -> DataPacket[dict[str, Any]]:
        return DataPacket(source_id=self.source_id, packet={"values": values, **packet})

    def evaluate_triggered(
        self, handler: MockDefaultDetectorHandler | None = None, value: int = 10, **packet: Any
    ) -> DetectorEvaluation:
        result = (handler or self.handler)._evaluate(self.packet(value, **packet))

        assert list(result.keys()) == [None]

        return result[None]

    def evaluate_occurrence(
        self, handler: MockDefaultDetectorHandler | None = None, **packet: Any
    ) -> IssueOccurrence:
        occurrence = self.evaluate_triggered(handler, **packet).result

        assert isinstance(occurrence, IssueOccurrence)

        return occurrence


class TestDetectorHandlerEvaluate(ConditionDetectorHandlerTest):
    """
    Covers the default stateless `evaluate` that DetectorHandler provides, and the occurrence
    the platform builds for each triggered evaluation.
    """

    def test_detector_creates_an_occurrence_when_triggered(self) -> None:
        evaluation = self.evaluate_triggered()

        assert isinstance(evaluation.result, IssueOccurrence)
        assert evaluation.triggered is True
        assert evaluation.priority == DetectorPriorityLevel.HIGH
        assert evaluation.data["group_key"] is None

    def test_detector_keys_a_dict_value_by_none(self) -> None:
        # Only DetectorGroupValues are grouped; a plain dict with string keys is a single value
        values: dict[DetectorGroupKey, Any] = dict(
            self.handler._extract_value(self.packet({"group-one": 10}))
        )

        assert values == {None: {"group-one": 10}}

    def test_detector_returns_nothing_when_not_triggered(self) -> None:
        assert self.handler._evaluate(self.packet(1)) == {}

    def test_detector_without_a_condition_group_returns_nothing(self) -> None:
        detector = self.create_detector(project=self.project, type=self.group_type.slug)

        assert MockDefaultDetectorHandler(detector)._evaluate(self.packet()) == {}

    def test_detector_uses_the_highest_triggered_priority(self) -> None:
        self.create_data_condition(
            type=Condition.GREATER,
            comparison=1,
            condition_result=DetectorPriorityLevel.LOW,
            condition_group=self.detector.workflow_condition_group,
        )

        assert self.evaluate_triggered().priority == DetectorPriorityLevel.HIGH

    def test_detector_returns_nothing_when_conditions_carry_no_priority(self) -> None:
        handler = MockDefaultDetectorHandler(self.create_condition_detector(condition_result=True))

        assert handler._evaluate(self.packet()) == {}

    def test_detector_drops_evaluations_when_the_triggered_priority_is_ok(self) -> None:
        handler = MockDefaultDetectorHandler(
            self.create_condition_detector(condition_result=DetectorPriorityLevel.OK)
        )

        evaluations = handler.evaluate(self.packet(), handler._extract_value(self.packet()))
        ok_evaluation = evaluations.result[None]

        # The condition evaluation is returned, so subclasses can act on the OK priority
        assert ok_evaluation.triggered is False
        assert ok_evaluation.priority == DetectorPriorityLevel.OK
        assert ok_evaluation.result is None

        # Without a result, the evaluation has no outcome and the platform drops it
        assert handler._evaluate(self.packet()) == {}

    def test_detector_uses_the_default_fingerprint(self) -> None:
        assert self.evaluate_occurrence().fingerprint == [f"detector:{self.detector.id}"]

    def test_detector_uses_a_custom_fingerprint(self) -> None:
        handler = MockFingerprintedDetectorHandler(self.detector)

        assert self.evaluate_occurrence(handler).fingerprint == ["mock-fingerprint"]

    def test_detector_event_data_is_a_valid_issue_platform_payload(self) -> None:
        evaluation = self.evaluate_triggered()
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert_event_matches_occurrence(event_data, occurrence)

        # Raises when the occurrence and event data disagree on the event id.
        payload = _prepare_occurrence_message(occurrence, event_data)

        assert payload is not None
        assert payload["event"]["event_id"] == occurrence.event_id

    def test_detector_preserves_the_event_id_from_create_occurrence(self) -> None:
        evaluation = self.evaluate_triggered(event_id=EVENT_ID)
        occurrence = evaluation.result

        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.event_id == EVENT_ID
        assert_event_matches_occurrence(evaluation.data["event_data"], occurrence)

    def test_detector_replaying_an_event_rebuilds_the_same_occurrence_id(self) -> None:
        first = self.evaluate_occurrence(event_id=EVENT_ID)
        second = self.evaluate_occurrence(event_id=EVENT_ID)

        # the conversion from human-readable string to UUID is deterministic
        assert first.id == second.id

    def test_detector_generates_new_ids_when_no_event_id_is_supplied(self) -> None:
        first = self.evaluate_occurrence()
        second = self.evaluate_occurrence()

        assert UUID(first.event_id) != UUID(second.event_id)
        assert UUID(first.id) != UUID(second.id)

    def test_detector_uses_the_occurrence_id_hook(self) -> None:
        occurrence = self.evaluate_occurrence(MockOccurrenceIdDetectorHandler(self.detector))

        assert occurrence.id == MockOccurrenceIdDetectorHandler.occurrence_id
        assert occurrence.event_id != occurrence.id

    def test_detector_warns_when_slow_conditions_remain(self) -> None:
        self.create_data_condition(
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 7},
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )

        with mock.patch("sentry.workflow_engine.handlers.detector.condition.logger") as mock_logger:
            result = self.handler._evaluate(self.packet(1))

        assert result == {}

        mock_logger.warning.assert_called_once_with(
            "Slow conditions present for detector",
            extra={
                "detector_id": self.detector.id,
                "condition_group_id": self.detector.workflow_condition_group_id,
            },
        )


class TestDetectorHandlerGroupedEvaluate(ConditionDetectorHandlerTest):
    """
    Covers the default `evaluate` when `extract_value` returns `DetectorGroupValues`.

    Every group is evaluated against the same condition group, and each group that
    triggers contributes its own entry to the returned evaluation map.
    """

    def condition_group_evaluation(
        self, *, triggered: bool, error: ConditionError | None = None
    ) -> DataConditionGroupEvaluation:
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
                        condition=self.detector.get_conditions()[0],
                    )
                ],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )

    def test_detector_creates_an_occurrence_for_each_triggered_group(self) -> None:
        result = self.handler._evaluate(self.grouped_packet({"group-one": 10, "group-two": 20}))

        assert set(result.keys()) == {"group-one", "group-two"}

        first = result["group-one"]
        second = result["group-two"]

        assert first.data["group_key"] == "group-one"
        assert second.data["group_key"] == "group-two"

        assert isinstance(first.result, IssueOccurrence)
        assert isinstance(second.result, IssueOccurrence)

        assert UUID(first.result.event_id) != UUID(second.result.event_id)

    def test_detector_fingerprints_each_group_separately(self) -> None:
        result = self.handler._evaluate(self.grouped_packet({"group-one": 10, "group-two": 20}))

        first = result["group-one"].result
        second = result["group-two"].result

        assert isinstance(first, IssueOccurrence)
        assert isinstance(second, IssueOccurrence)

        assert first.fingerprint == [f"detector:{self.detector.id}:group-one"]
        assert second.fingerprint == [f"detector:{self.detector.id}:group-two"]

    def test_detector_only_returns_the_groups_that_triggered(self) -> None:
        result = self.handler._evaluate(self.grouped_packet({"loud": 10, "quiet": 1}))

        assert set(result.keys()) == {"loud"}

    def test_detector_skips_evaluation_when_there_are_no_groups(self) -> None:
        with mock.patch.object(self.handler, "evaluate") as mock_evaluate:
            result = self.handler._evaluate(self.grouped_packet({}))

        assert result == {}
        mock_evaluate.assert_not_called()

    def test_detector_groups_share_a_source_event_id_but_not_an_occurrence_id(self) -> None:
        result = self.handler._evaluate(
            self.grouped_packet({"group-one": 10, "group-two": 20}, event_id=EVENT_ID)
        )

        first = result["group-one"].result
        second = result["group-two"].result

        assert isinstance(first, IssueOccurrence)
        assert isinstance(second, IssueOccurrence)

        assert first.event_id == EVENT_ID
        assert second.event_id == EVENT_ID
        assert first.id != second.id

    def test_detector_taints_the_result_when_any_group_is_tainted(self) -> None:
        clean_evaluation = self.condition_group_evaluation(triggered=False)
        tainted_evaluation = self.condition_group_evaluation(
            triggered=True, error=ConditionError(msg="condition blew up")
        )
        packet = self.grouped_packet({"quiet": 1, "loud": 10})

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.condition.process_data_condition_group",
            side_effect=[(clean_evaluation, []), (tainted_evaluation, [])],
        ):
            evaluations = self.handler.evaluate(packet, self.handler._extract_value(packet))

        assert evaluations.tainted is True
        assert set(evaluations.result.keys()) == {"loud"}


class TestDetectorHandlerEvidenceData(ConditionDetectorHandlerTest):
    """
    Covers the evidence data the platform attaches to every occurrence it builds,
    including the cached data source lookup behind it.
    """

    def setUp(self) -> None:
        super().setUp()

        self.data_source = self.create_data_source(
            organization=self.organization,
            type=MOCK_DATA_SOURCE_TYPE,
            source_id=self.source_id,
        )
        self.data_source.detectors.set([self.detector])

    def test_detector_evidence_data_carries_the_workflow_engine_fields(self) -> None:
        evidence_data = self.evaluate_occurrence().evidence_data

        assert evidence_data["detector_id"] == self.detector.id
        assert evidence_data["value"] == 10
        assert evidence_data["data_packet_source_id"] == self.source_id
        assert evidence_data["config"] == self.detector.config

    def test_detector_evidence_data_carries_the_triggered_conditions(self) -> None:
        condition = self.detector.get_conditions()[0]

        assert self.evaluate_occurrence().evidence_data["conditions"] == [
            dict(condition.get_snapshot())
        ]

    def test_detector_evidence_data_serializes_the_matching_data_source(self) -> None:
        assert self.evaluate_occurrence().evidence_data["data_sources"] == [
            {
                "id": str(self.data_source.id),
                "organization_id": str(self.organization.id),
                "type": MOCK_DATA_SOURCE_TYPE,
                "source_id": self.source_id,
                "query_obj": None,
            }
        ]

    def test_detector_evidence_data_sources_are_empty_without_a_match(self) -> None:
        with mock.patch("sentry.workflow_engine.handlers.detector.base.logger") as mock_logger:
            data_sources = self.handler._build_evidence_data_sources("unknown-source")

        assert data_sources == []

        mock_logger.warning.assert_called_once_with(
            "Matching data source not found for detector while generating occurrence evidence data",
            extra={
                "detector_id": self.detector.id,
                "data_packet_source_id": "unknown-source",
            },
        )

    def test_detector_evidence_data_sources_are_empty_when_serialization_fails(self) -> None:
        with (
            mock.patch(
                "sentry.workflow_engine.handlers.detector.base.serialize",
                side_effect=ValueError("could not serialize"),
            ),
            mock.patch("sentry.workflow_engine.handlers.detector.base.logger") as mock_logger,
        ):
            data_sources = self.handler._build_evidence_data_sources(self.source_id)

        assert data_sources == []

        mock_logger.exception.assert_called_once_with(
            "Failed to serialize data source definition when building workflow engine evidence data"
        )

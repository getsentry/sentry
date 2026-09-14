from typing import Any
from unittest import mock

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, _prepare_occurrence_message
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel, DetectorSettings
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest
from tests.sentry.workflow_engine.handlers.detector import example_detector
from tests.sentry.workflow_engine.handlers.detector.example_detector import ExampleDetectorHandler

MEDIUM_THRESHOLD = 5

HIGH_THRESHOLD = 10

SOURCE_ID = "example-source"


class ExampleDetectorTestCase(BaseGroupTypeTest):
    """
    Shared setup: an issue type wired to `ExampleDetectorHandler`, and a detector whose
    trigger group holds the two thresholds the demo is about.
    """

    def setUp(self) -> None:
        super().setUp()

        class ExampleMeasurementGroupType(GroupType):
            type_id = 9001
            slug = "example_measurement"
            description = "Example measurement"
            category = GroupCategory.METRIC.value
            detector_settings = DetectorSettings(handler=ExampleDetectorHandler)

        self.group_type = ExampleMeasurementGroupType

        self.detector = self.create_detector(
            project=self.project,
            name="Example Measurement Detector",
            type=self.group_type.slug,
            workflow_condition_group=self.create_data_condition_group(),
        )

        self.medium_condition = self.create_data_condition(
            type=Condition.GREATER,
            comparison=MEDIUM_THRESHOLD,
            condition_result=DetectorPriorityLevel.MEDIUM,
            condition_group=self.detector.workflow_condition_group,
        )

        self.high_condition = self.create_data_condition(
            type=Condition.GREATER,
            comparison=HIGH_THRESHOLD,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )

        self.handler = ExampleDetectorHandler(self.detector)

    def build_packet(self, measurement: int) -> DataPacket[example_detector.TestDataPacket]:
        return DataPacket(
            source_id=SOURCE_ID,
            packet=example_detector.TestDataPacket(
                measurement=measurement,
                service_name="checkout",
                region="us-east-1",
            ),
        )

    def evaluate(self, measurement: int) -> dict[DetectorGroupKey, DetectorEvaluation]:
        return self.handler.evaluate(self.build_packet(measurement)).result

    def evaluate_triggered(self, measurement: int) -> DetectorEvaluation:
        results = self.evaluate(measurement)

        assert list(results.keys()) == [None]

        return results[None]

    def occurrence_for(self, measurement: int) -> IssueOccurrence:
        occurrence = self.evaluate_triggered(measurement).result

        assert isinstance(occurrence, IssueOccurrence)

        return occurrence


class TestExampleDetectorThresholds(ExampleDetectorTestCase):
    """The value the detector extracts, and the priority each value earns."""

    def test_extract_value__returns_only_the_measurement(self) -> None:
        assert self.handler.extract_value(self.build_packet(7)) == 7

    def test_evaluate__no_occurrence_below_the_medium_threshold(self) -> None:
        assert self.evaluate(1) == {}

    def test_evaluate__no_occurrence_at_the_medium_threshold(self) -> None:
        assert self.evaluate(MEDIUM_THRESHOLD) == {}

    def test_evaluate__medium_priority_above_the_medium_threshold(self) -> None:
        assert self.evaluate_triggered(6).priority == DetectorPriorityLevel.MEDIUM

    def test_evaluate__stays_medium_at_the_high_threshold(self) -> None:
        assert self.evaluate_triggered(HIGH_THRESHOLD).priority == DetectorPriorityLevel.MEDIUM

    def test_evaluate__high_priority_above_the_high_threshold(self) -> None:
        assert self.evaluate_triggered(11).priority == DetectorPriorityLevel.HIGH

    def test_evaluate__triggered_and_ungrouped(self) -> None:
        evaluation = self.evaluate_triggered(11)

        assert evaluation.triggered is True
        assert evaluation.data["group_key"] is None

    def test_evaluate__is_not_tainted(self) -> None:
        assert self.handler.evaluate(self.build_packet(11)).tainted is False


class TestExampleDetectorOccurrence(ExampleDetectorTestCase):
    """The Issue Platform occurrence the handler produces once a threshold trips."""

    def test_occurrence__describes_the_packet(self) -> None:
        occurrence = self.occurrence_for(11)

        assert occurrence.issue_title == "checkout measurement is too high"
        assert occurrence.subtitle == "Measured 11 in us-east-1"
        assert occurrence.culprit == "checkout"
        assert occurrence.level == "error"
        assert occurrence.type == self.group_type

    def test_occurrence__belongs_to_the_detectors_project(self) -> None:
        assert self.occurrence_for(11).project_id == self.detector.project_id

    def test_occurrence__carries_the_triggered_priority(self) -> None:
        assert self.occurrence_for(6).priority == DetectorPriorityLevel.MEDIUM
        assert self.occurrence_for(11).priority == DetectorPriorityLevel.HIGH

    def test_occurrence__is_fingerprinted_by_detector(self) -> None:
        assert self.occurrence_for(11).fingerprint == [f"detector:{self.detector.id}"]

    def test_occurrence__reuses_the_fingerprint_across_packets(self) -> None:
        assert self.occurrence_for(6).fingerprint == self.occurrence_for(11).fingerprint

    def test_occurrence__displays_the_packet_as_evidence(self) -> None:
        assert self.occurrence_for(11).evidence_display == [
            IssueEvidence(name="Measurement", value="11", important=True),
            IssueEvidence(name="Service", value="checkout", important=False),
            IssueEvidence(name="Region", value="us-east-1", important=False),
        ]

    def test_occurrence__evidence_data_keeps_the_product_fields(self) -> None:
        evidence_data = self.occurrence_for(11).evidence_data

        assert evidence_data["measurement"] == 11
        assert evidence_data["service_name"] == "checkout"
        assert evidence_data["region"] == "us-east-1"

    def test_occurrence__evidence_data_adds_the_workflow_engine_fields(self) -> None:
        evidence_data = self.occurrence_for(11).evidence_data

        assert evidence_data["detector_id"] == self.detector.id
        assert evidence_data["value"] == 11
        assert evidence_data["data_packet_source_id"] == SOURCE_ID
        assert evidence_data["config"] == self.detector.config

    def test_occurrence__evidence_data_has_no_data_sources(self) -> None:
        assert self.occurrence_for(11).evidence_data["data_sources"] == []

    def test_occurrence__evidence_records_only_the_medium_condition(self) -> None:
        conditions = self.occurrence_for(6).evidence_data["conditions"]

        assert [condition["id"] for condition in conditions] == [self.medium_condition.id]
        assert conditions[0]["condition_result"] == DetectorPriorityLevel.MEDIUM

    def test_occurrence__evidence_records_both_conditions_when_both_trip(self) -> None:
        conditions = self.occurrence_for(11).evidence_data["conditions"]

        assert sorted(condition["id"] for condition in conditions) == sorted(
            [self.medium_condition.id, self.high_condition.id]
        )


class TestExampleDetectorEventData(ExampleDetectorTestCase):
    """The event the occurrence is attached to when it reaches the Issue Platform."""

    def event_data_for(self, measurement: int) -> dict[str, Any]:
        event_data = self.evaluate_triggered(measurement).data["event_data"]

        assert event_data is not None

        return event_data

    def test_event_data__matches_the_occurrence(self) -> None:
        evaluation = self.evaluate_triggered(11)
        occurrence = evaluation.result
        event_data = evaluation.data["event_data"]

        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None
        assert event_data["event_id"] == occurrence.event_id
        assert event_data["project_id"] == occurrence.project_id
        assert event_data["timestamp"] == occurrence.detection_time
        assert event_data["received"] == occurrence.detection_time

    def test_event_data__keeps_the_tags_the_handler_supplied(self) -> None:
        assert self.event_data_for(11)["tags"] == {
            "service_name": "checkout",
            "region": "us-east-1",
        }

    def test_event_data__fills_in_the_defaults(self) -> None:
        event_data = self.event_data_for(11)

        assert event_data["platform"] == "python"
        assert event_data["environment"] is None

    def test_event_data__forms_a_valid_issue_platform_payload(self) -> None:
        evaluation = self.evaluate_triggered(11)
        occurrence = evaluation.result

        assert isinstance(occurrence, IssueOccurrence)

        payload = _prepare_occurrence_message(occurrence, evaluation.data["event_data"])

        assert payload is not None

        assert payload["event"]["event_id"] == occurrence.event_id
        assert payload["issue_title"] == "checkout measurement is too high"
        assert payload["fingerprint"] == occurrence.fingerprint


class TestExampleDetectorEndToEnd(ExampleDetectorTestCase):
    """The same detector driven through `process_detectors`, as production does."""

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    def test_process_detectors__sends_the_occurrence_to_the_issue_platform(
        self, mock_produce: mock.MagicMock
    ) -> None:
        results = process_detectors(self.build_packet(11), [self.detector])

        assert len(results) == 1

        detector, evaluations = results[0]

        assert detector == self.detector
        assert evaluations[None].priority == DetectorPriorityLevel.HIGH

        produced = mock_produce.call_args.kwargs

        assert produced["payload_type"] == PayloadType.OCCURRENCE
        assert produced["occurrence"] == evaluations[None].result
        assert produced["occurrence"].priority == DetectorPriorityLevel.HIGH

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    def test_process_detectors__sends_nothing_below_the_threshold(
        self, mock_produce: mock.MagicMock
    ) -> None:
        assert process_detectors(self.build_packet(1), [self.detector]) == []
        assert mock_produce.call_count == 0

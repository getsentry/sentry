import dataclasses
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from sentry.anomaly_detection.contracts import AnomalyGroupKey, ChangeType, Urgency
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, AnomalyEvidence
from sentry.anomaly_detection.grouptype import (
    AnomalyDetection,
    AnomalyDetectionDetectorHandler,
    MinuteDecisions,
)
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    DetectorAPIOperation,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorType,
)
from tests.sentry.anomaly_detection.test_helpers import anomaly_decision

MINUTE = datetime(2025, 1, 1, 12)
ROTATE_ACTIVATION = "organizations:workflow-engine-rotate-activation-id"
PRODUCE = (
    "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
)
EVIDENCE: AnomalyEvidence = {
    "signal": "errors",
    "change_type": ChangeType.SPIKE,
    "started_at": "2025-01-01T11:57:00",
    "actual": 200.0,
    "expected": 10.0,
}


class TestAnomalyDetectionDetectorHandler(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(
            project=self.project, type=DetectorType.ANOMALY_DETECTION.value
        )
        produce = patch(PRODUCE)
        self.produce: MagicMock = produce.start()
        self.addCleanup(produce.stop)

    def decision(
        self,
        minute: datetime,
        *,
        urgency: Urgency = Urgency.MEDIUM,
        resolved: bool = False,
        project_id: int | None = None,
        group_key: str = "group",
    ) -> AnomalyDecision:
        return anomaly_decision(
            self.project.id if project_id is None else project_id,
            minute,
            group_key=group_key,
            urgency=urgency,
            is_resolved=resolved,
            title="Errors increased in production",
            evidence=EVIDENCE,
        )

    def process(
        self, *decisions: AnomalyDecision
    ) -> list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluation]]]:
        packet = DataPacket(
            source_id=str(self.detector.id),
            packet=MinuteDecisions(
                minute=decisions[0].timestamp,
                decisions={decision.group_key: decision for decision in decisions},
            ),
        )
        with self.feature(ROTATE_ACTIVATION):
            return process_detectors(packet, [self.detector])

    def open(self, decision: AnomalyDecision) -> DetectorEvaluation:
        [(detector, evaluations)] = self.process(decision)
        assert detector == self.detector
        evaluation = evaluations[decision.group_key]
        assert isinstance(evaluation.result, IssueOccurrence)
        return evaluation

    def resolve(self, decision: AnomalyDecision) -> StatusChangeMessage:
        [(_, evaluations)] = self.process(decision)
        result = evaluations[decision.group_key].result
        assert isinstance(result, StatusChangeMessage)
        return result

    def test_registration(self) -> None:
        settings = detector_settings_registry.get(DetectorType.ANOMALY_DETECTION)
        assert settings.handler is AnomalyDetectionDetectorHandler
        assert settings.api_availability == {operation: False for operation in DetectorAPIOperation}
        assert self.detector.group_type is AnomalyDetection
        assert isinstance(self.detector.detector_handler, AnomalyDetectionDetectorHandler)

    def test_open_creates_occurrence_from_decision(self) -> None:
        evaluation = self.open(self.decision(MINUTE))

        occurrence = evaluation.result
        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.type is AnomalyDetection
        assert occurrence.project_id == self.project.id
        assert occurrence.issue_title == "Errors increased in production"
        assert occurrence.priority == DetectorPriorityLevel.MEDIUM
        assert occurrence.detection_time == MINUTE.replace(tzinfo=UTC)
        assert {key: occurrence.evidence_data[key] for key in EVIDENCE} == EVIDENCE
        assert occurrence.evidence_display == [
            IssueEvidence(name="Signal", value="errors", important=True),
            IssueEvidence(name="Change", value="spike", important=False),
            IssueEvidence(name="Started", value="2025-01-01T11:57:00", important=False),
            IssueEvidence(name="Observed", value="200.0", important=False),
            IssueEvidence(name="Expected", value="10.0", important=False),
        ]
        event_data = evaluation.data["event_data"]
        assert event_data is not None
        assert event_data["environment"] == "production"
        self.produce.assert_called_once_with(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            status_change=None,
            event_data=event_data,
        )

    def test_occurrence_omits_absent_measurements_and_environment(self) -> None:
        decision = dataclasses.replace(
            self.decision(MINUTE, urgency=Urgency.LOW),
            evidence={
                "signal": "other",
                "change_type": ChangeType.SILENCE,
                "started_at": "2025-01-01T11:50:00",
            },
            env="",
        )

        evaluation = self.open(decision)

        occurrence = evaluation.result
        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.priority == DetectorPriorityLevel.LOW
        assert occurrence.evidence_display == [
            IssueEvidence(name="Signal", value="other", important=True),
            IssueEvidence(name="Change", value="silence", important=False),
            IssueEvidence(name="Started", value="2025-01-01T11:50:00", important=False),
        ]
        event_data = evaluation.data["event_data"]
        assert event_data is not None
        assert event_data["environment"] is None
        assert event_data["platform"] == "other"

    def test_urgency_change_updates_same_issue(self) -> None:
        opened = self.open(self.decision(MINUTE)).result
        escalated = self.open(
            self.decision(MINUTE + timedelta(minutes=1), urgency=Urgency.HIGH)
        ).result

        assert isinstance(opened, IssueOccurrence)
        assert isinstance(escalated, IssueOccurrence)
        assert escalated.priority == DetectorPriorityLevel.HIGH
        assert escalated.fingerprint == opened.fingerprint
        assert escalated.id != opened.id

    def test_resolved_decision_resolves_issue(self) -> None:
        opened = self.open(self.decision(MINUTE)).result
        close = self.resolve(self.decision(MINUTE + timedelta(minutes=1), resolved=True))

        assert isinstance(opened, IssueOccurrence)
        assert close.fingerprint == opened.fingerprint
        assert close.new_status == GroupStatus.RESOLVED
        assert close.project_id == self.project.id
        assert close.detector_id == self.detector.id
        state = DetectorState.objects.get(detector=self.detector, detector_group_key="group")
        assert not state.is_triggered

    def test_reopen_starts_new_issue(self) -> None:
        with patch(
            "sentry.workflow_engine.handlers.detector.stateful._get_unix_epoch_time_in_milliseconds",
            side_effect=[1_000, 2_000],
        ):
            opened = self.open(self.decision(MINUTE)).result
            self.resolve(self.decision(MINUTE + timedelta(minutes=1), resolved=True))
            reopened = self.open(self.decision(MINUTE + timedelta(minutes=2))).result

        assert isinstance(opened, IssueOccurrence)
        assert isinstance(reopened, IssueOccurrence)
        assert reopened.fingerprint != opened.fingerprint

    def test_replayed_minute_is_skipped(self) -> None:
        self.open(self.decision(MINUTE))

        assert self.process(self.decision(MINUTE, urgency=Urgency.HIGH)) == []
        assert self.process(self.decision(MINUTE - timedelta(minutes=1), resolved=True)) == []
        self.produce.assert_called_once()

    def test_ignores_other_project_decisions(self) -> None:
        other_project = self.create_project()

        assert self.process(self.decision(MINUTE, project_id=other_project.id)) == []
        self.produce.assert_not_called()
        assert not DetectorState.objects.filter(detector=self.detector).exists()

    def test_mixed_packet_skips_processed_group_and_opens_new_one(self) -> None:
        self.open(self.decision(MINUTE, group_key="a"))
        self.produce.reset_mock()
        other_project = self.create_project()

        [(_, evaluations)] = self.process(
            self.decision(MINUTE, group_key="a", urgency=Urgency.HIGH),
            self.decision(MINUTE, group_key="b"),
            self.decision(MINUTE, group_key="foreign", project_id=other_project.id),
        )

        assert evaluations.keys() == {"b"}
        assert isinstance(evaluations["b"].result, IssueOccurrence)
        self.produce.assert_called_once()
        assert dict(
            DetectorState.objects.filter(detector=self.detector).values_list(
                "detector_group_key", "is_triggered"
            )
        ) == {"a": True, "b": True}
        assert DetectorState.objects.get(
            detector=self.detector, detector_group_key="a"
        ).state == str(DetectorPriorityLevel.MEDIUM.value)

    def test_resolved_set_closes_group_without_a_decision(self) -> None:
        opened = self.open(self.decision(MINUTE))
        packet = DataPacket(
            source_id=str(self.detector.id),
            packet=MinuteDecisions(
                minute=MINUTE + timedelta(minutes=1),
                decisions={},
                resolved=frozenset({AnomalyGroupKey("group")}),
            ),
        )
        with self.feature(ROTATE_ACTIVATION):
            [(_, evaluations)] = process_detectors(packet, [self.detector])

        result = evaluations["group"].result
        assert isinstance(result, StatusChangeMessage)
        assert isinstance(opened.result, IssueOccurrence)
        assert result.fingerprint == opened.result.fingerprint
        assert not DetectorState.objects.get(detector=self.detector).is_triggered

import dataclasses
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from sentry.anomaly_detection.contracts import AnomalyGroupKey, ChangeType, Urgency
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, AnomalyEvidence
from sentry.anomaly_detection.grouptype import (
    TRIGGERED,
    AnomalyDetection,
    AnomalyDetectionDetectorHandler,
    MinuteDecisions,
)
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.notebooks.models import Notebook
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import cell_silo_test
from sentry.utils import metrics
from sentry.viewer_context import ActorId, ActorType
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.tasks import seer_investigation
from sentry.workflow_engine.tasks.seer_investigation import create_detector_investigation
from sentry.workflow_engine.types import DetectorAPIOperation, DetectorGroupKey, DetectorType
from tests.sentry.anomaly_detection.test_helpers import anomaly_decision

MINUTE = datetime(2025, 1, 1, 12)
PRODUCE = (
    "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
)
DISPATCH = "sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay"
CREATE = "sentry.investigations.services.create_agentic_manual_investigation"
EVIDENCE: AnomalyEvidence = {
    "signal": "errors",
    "change_type": ChangeType.SPIKE,
    "started_at": "2025-01-01T11:57:00",
    "actual": 200.0,
    "expected": 10.0,
}


@cell_silo_test
class TestAnomalyDetectionDetectorHandler(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(
            self.feature(["organizations:investigations", "organizations:service-accounts"])
        )
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.service_account_id = self.service_account("anomalies", [self.project.id])
        self.detector = self.create_detector(
            project=self.project,
            type=DetectorType.ANOMALY_DETECTION.value,
            config={"service_account_id": self.service_account_id},
        )
        self.produce: MagicMock = self.enterContext(patch(PRODUCE))
        self.dispatch: MagicMock = self.enterContext(patch(DISPATCH))

    def service_account(self, name: str, project_ids: list[int]) -> int:
        with outbox_runner():
            return self.create_service_account(
                organization=self.organization, name=name, project_ids=project_ids
            ).id

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
        with self.tasks():
            return process_detectors(packet, [self.detector])

    def open(self, decision: AnomalyDecision) -> IssueOccurrence:
        [(detector, evaluations)] = self.process(decision)
        assert detector == self.detector
        occurrence = evaluations[decision.group_key].result
        assert isinstance(occurrence, IssueOccurrence)
        return occurrence

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

    def test_open_starts_investigation_instead_of_an_issue(self) -> None:
        occurrence = self.open(self.decision(MINUTE))

        assert occurrence.type is AnomalyDetection
        assert occurrence.project_id == self.project.id
        assert occurrence.detection_time == MINUTE.replace(tzinfo=UTC)
        assert {key: occurrence.evidence_data[key] for key in EVIDENCE} == EVIDENCE
        assert occurrence.evidence_display == [
            IssueEvidence(name="Signal", value="errors", important=True),
            IssueEvidence(name="Change", value="spike", important=False),
            IssueEvidence(name="Urgency", value="medium", important=False),
            IssueEvidence(name="Started", value="2025-01-01T11:57:00", important=False),
            IssueEvidence(name="Observed", value="200.0", important=False),
            IssueEvidence(name="Expected", value="10.0", important=False),
        ]
        self.produce.assert_not_called()

        investigation = Notebook.objects.get()
        assert investigation.creator_actor == ActorId(
            ActorType.SERVICE_ACCOUNT, self.service_account_id
        )
        assert investigation.title == "Errors increased in production"
        assert list(investigation.projects.values_list("id", flat=True)) == [self.project.id]
        assert investigation.source["type"] == "manual"
        assert investigation.source["prompt"].splitlines() == [
            "Errors increased in production",
            "Anomaly detected",
            "Detected at 2025-01-01T12:00:00+00:00 in the production environment.",
            "Signal: errors",
            "Change: spike",
            "Urgency: medium",
            "Started: 2025-01-01T11:57:00",
            "Observed: 200.0",
            "Expected: 10.0",
            "Decide whether this needs action and, if it does, find the cause.",
        ]
        seed = investigation.source["seed"]
        assert seed["detectorId"] == self.detector.id
        assert seed["occurrenceId"] == occurrence.id
        assert {key: seed["evidence"][key] for key in EVIDENCE} == EVIDENCE
        self.dispatch.assert_called_once_with(investigation.orchestration_run.id)

    def test_investigation_omits_absent_measurements_and_environment(self) -> None:
        decision = dataclasses.replace(
            self.decision(MINUTE, urgency=Urgency.LOW),
            evidence={
                "signal": "other",
                "change_type": ChangeType.SILENCE,
                "started_at": "2025-01-01T11:50:00",
            },
            env="",
        )

        self.open(decision)

        prompt = Notebook.objects.get().source["prompt"].splitlines()
        assert prompt[2] == "Detected at 2025-01-01T12:00:00+00:00."
        assert prompt[3:-1] == [
            "Signal: other",
            "Change: silence",
            "Urgency: low",
            "Started: 2025-01-01T11:50:00",
        ]

    def test_urgency_change_does_not_start_another_investigation(self) -> None:
        self.open(self.decision(MINUTE))

        assert (
            self.process(self.decision(MINUTE + timedelta(minutes=1), urgency=Urgency.HIGH)) == []
        )
        assert Notebook.objects.count() == 1
        state = DetectorState.objects.get(detector=self.detector, detector_group_key="group")
        assert state.is_triggered
        assert state.state == str(TRIGGERED.value)

    def test_resolution_closes_the_activation_without_starting_anything(self) -> None:
        opened = self.open(self.decision(MINUTE))
        close = self.resolve(self.decision(MINUTE + timedelta(minutes=1), resolved=True))

        assert close.fingerprint == opened.fingerprint
        assert close.new_status == GroupStatus.RESOLVED
        assert Notebook.objects.count() == 1
        state = DetectorState.objects.get(detector=self.detector, detector_group_key="group")
        assert not state.is_triggered
        self.produce.assert_not_called()

    def test_reopen_starts_a_new_investigation(self) -> None:
        self.open(self.decision(MINUTE))
        self.resolve(self.decision(MINUTE + timedelta(minutes=1), resolved=True))
        self.open(self.decision(MINUTE + timedelta(minutes=2)))

        assert Notebook.objects.count() == 2

    def test_replayed_reopen_does_not_start_another_investigation(self) -> None:
        self.open(self.decision(MINUTE))
        self.resolve(self.decision(MINUTE + timedelta(minutes=1), resolved=True))
        self.open(self.decision(MINUTE + timedelta(minutes=2)))

        # A retry before the checkpoint commit republishes the same minutes.
        assert self.process(self.decision(MINUTE)) == []
        assert self.process(self.decision(MINUTE + timedelta(minutes=1), resolved=True)) == []
        assert self.process(self.decision(MINUTE + timedelta(minutes=2))) == []
        assert Notebook.objects.count() == 2

    def test_replayed_minute_is_skipped(self) -> None:
        self.open(self.decision(MINUTE))

        assert self.process(self.decision(MINUTE, urgency=Urgency.HIGH)) == []
        assert self.process(self.decision(MINUTE - timedelta(minutes=1), resolved=True)) == []
        assert Notebook.objects.count() == 1

    def test_ignores_other_project_decisions(self) -> None:
        other_project = self.create_project()

        assert self.process(self.decision(MINUTE, project_id=other_project.id)) == []
        assert not Notebook.objects.exists()
        assert not DetectorState.objects.filter(detector=self.detector).exists()

    def test_mixed_packet_skips_processed_group_and_opens_new_one(self) -> None:
        self.open(self.decision(MINUTE, group_key="a"))
        other_project = self.create_project()

        [(_, evaluations)] = self.process(
            self.decision(MINUTE, group_key="a", urgency=Urgency.HIGH),
            self.decision(MINUTE, group_key="b"),
            self.decision(MINUTE, group_key="foreign", project_id=other_project.id),
        )

        assert evaluations.keys() == {"b"}
        assert isinstance(evaluations["b"].result, IssueOccurrence)
        assert Notebook.objects.count() == 2
        assert dict(
            DetectorState.objects.filter(detector=self.detector).values_list(
                "detector_group_key", "is_triggered"
            )
        ) == {"a": True, "b": True}

    def test_open_groups_resolve_groups_the_evaluator_no_longer_holds(self) -> None:
        held = self.open(self.decision(MINUTE, group_key="held"))
        lost = self.open(self.decision(MINUTE, group_key="lost"))
        packet = DataPacket(
            source_id=str(self.detector.id),
            packet=MinuteDecisions(
                minute=MINUTE + timedelta(minutes=1),
                decisions={},
                open_groups=frozenset({AnomalyGroupKey("held")}),
            ),
        )
        with patch.object(metrics, "incr") as incr:
            [(_, evaluations)] = process_detectors(packet, [self.detector])

        assert evaluations.keys() == {"lost"}
        result = evaluations["lost"].result
        assert isinstance(result, StatusChangeMessage)
        assert result.fingerprint == lost.fingerprint != held.fingerprint
        assert dict(
            DetectorState.objects.filter(detector=self.detector).values_list(
                "detector_group_key", "is_triggered"
            )
        ) == {"held": True, "lost": False}
        assert Notebook.objects.count() == 2
        incr.assert_any_call("anomaly_detection.stranded_groups_resolved", amount=1)

    def test_transient_failure_retries_instead_of_losing_the_investigation(self) -> None:
        with patch.object(create_detector_investigation, "delay") as enqueue:
            [(_, evaluations)] = self.process(self.decision(MINUTE))

        # The open is committed before the investigation exists; the task must carry it.
        assert isinstance(evaluations["group"].result, IssueOccurrence)
        assert DetectorState.objects.get(detector=self.detector).is_triggered
        [enqueued] = enqueue.call_args_list
        with (
            patch(CREATE, side_effect=RuntimeError("seer unavailable")),
            pytest.raises(RuntimeError),
        ):
            create_detector_investigation(*enqueued.args, **enqueued.kwargs)
        assert not Notebook.objects.exists()

        create_detector_investigation(*enqueued.args, **enqueued.kwargs)
        assert Notebook.objects.get().title == "Errors increased in production"

    def test_detector_without_service_account_skips_investigation(self) -> None:
        self.detector.update(config={})

        with patch.object(metrics, "incr") as incr:
            self.open(self.decision(MINUTE))

        assert not Notebook.objects.exists()
        incr.assert_any_call(
            "workflow_engine.seer_investigation.skipped",
            tags={
                "detector_type": DetectorType.ANOMALY_DETECTION.value,
                "reason": "no_service_account",
            },
            sample_rate=1,
        )

    def test_service_account_without_project_access_is_rejected(self) -> None:
        self.detector.update(
            config={
                "service_account_id": self.service_account("elsewhere", [self.create_project().id])
            }
        )

        with (
            patch.object(metrics, "incr") as incr,
            patch.object(seer_investigation.logger, "exception") as log_exception,
        ):
            self.open(self.decision(MINUTE))

        assert not Notebook.objects.exists()
        log_exception.assert_called_once()
        incr.assert_any_call(
            "workflow_engine.seer_investigation.skipped",
            tags={
                "detector_type": DetectorType.ANOMALY_DETECTION.value,
                "reason": "creator_rejected",
            },
            sample_rate=1,
        )

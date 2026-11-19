from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import call, patch

import pytest

from sentry import features
from sentry.anomaly_detection import schedule
from sentry.anomaly_detection.checkpoint.codec import CHECKPOINT_VERSION, is_current
from sentry.anomaly_detection.contracts import (
    AnomalyGroupKey,
    ChangeType,
    Metric,
    SeriesRow,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision
from sentry.anomaly_detection.grouptype import AnomalyDetection
from sentry.anomaly_detection.inputs.trace_lookup import TraceLookup
from sentry.constants import ObjectStatus
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType
from sentry.locks import locks
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import cell_silo_test
from sentry.utils import metrics
from sentry.workflow_engine.models import Detector, DetectorState
from sentry.workflow_engine.types import DetectorPriorityLevel, DetectorType

NOW = datetime(2025, 1, 1, 12, 3, 12, tzinfo=UTC)
END = datetime(2025, 1, 1, 12, 1)
START = END - timedelta(minutes=1)
FEATURES = {
    schedule.FEATURE: True,
    AnomalyDetection.build_ingest_feature_name(): True,
    "organizations:workflow-engine-rotate-activation-id": True,
}
CHECKPOINT = {"version": CHECKPOINT_VERSION, "qualified": []}
PRODUCE = (
    "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
)


def decision(project_id: int, *, timestamp: datetime = START) -> AnomalyDecision:
    return AnomalyDecision(
        group_key=AnomalyGroupKey("group"),
        project_id=project_id,
        timestamp=timestamp,
        urgency=Urgency.HIGH,
        is_resolved=False,
        title=f"Anomaly in project {project_id}",
        evidence={
            "signal": Signal.ERRORS,
            "change_type": ChangeType.SPIKE,
            "started_at": START.isoformat(),
        },
        env="production",
    )


def save_state(
    organization: Organization, next_minute: datetime, checkpoint: dict[str, Any]
) -> AnomalyDetectionState:
    # No factory exists for this cell-local checkpoint row.
    return AnomalyDetectionState.objects.create(
        organization=organization,
        next_minute=next_minute.replace(tzinfo=UTC),
        checkpoint=checkpoint,
    )


@cell_silo_test
class TestAnomalySchedule(TestCase):
    def make_detector(self, project: Project, *, enabled: bool = True) -> Detector:
        return self.create_detector(
            project=project, type=DetectorType.ANOMALY_DETECTION.value, enabled=enabled
        )

    @freeze_time(NOW)
    def test_dispatches_only_gated_active_organizations(self) -> None:
        self.make_detector(self.project)
        self.make_detector(self.project)
        self.make_detector(self.create_project(), enabled=False)
        disabled = self.create_organization()
        self.make_detector(self.create_project(organization=disabled), enabled=False)
        inactive = self.create_organization()
        self.make_detector(self.create_project(organization=inactive))
        inactive.update(status=OrganizationStatus.PENDING_DELETION)
        hidden = self.create_organization()
        self.make_detector(self.create_project(organization=hidden))
        ingest_disabled = self.create_organization()
        self.make_detector(self.create_project(organization=ingest_disabled))
        inactive_project = self.create_organization()
        project = self.create_project(organization=inactive_project)
        self.make_detector(project)
        project.update(status=ObjectStatus.PENDING_DELETION)

        def allowed(name: str, *entities: object, **_kwargs: object) -> bool:
            return (entities == (self.organization,) and name in FEATURES) or (
                entities == (ingest_disabled,) and name == schedule.FEATURE
            )

        with (
            patch.object(features, "has", side_effect=allowed),
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
        ):
            schedule.schedule_anomaly_detectors()

        enqueue.assert_called_once_with(self.organization.id, END.replace(tzinfo=UTC).isoformat())

    @freeze_time(NOW)
    def test_fanout_rotates_when_capped(self) -> None:
        organizations = [self.create_organization() for _ in range(3)]
        for organization in organizations:
            self.make_detector(self.create_project(organization=organization))
        ids = sorted(organization.id for organization in organizations)
        with (
            self.feature(FEATURES),
            self.options({"anomaly_detection.max_organizations_per_tick": 2}),
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
        ):
            schedule.schedule_anomaly_detectors()
            assert [entry.args[0] for entry in enqueue.call_args_list] == ids[:2]
            enqueue.reset_mock()
            schedule.schedule_anomaly_detectors()
            assert [entry.args[0] for entry in enqueue.call_args_list] == ids[2:] + ids[:1]

    @freeze_time(NOW)
    def test_prunes_abandoned_checkpoints_and_old_resolved_detector_state(self) -> None:
        detector = self.make_detector(self.project)
        active = save_state(self.organization, END, CHECKPOINT)
        abandoned = save_state(self.create_organization(), END, CHECKPOINT)
        AnomalyDetectionState.objects.filter(id=abandoned.id).update(
            date_updated=NOW - timedelta(days=1, minutes=1)
        )
        old_resolved = self.create_detector_state(
            detector=detector, detector_group_key="old-resolved", is_triggered=False
        )
        old_triggered = self.create_detector_state(
            detector=detector, detector_group_key="old-triggered", is_triggered=True
        )
        recent_resolved = self.create_detector_state(
            detector=detector, detector_group_key="recent-resolved", is_triggered=False
        )
        other_type = self.create_detector_state(
            detector=self.create_detector(
                project=self.project, type=DetectorType.METRIC_ISSUE.value
            ),
            is_triggered=False,
        )
        DetectorState.objects.filter(
            id__in=[old_resolved.id, old_triggered.id, other_type.id]
        ).update(date_updated=NOW - timedelta(days=31))
        DetectorState.objects.filter(id=recent_resolved.id).update(
            date_updated=NOW - timedelta(days=29)
        )

        schedule.schedule_anomaly_detectors()

        assert list(AnomalyDetectionState.objects.values_list("id", flat=True)) == [active.id]
        assert set(DetectorState.objects.values_list("id", flat=True)) == {
            old_triggered.id,
            recent_resolved.id,
            other_type.id,
        }

    def test_collects_only_enabled_scoped_projects_with_bounded_catchup(self) -> None:
        self.make_detector(self.project)
        self.make_detector(self.project)
        leaving = self.make_detector(self.create_project())
        self.make_detector(self.create_project(), enabled=False)
        self.create_project()
        self.make_detector(self.create_project(organization=self.create_organization()))
        initial_projects = sorted(
            [self.project, leaving.linked_project], key=lambda project: project.id
        )

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]) as collect,
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]) as collect_issues,
            patch.object(schedule, "advance_org", return_value=([], CHECKPOINT)) as advance,
        ):
            assert not schedule._run_organization(self.organization.id, END)
            collect.assert_called_once_with(
                self.organization, initial_projects, START - timedelta(hours=5), END, "1m"
            )
            leaving.update(enabled=False)
            collect.reset_mock()
            assert schedule._run_organization(self.organization.id, END + timedelta(hours=1))

        expected_end = END + timedelta(minutes=15)
        collect.assert_called_once_with(self.organization, [self.project], END, expected_end, "1m")
        assert [entry.args[3:] for entry in collect_issues.call_args_list] == [
            (START - timedelta(hours=5), END),
            (END, expected_end),
        ]
        assert [entry.kwargs for entry in collect_issues.call_args_list] == [
            {"current_rows": []},
            {"current_rows": []},
        ]
        assert [entry.kwargs["start"] for entry in advance.call_args_list] == [START, END]
        assert [entry.kwargs["projects"] for entry in advance.call_args_list] == [
            {self.project.id, leaving.project_id},
            {self.project.id},
        ]
        assert [entry.kwargs["checkpoint"] for entry in advance.call_args_list] == [
            None,
            CHECKPOINT,
        ]
        state = AnomalyDetectionState.objects.get(organization=self.organization)
        assert state.next_minute == expected_end.replace(tzinfo=UTC)

    @freeze_time(NOW)
    def test_worker_enqueues_bounded_catchup_after_releasing_lease(self) -> None:
        self.make_detector(self.project)
        start = END - timedelta(minutes=31)
        state = save_state(self.organization, start, CHECKPOINT)
        target = END.replace(tzinfo=UTC).isoformat()
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=([], CHECKPOINT)) as advance,
            patch.object(locks, "get") as get_lock,
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
        ):
            lease = get_lock.return_value.acquire.return_value

            def enqueue_after_release(_organization_id: int, _end: str) -> None:
                assert lease.__exit__.call_count == enqueue.call_count

            enqueue.side_effect = enqueue_after_release
            schedule.run_anomaly_detection(self.organization.id, target)
            schedule.run_anomaly_detection(*enqueue.call_args.args)
            schedule.run_anomaly_detection(*enqueue.call_args.args)

        assert enqueue.call_args_list == [call(self.organization.id, target)] * 2
        assert [entry.kwargs["end"] for entry in advance.call_args_list] == [
            start + timedelta(minutes=15),
            start + timedelta(minutes=30),
            END,
        ]
        state.refresh_from_db()
        assert state.next_minute == END.replace(tzinfo=UTC)

    def test_cold_worker_publishes_anomaly_evaluated_from_measurements(self) -> None:
        self.make_detector(self.project)
        minute_rows = [
            SeriesRow(
                START - timedelta(minutes=age),
                Signal.ERRORS,
                Metric.COUNT_UNIQUE_USER,
                self.project.id,
                "production",
                "",
                200.0 if age < 5 else 10.0,
            )
            for age in range(64, -1, -1)
        ]
        hourly_rows = [
            SeriesRow(
                START - timedelta(days=days, hours=hours),
                Signal.ERRORS,
                Metric.COUNT_UNIQUE_USER,
                self.project.id,
                "production",
                "",
                10.0,
            )
            for days in range(1, 8)
            for hours in (0, 1, 2)
        ]
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=minute_rows),
            patch.object(schedule, "_hourly_rows", return_value=hourly_rows),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(TraceLookup, "footprint", return_value=None),
            patch(PRODUCE) as produce,
        ):
            assert not schedule._run_organization(self.organization.id, END)

        produce.assert_called_once()
        assert produce.call_args.kwargs["payload_type"] == PayloadType.OCCURRENCE
        occurrence = produce.call_args.kwargs["occurrence"]
        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.type is AnomalyDetection
        assert occurrence.project_id == self.project.id
        assert occurrence.priority == DetectorPriorityLevel.HIGH
        assert occurrence.detection_time == START.replace(tzinfo=UTC)
        state = AnomalyDetectionState.objects.get(organization=self.organization)
        assert state.next_minute == END.replace(tzinfo=UTC)
        assert is_current(state.checkpoint)

    @freeze_time(NOW)
    def test_replay_after_failed_commit_publishes_once(self) -> None:
        self.make_detector(self.project)
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule, "advance_org", return_value=([decision(self.project.id)], CHECKPOINT)
            ) as advance,
            patch(PRODUCE) as produce,
        ):
            with (
                patch.object(schedule, "_commit_checkpoint", side_effect=RuntimeError("crash")),
                pytest.raises(RuntimeError, match="crash"),
            ):
                schedule._run_organization(self.organization.id, END)
            produce.assert_called_once()
            assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()

            assert not schedule._run_organization(self.organization.id, END)

        assert [entry.kwargs["start"] for entry in advance.call_args_list] == [START, START]
        produce.assert_called_once()
        occurrence = produce.call_args.kwargs["occurrence"]
        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.project_id == self.project.id
        assert occurrence.detection_time == START.replace(tzinfo=UTC)
        state = AnomalyDetectionState.objects.get(organization=self.organization)
        assert state.next_minute == END.replace(tzinfo=UTC)
        assert state.checkpoint == CHECKPOINT

    @freeze_time(NOW)
    def test_checkpoint_conflict_keeps_other_worker_progress(self) -> None:
        self.make_detector(self.project)
        start = END - timedelta(minutes=30)
        state = save_state(self.organization, start, CHECKPOINT)
        winner = {**CHECKPOINT, "worker": "winner"}

        def evaluate_while_another_worker_commits(
            **_kwargs: object,
        ) -> tuple[list[AnomalyDecision], dict[str, Any]]:
            AnomalyDetectionState.objects.filter(id=state.id).update(
                next_minute=END.replace(tzinfo=UTC), checkpoint=winner
            )
            return [], {**CHECKPOINT, "worker": "loser"}

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule, "advance_org", side_effect=evaluate_while_another_worker_commits
            ) as advance,
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
        ):
            schedule.run_anomaly_detection(
                self.organization.id, END.replace(tzinfo=UTC).isoformat()
            )

        advance.assert_called_once()
        assert advance.call_args.kwargs["start"] == start
        assert advance.call_args.kwargs["end"] == start + timedelta(minutes=15)
        enqueue.assert_not_called()
        state.refresh_from_db()
        assert state.next_minute == END.replace(tzinfo=UTC)
        assert state.checkpoint == winner

    def test_stale_checkpoint_version_restarts_cold(self) -> None:
        self.make_detector(self.project)
        state = save_state(
            self.organization,
            END - timedelta(minutes=10),
            {"version": CHECKPOINT_VERSION - 1, "qualified": []},
        )
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]) as collect,
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=([], CHECKPOINT)) as advance,
        ):
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_called_once_with(
            self.organization, [self.project], START - timedelta(hours=5), END, "1m"
        )
        advance.assert_called_once()
        assert advance.call_args.kwargs["checkpoint"] is None
        assert advance.call_args.kwargs["start"] == START
        state.refresh_from_db()
        assert state.next_minute == END.replace(tzinfo=UTC)
        assert state.checkpoint == CHECKPOINT

    def test_project_limit_skips_organization(self) -> None:
        self.make_detector(self.project)
        self.make_detector(self.project)
        self.make_detector(self.create_project())
        with (
            self.feature(FEATURES),
            self.options({"anomaly_detection.max_projects_per_organization": 1}),
            patch.object(schedule, "collect") as collect,
            patch.object(metrics, "incr") as incr,
        ):
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        incr.assert_any_call("anomaly_detection.project_limit_exceeded")
        assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()

    def test_no_enabled_detectors_deletes_checkpoint(self) -> None:
        self.make_detector(self.project, enabled=False)
        save_state(self.organization, END, CHECKPOINT)
        with self.feature(FEATURES), patch.object(schedule, "collect") as collect:
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()

    def test_worker_rechecks_gate_before_querying(self) -> None:
        self.make_detector(self.project)
        with (
            self.feature(
                {schedule.FEATURE: True, AnomalyDetection.build_ingest_feature_name(): False}
            ),
            patch.object(schedule, "collect") as collect,
        ):
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()

    def test_worker_rechecks_scope_after_last_project_becomes_ineligible(self) -> None:
        self.make_detector(self.project)
        self.project.update(status=ObjectStatus.PENDING_DELETION)
        with self.feature(FEATURES), patch.object(schedule, "collect") as collect:
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()

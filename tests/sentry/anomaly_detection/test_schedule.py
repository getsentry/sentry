import dataclasses
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call, patch

import pytest

from sentry import features
from sentry.anomaly_detection import schedule
from sentry.anomaly_detection.checkpoint import codec
from sentry.anomaly_detection.contracts import AnomalyGroupKey, Metric, SeriesRow, Signal, Urgency
from sentry.anomaly_detection.evaluation.organization import (
    AnomalyDecision,
    Checkpoint,
    EvaluatorState,
)
from sentry.anomaly_detection.inputs.trace_lookup import TraceLookup
from sentry.anomaly_detection.state import AnomalyDetectionState, get_state, set_state
from sentry.constants import ObjectStatus
from sentry.locks import locks
from sentry.models.organization import OrganizationStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import cell_silo_test
from sentry.types.cell import get_local_cell
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.lock import Lock
from sentry.workflow_engine.handlers.detector_outcome import SeerInvestigationOutcomeHandler
from sentry.workflow_engine.models import Detector, DetectorState
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.types import DetectorInvestigation, DetectorPriorityLevel, DetectorType
from tests.sentry.anomaly_detection.test_helpers import anomaly_decision

NOW = datetime(2025, 1, 1, 12, 3, 12, tzinfo=UTC)
END = datetime(2025, 1, 1, 12, 1, tzinfo=UTC)
START = END - timedelta(minutes=1)
FEATURES = {schedule.FEATURE: True}
CHECKPOINT = Checkpoint({}, {}, EvaluatorState())
BLOB = codec.encode(CHECKPOINT)


def outcome() -> AbstractContextManager[MagicMock]:
    """Capture what the detectors hand to the investigation outcome."""
    return patch.object(SeerInvestigationOutcomeHandler, "handle")


def evaluations(handle: MagicMock) -> list[DetectorEvaluation]:
    return [entry.args[1] for entry in handle.call_args_list]


def results(handle: MagicMock) -> list[object]:
    return [evaluation.result for evaluation in evaluations(handle)]


def decision(project_id: int, *, timestamp: datetime = START) -> AnomalyDecision:
    return anomaly_decision(project_id, timestamp, urgency=Urgency.HIGH)


def checkpoint_at(next_minute: datetime) -> Checkpoint:
    return Checkpoint({}, {}, EvaluatorState(next_minute=next_minute))


def checkpoint_holding(*decisions: AnomalyDecision) -> Checkpoint:
    """A checkpoint whose evaluator holds `decisions` open."""
    return Checkpoint({}, {}, EvaluatorState(published={d.group_key: d for d in decisions}))


def organization_lease(organization_id: int) -> Lock:
    return locks.get(
        f"anomaly-detection:org:{get_local_cell().name}:{organization_id}",
        duration=300,
        name="anomaly_detection_org",
    )


@cell_silo_test
class TestAnomalySchedule(TestCase):
    def make_detector(self, project: Project, *, enabled: bool = True) -> Detector:
        return self.create_detector(
            project=project, type=DetectorType.ANOMALY_DETECTION.value, enabled=enabled
        )

    def save_state(self, next_minute: datetime, checkpoint: bytes = BLOB) -> None:
        set_state(self.organization.id, next_minute=next_minute, checkpoint=checkpoint)

    def stored_state(self) -> AnomalyDetectionState:
        state = get_state(self.organization.id)
        assert state is not None
        return state

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
        inactive_project = self.create_organization()
        project = self.create_project(organization=inactive_project)
        self.make_detector(project)
        project.update(status=ObjectStatus.PENDING_DELETION)
        # Inactive organizations and projects pass the gates; only status filters drop them.
        gated: dict[tuple[object, ...], set[str]] = {
            (organization,): set(FEATURES)
            for organization in (self.organization, inactive, inactive_project)
        }

        def allowed(name: str, *entities: object, **_kwargs: object) -> bool:
            return name in gated.get(entities, ())

        with (
            patch.object(features, "has", side_effect=allowed),
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
        ):
            schedule.schedule_anomaly_detectors()

        enqueue.assert_called_once_with(self.organization.id, END.isoformat())

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
    def test_cleanup_prunes_old_resolved_detector_state(self) -> None:
        detector = self.make_detector(self.project)
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

        schedule.cleanup_anomaly_detection_state()

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
            patch.object(schedule, "hourly_rows", return_value=[]),
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
        assert [entry.kwargs["start"] for entry in advance.call_args_list] == [START, END]
        assert [entry.kwargs["projects"] for entry in advance.call_args_list] == [
            {self.project.id, leaving.project_id},
            {self.project.id},
        ]
        assert [entry.kwargs["checkpoint"] for entry in advance.call_args_list] == [
            None,
            CHECKPOINT,
        ]
        state = self.stored_state()
        assert state.next_minute == expected_end

    def test_evaluator_stages_follow_options(self) -> None:
        self.make_detector(self.project)
        with (
            self.feature(FEATURES),
            self.options(
                {
                    "anomaly_detection.rate_shifts.enabled": True,
                    "anomaly_detection.novelty_admission.enabled": False,
                    "anomaly_detection.shared_dependencies.enabled": True,
                }
            ),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=([], CHECKPOINT)) as advance,
        ):
            schedule._run_organization(self.organization.id, END)

        config = advance.call_args.kwargs["config"]
        assert (config.rate_shifts, config.novelty_admission, config.shared_dependencies) == (
            True,
            False,
            True,
        )

    @freeze_time(NOW)
    def test_worker_enqueues_bounded_catchup_after_releasing_lease(self) -> None:
        self.make_detector(self.project)
        start = END - timedelta(minutes=31)
        self.save_state(start)
        target = END.isoformat()
        lease = organization_lease(self.organization.id)

        def evaluate_under_lease(**_kwargs: object) -> tuple[list[AnomalyDecision], Checkpoint]:
            assert lease.locked()
            return [], CHECKPOINT

        def enqueue_after_release(_organization_id: int, _end: str) -> None:
            assert not lease.locked()

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", side_effect=evaluate_under_lease) as advance,
            patch.object(
                schedule.run_anomaly_detection, "delay", side_effect=enqueue_after_release
            ) as enqueue,
        ):
            schedule.run_anomaly_detection(self.organization.id, target)
            schedule.run_anomaly_detection(*enqueue.call_args.args)
            schedule.run_anomaly_detection(*enqueue.call_args.args)

        assert enqueue.call_args_list == [call(self.organization.id, target)] * 2
        assert [entry.kwargs["end"] for entry in advance.call_args_list] == [
            start + timedelta(minutes=15),
            start + timedelta(minutes=30),
            END,
        ]
        state = self.stored_state()
        assert state.next_minute == END
        assert not lease.locked()

    @freeze_time(NOW)
    def test_worker_skips_organization_leased_by_another_worker(self) -> None:
        self.make_detector(self.project)
        with (
            organization_lease(self.organization.id).acquire(),
            patch.object(schedule, "_run_organization") as run,
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
            patch.object(metrics, "incr") as incr,
        ):
            schedule.run_anomaly_detection(self.organization.id, END.isoformat())

        run.assert_not_called()
        enqueue.assert_not_called()
        incr.assert_any_call("anomaly_detection.worker_already_running")

    @freeze_time(NOW)
    def test_lock_backend_failure_on_a_free_lease_propagates(self) -> None:
        self.make_detector(self.project)
        with (
            patch.object(Lock, "acquire", side_effect=UnableToAcquireLock("backend down")),
            patch.object(schedule, "_run_organization") as run,
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
            pytest.raises(UnableToAcquireLock),
        ):
            schedule.run_anomaly_detection(self.organization.id, END.isoformat())

        assert not organization_lease(self.organization.id).locked()
        run.assert_not_called()
        enqueue.assert_not_called()

    @freeze_time(NOW)
    def test_failed_evaluation_releases_lease_without_advancing(self) -> None:
        self.make_detector(self.project)
        start = END - timedelta(minutes=31)
        self.save_state(start)
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", side_effect=RuntimeError("evaluation failed")),
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
            pytest.raises(RuntimeError, match="evaluation failed"),
        ):
            schedule.run_anomaly_detection(self.organization.id, END.isoformat())

        assert not organization_lease(self.organization.id).locked()
        enqueue.assert_not_called()
        state = self.stored_state()
        assert state.next_minute == start
        assert state.checkpoint == BLOB

    def test_worker_rejects_end_off_utc_minute_boundary(self) -> None:
        with patch.object(schedule, "_run_organization") as run:
            for end in (
                "2025-01-01T12:01:00",
                "2025-01-01T13:01:00+01:00",
                "2025-01-01T12:01:30+00:00",
                "2025-01-01T12:01:00.000001+00:00",
            ):
                with pytest.raises(ValueError, match="UTC minute boundary"):
                    schedule.run_anomaly_detection(self.organization.id, end)

        run.assert_not_called()
        assert not organization_lease(self.organization.id).locked()

    @freeze_time(NOW)
    def test_checkpoint_far_behind_target_restarts_cold(self) -> None:
        self.make_detector(self.project)
        self.save_state(END - timedelta(minutes=61))
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]) as collect,
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=([], CHECKPOINT)) as advance,
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
            patch.object(metrics, "incr") as incr,
        ):
            schedule.run_anomaly_detection(self.organization.id, END.isoformat())

        collect.assert_called_once_with(
            self.organization, [self.project], START - timedelta(hours=5), END, "1m"
        )
        advance.assert_called_once()
        assert advance.call_args.kwargs["checkpoint"] is None
        assert advance.call_args.kwargs["start"] == START
        incr.assert_any_call("anomaly_detection.checkpoint_expired")
        enqueue.assert_not_called()
        state = self.stored_state()
        assert state.next_minute == END
        assert codec.decode(state.checkpoint) == CHECKPOINT

    def open_groups(self, detector: Detector, *decisions: AnomalyDecision) -> None:
        """Open groups in Workflow Engine, as an earlier run would have."""
        schedule._publish(
            decisions,
            {self.project.id: detector},
            checkpoint_holding(*decisions).open_groups(),
            max(decision.timestamp for decision in decisions),
        )

    @freeze_time(NOW)
    def test_cold_start_resolves_groups_the_expired_checkpoint_left_open(self) -> None:
        detector = self.make_detector(self.project)
        self.save_state(END - timedelta(minutes=61))
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=([], CHECKPOINT)),
            patch.object(metrics, "incr") as incr,
            outcome() as handle,
        ):
            self.open_groups(
                detector, decision(self.project.id, timestamp=END - timedelta(minutes=70))
            )
            [opened] = results(handle)
            handle.reset_mock()
            assert not schedule._run_organization(self.organization.id, END)

        # Resolving only closes the group's DetectorState: investigations don't resolve.
        handle.assert_not_called()
        assert isinstance(opened, DetectorInvestigation)
        state = DetectorState.objects.get(detector=detector, detector_group_key="group")
        assert not state.is_triggered
        incr.assert_any_call("anomaly_detection.checkpoint_expired")
        incr.assert_any_call("anomaly_detection.stranded_groups_resolved", amount=1)

    @freeze_time(NOW)
    def test_cold_start_keeps_groups_it_still_tracks_open(self) -> None:
        detector = self.make_detector(self.project)
        ongoing = decision(self.project.id, timestamp=END - timedelta(minutes=70))
        stale = dataclasses.replace(ongoing, group_key=AnomalyGroupKey("stale"))
        restated = decision(self.project.id)
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule, "advance_org", return_value=([restated], checkpoint_holding(restated))
            ),
            outcome() as handle,
        ):
            self.open_groups(detector, ongoing, stale)
            handle.reset_mock()
            assert not schedule._run_organization(self.organization.id, END)

        handle.assert_not_called()
        assert dict(
            DetectorState.objects.filter(detector=detector).values_list(
                "detector_group_key", "is_triggered"
            )
        ) == {"group": True, "stale": False}

    @freeze_time(NOW)
    def test_resumed_run_resolves_groups_the_evaluator_no_longer_holds(self) -> None:
        detector = self.make_detector(self.project)
        held = decision(self.project.id, timestamp=END - timedelta(minutes=10))
        lost = dataclasses.replace(held, group_key=AnomalyGroupKey("lost"))
        self.save_state(END - timedelta(minutes=3))
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=([], checkpoint_holding(held))),
            outcome() as handle,
        ):
            self.open_groups(detector, held, lost)
            handle.reset_mock()
            assert not schedule._run_organization(self.organization.id, END)

        handle.assert_not_called()
        assert dict(
            DetectorState.objects.filter(detector=detector).values_list(
                "detector_group_key", "is_triggered"
            )
        ) == {"group": True, "lost": False}

    def test_unreadable_checkpoint_at_target_waits_for_an_unprocessed_minute(self) -> None:
        self.make_detector(self.project)
        self.save_state(END, b"not a checkpoint")
        with self.feature(FEATURES), patch.object(schedule, "collect") as collect:
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        state = self.stored_state()
        assert state.next_minute == END

    def test_cold_worker_publishes_anomaly_evaluated_from_measurements(self) -> None:
        self.make_detector(self.project)
        minute_rows = [
            SeriesRow(
                START - timedelta(minutes=age),
                self.project.id,
                "production",
                Signal.ERRORS,
                Metric.COUNT_UNIQUE_USER,
                "",
                200.0 if age < 5 else 10.0,
            )
            for age in range(64, -1, -1)
        ]
        hourly = [
            SeriesRow(
                START - timedelta(days=days, hours=hours),
                self.project.id,
                "production",
                Signal.ERRORS,
                Metric.COUNT_UNIQUE_USER,
                "",
                10.0,
            )
            for days in range(1, 8)
            for hours in (0, 1, 2)
        ]
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=minute_rows),
            patch.object(schedule, "hourly_rows", return_value=hourly),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(TraceLookup, "footprint", return_value=None),
            outcome() as handle,
        ):
            assert not schedule._run_organization(self.organization.id, END)

        [evaluation] = evaluations(handle)
        investigation = evaluation.result
        assert isinstance(investigation, DetectorInvestigation)
        assert handle.call_args.args[0].project_id == self.project.id
        assert evaluation.priority == DetectorPriorityLevel.HIGH
        assert investigation.detection_time == START
        state = self.stored_state()
        assert state.next_minute == END
        stored = codec.decode(state.checkpoint)
        assert stored is not None
        assert stored.state.next_minute == END

    @freeze_time(NOW)
    def test_replay_after_failed_commit_publishes_once(self) -> None:
        self.make_detector(self.project)
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule, "advance_org", return_value=([decision(self.project.id)], CHECKPOINT)
            ) as advance,
            outcome() as handle,
        ):
            with (
                patch.object(schedule, "set_state", side_effect=RuntimeError("crash")),
                pytest.raises(RuntimeError, match="crash"),
            ):
                schedule._run_organization(self.organization.id, END)
            handle.assert_called_once()
            assert get_state(self.organization.id) is None

            assert not schedule._run_organization(self.organization.id, END)

        assert [entry.kwargs["start"] for entry in advance.call_args_list] == [START, START]
        [investigation] = results(handle)
        assert isinstance(investigation, DetectorInvestigation)
        assert handle.call_args.args[0].project_id == self.project.id
        assert investigation.detection_time == START
        state = self.stored_state()
        assert state.next_minute == END
        assert state.checkpoint == BLOB

    def test_stale_checkpoint_version_restarts_cold(self) -> None:
        self.make_detector(self.project)
        with patch.object(codec, "CHECKPOINT_VERSION", codec.CHECKPOINT_VERSION - 1):
            stale = codec.encode(checkpoint_at(END - timedelta(minutes=10)))
        self.save_state(END - timedelta(minutes=10), stale)
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]) as collect,
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=([], CHECKPOINT)) as advance,
            patch.object(metrics, "incr") as incr,
        ):
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_called_once_with(
            self.organization, [self.project], START - timedelta(hours=5), END, "1m"
        )
        advance.assert_called_once()
        assert advance.call_args.kwargs["checkpoint"] is None
        assert advance.call_args.kwargs["start"] == START
        incr.assert_any_call("anomaly_detection.checkpoint_discarded")
        state = self.stored_state()
        assert state.next_minute == END
        assert state.checkpoint == BLOB

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
        assert get_state(self.organization.id) is None

    def test_no_enabled_detectors_deletes_checkpoint(self) -> None:
        self.make_detector(self.project, enabled=False)
        self.save_state(END)
        with self.feature(FEATURES), patch.object(schedule, "collect") as collect:
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert get_state(self.organization.id) is None

    def test_worker_rechecks_gate_before_querying(self) -> None:
        self.make_detector(self.project)
        with (
            self.feature({**FEATURES, schedule.FEATURE: False}),
            patch.object(schedule, "collect") as collect,
        ):
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert get_state(self.organization.id) is None

    def test_worker_rechecks_scope_after_last_project_becomes_ineligible(self) -> None:
        self.make_detector(self.project)
        self.project.update(status=ObjectStatus.PENDING_DELETION)
        with self.feature(FEATURES), patch.object(schedule, "collect") as collect:
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert get_state(self.organization.id) is None

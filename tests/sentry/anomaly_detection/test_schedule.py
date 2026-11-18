from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from sentry import features
from sentry.anomaly_detection import schedule
from sentry.anomaly_detection.checkpoint import CHECKPOINT_VERSION
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.enrichment import TraceLookup
from sentry.anomaly_detection.grouptype import (
    AnomalyDetection,
    AnomalyDetectionDetectorHandler,
    AnomalyTransition,
)
from sentry.anomaly_detection.pipeline import AnomalyDecision
from sentry.anomaly_detection.state import DeliveryState
from sentry.constants import ObjectStatus
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.types import DetectorType

NOW = datetime(2025, 1, 1, 12, 3, 12, tzinfo=UTC)
END = datetime(2025, 1, 1, 12, 1)
START = END - timedelta(minutes=1)
FEATURES = {
    schedule.FEATURE: True,
    AnomalyDetection.build_ingest_feature_name(): True,
}


def decision(
    project_id: int,
    *,
    key: str = "group",
    timestamp: datetime = START,
    resolved: bool = False,
    urgency: Urgency = Urgency.HIGH,
) -> AnomalyDecision:
    return AnomalyDecision(
        group_key=key,
        project_id=project_id,
        timestamp=timestamp,
        urgency=urgency,
        is_resolved=resolved,
        title=f"Anomaly in project {project_id}",
        evidence={"internal": "not published"},
        env="production",
    )


@cell_silo_test
class TestAnomalySchedule(TestCase):
    def make_detector(self, project: Project, *, enabled: bool = True) -> Detector:
        return self.create_detector(
            project=project, type=DetectorType.ANOMALY_DETECTION, enabled=enabled
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
        inactive_project = self.create_organization()
        project = self.create_project(organization=inactive_project)
        self.make_detector(project)
        project.update(status=ObjectStatus.PENDING_DELETION)

        def allowed(flag: str, org: Organization) -> bool:
            return org == self.organization and flag in FEATURES

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
        with (
            self.feature(FEATURES),
            patch.object(schedule, "_MAX_ORGS_PER_TICK", 2),
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
        ):
            schedule.schedule_anomaly_detectors()
            schedule.schedule_anomaly_detectors()

        ids = sorted(organization.id for organization in organizations)
        assert [call.args[0] for call in enqueue.call_args_list] == ids + ids[:1]

    def test_collects_only_enabled_scoped_projects_with_bounded_catchup(self) -> None:
        primary = self.make_detector(self.project)
        self.make_detector(self.project)
        leaving = self.make_detector(self.create_project())
        self.make_detector(self.create_project(), enabled=False)
        self.create_project()
        foreign = self.create_project(organization=self.create_organization())
        self.make_detector(foreign)
        checkpoint = {"version": CHECKPOINT_VERSION, "qualified": []}
        initial_projects = sorted(
            [primary.linked_project, leaving.linked_project], key=lambda project: project.id
        )

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]) as collect,
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]) as collect_issues,
            patch.object(schedule, "advance_org", return_value=([], checkpoint)) as advance,
        ):
            schedule._run_organization(self.organization.id, END)
            collect.assert_called_once_with(
                self.organization, initial_projects, START - timedelta(hours=5), END, "1m"
            )
            leaving.update(enabled=False)
            collect.reset_mock()
            schedule._run_organization(self.organization.id, END + timedelta(hours=1))

        expected_end = END + timedelta(minutes=15)
        collect.assert_called_once_with(self.organization, [self.project], END, expected_end, "1m")
        assert [call.args[3:] for call in collect_issues.call_args_list] == [
            (START - timedelta(hours=5), END),
            (END, expected_end),
        ]
        assert [call.kwargs["start"] for call in advance.call_args_list] == [START, END]
        assert [call.kwargs["current_projects"] for call in advance.call_args_list] == [
            {str(self.project.id), str(leaving.project_id)},
            {str(self.project.id)},
        ]
        assert [call.kwargs["checkpoint"] for call in advance.call_args_list] == [None, checkpoint]
        state = AnomalyDetectionState.objects.get(organization=self.organization)
        assert state.next_minute == expected_end.replace(tzinfo=UTC)

    def test_cold_worker_publishes_anomaly_still_active_after_warmup(self) -> None:
        detector = self.make_detector(self.project)
        issue = ChangeEvent(
            SeriesKey(str(self.project.id), "production", "new_issue", "count_unique(user)", "42"),
            ChangeType.NEW_FAILURE_MODE,
            START - timedelta(minutes=5),
            actual=60.0,
            expected=60.0,
            confidence=0.9,
        )
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[issue]),
            patch.object(TraceLookup, "footprint", return_value=None),
            patch.object(schedule, "publish_anomaly_transition") as publish,
        ):
            schedule._run_organization(self.organization.id, END)

        assert publish.call_count == 1
        owner, opened = publish.call_args.args
        assert owner == detector
        assert opened.timestamp == START
        assert not opened.is_resolved

    def test_worker_rechecks_gate_before_querying(self) -> None:
        self.make_detector(self.project)
        with (
            self.feature(
                {schedule.FEATURE: True, AnomalyDetection.build_ingest_feature_name(): False}
            ),
            patch.object(schedule, "collect") as collect,
        ):
            schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()

    @freeze_time(NOW)
    def test_publisher_failure_does_not_ack_or_send_close(self) -> None:
        detector = self.make_detector(self.project)
        decisions = [decision(self.project.id), decision(self.project.id, resolved=True)]
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule,
                "advance_org",
                return_value=(
                    decisions,
                    {"version": CHECKPOINT_VERSION, "qualified": [{"group_key": "group"}]},
                ),
            ) as advance,
            patch.object(schedule, "get_group_from_fingerprint", return_value=None) as lookup,
            patch.object(
                schedule,
                "publish_anomaly_transition",
                side_effect=TimeoutError("Kafka acknowledgement"),
            ) as publish,
        ):
            with pytest.raises(TimeoutError, match="Kafka acknowledgement"):
                schedule._run_organization(self.organization.id, END)
            state = AnomalyDetectionState.objects.get(organization=self.organization)
            assert state.next_minute == END.replace(tzinfo=UTC)
            pending = DeliveryState.from_json(state.delivery).pending
            assert [item.transition.is_resolved for item in pending] == [False, True]
            assert pending[0].transition.group_key == pending[1].transition.group_key
            assert pending[0].broker_acked_at is None
            first_attempt = publish.call_args.args

            publish.side_effect = None
            schedule._run_organization(self.organization.id, END)
            assert publish.call_args.args == first_attempt
            state = AnomalyDetectionState.objects.get(id=state.id)
            assert DeliveryState.from_json(state.delivery).pending[0].broker_acked_at == NOW
            # Kafka acknowledgement alone must neither pop the open nor publish the close.
            schedule._run_organization(self.organization.id, END)
            assert publish.call_count == 2
            with freeze_time(NOW + timedelta(minutes=5)):
                schedule._run_organization(self.organization.id, END)
            assert publish.call_args.args == first_attempt
            assert publish.call_count == 3

            lookup.return_value = SimpleNamespace(
                status=GroupStatus.UNRESOLVED, last_seen=START.replace(tzinfo=UTC)
            )
            schedule._run_organization(self.organization.id, END)
            assert publish.call_count == 4
            assert publish.call_args.args[0] == detector
            assert publish.call_args.args[1].is_resolved
            lookup.assert_called_with(
                self.project.id,
                hash_fingerprint(
                    AnomalyDetectionDetectorHandler(detector).get_issue_fingerprint(
                        pending[0].transition.group_key
                    )
                ),
            )
            lookup.return_value.status = GroupStatus.RESOLVED
            schedule._run_organization(self.organization.id, END)
            assert publish.call_count == 4

        advance.assert_called_once()
        state = AnomalyDetectionState.objects.get(id=state.id)
        assert not DeliveryState.from_json(state.delivery).pending

    @freeze_time(NOW)
    def test_late_close_retry_only_targets_its_activation(self) -> None:
        detector = self.make_detector(self.project)
        handler = AnomalyDetectionDetectorHandler(detector)
        checkpoint = {"version": CHECKPOINT_VERSION, "qualified": [{"group_key": "group"}]}
        first_window = [decision(self.project.id), decision(self.project.id, resolved=True)]
        next_end = END + timedelta(minutes=1)

        def ingest_open(transition: AnomalyTransition) -> Group:
            assert not transition.is_resolved
            evaluation = handler._evaluate(
                DataPacket(source_id=str(detector.id), packet=transition)
            )
            occurrence = evaluation[transition.group_key].result
            assert isinstance(occurrence, IssueOccurrence)
            group = self.create_group(
                type=AnomalyDetection.type_id,
                first_seen=transition.timestamp_utc,
                last_seen=transition.timestamp_utc,
            )
            GroupHash.objects.create(
                project=self.project, group=group, hash=hash_fingerprint(occurrence.fingerprint)[0]
            )
            return group

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule,
                "advance_org",
                side_effect=[
                    (first_window, checkpoint),
                    ([decision(self.project.id, timestamp=END)], checkpoint),
                ],
            ),
            patch.object(schedule, "publish_anomaly_transition") as publish,
            patch("sentry.issues.status_change_consumer.kick_off_status_syncs"),
        ):
            schedule._run_organization(self.organization.id, END)
            old_open = publish.call_args.args[1]
            old_group = ingest_open(old_open)
            schedule._run_organization(self.organization.id, END)
            close = publish.call_args.args[1]
            evaluation = handler._evaluate(DataPacket(source_id=str(detector.id), packet=close))
            status_change = evaluation[close.group_key].result
            assert isinstance(status_change, StatusChangeMessage)
            payload = {**status_change.to_dict(), "payload_type": "status_change"}

            # The original close has not reached the consumer, so publish a retry.
            with freeze_time(NOW + timedelta(minutes=5)):
                schedule._run_organization(self.organization.id, END)
            assert publish.call_count == 3
            assert publish.call_args_list[1] == publish.call_args_list[2]

            _process_message(payload)
            old_group.refresh_from_db()
            assert old_group.status == GroupStatus.RESOLVED

            # A later org run observes the original close before publishing the reopen.
            schedule._run_organization(self.organization.id, next_end)
            assert publish.call_count == 4
            owner, reopened = publish.call_args.args
            assert owner == detector
            assert reopened.group_key != old_open.group_key
            new_group = ingest_open(reopened)

            # The retry arrives after the new activation. Do not assume broker order or dedup.
            result = _process_message(payload)
            assert result is not None and result[1] is not None
            assert result[1].group.id == old_group.id
            old_group.refresh_from_db()
            new_group.refresh_from_db()
            assert old_group.status == GroupStatus.RESOLVED
            assert new_group.status == GroupStatus.UNRESOLVED

    def test_disabled_pinned_detector_does_not_block_other_deliveries(self) -> None:
        detector = self.make_detector(self.project)
        replacement = self.make_detector(self.project)
        delivery = DeliveryState()
        delivery.stage(
            [decision(self.project.id), decision(self.project.id, resolved=True)],
            {self.project.id: detector.id},
            start=START,
            end=END,
            retained_keys={"group"},
        )
        state, _ = AnomalyDetectionState.objects.get_or_create(organization=self.organization)
        state.update(delivery=delivery.to_json(), next_minute=END.replace(tzinfo=UTC))
        detector.update(enabled=False)
        with (
            self.feature(FEATURES),
            patch.object(schedule, "publish_anomaly_transition") as publish,
        ):
            schedule._run_organization(self.organization.id, END)
        publish.assert_not_called()

        state = AnomalyDetectionState.objects.get(id=state.id)
        delivery = DeliveryState.from_json(state.delivery)
        assert not delivery.pending
        assert delivery.pins["group"].detector_id == detector.id
        assert delivery.pins["group"].retired
        delivery.stage(
            [
                decision(self.project.id, timestamp=END),
                decision(self.project.id, timestamp=END, key="new"),
            ],
            {self.project.id: replacement.id},
            start=END,
            end=END + timedelta(minutes=1),
            retained_keys={"group", "new"},
        )
        assert [item.logical_key for item in delivery.pending] == ["new"]
        assert delivery.pending[0].detector_id == replacement.id


def test_delivery_pins_scope_and_rejects_unopened_groups() -> None:
    state = DeliveryState()
    state.stage(
        [
            decision(1, key="warmup", timestamp=START - timedelta(minutes=1)),
            decision(2, key="foreign"),
            decision(1, key="orphan", resolved=True),
            decision(1),
        ],
        {1: 11},
        start=START,
        end=END,
        retained_keys={"group"},
    )
    state = DeliveryState.from_json(state.to_json())
    state.stage(
        [decision(2, timestamp=END, resolved=True)],
        {1: 12, 2: 22},
        start=END,
        end=END + timedelta(minutes=1),
        retained_keys={"group"},
    )
    assert [item.transition.is_resolved for item in state.pending] == [False, True]
    for item in state.pending:
        assert item.detector_id == 11
        assert item.transition.project_id == 1
        assert item.transition.title == "Anomaly in project 1"
        assert item.transition.evidence == {}


def test_delivery_keeps_pin_on_reopen_and_confirms_qualified_low_priority() -> None:
    state = DeliveryState()
    state.stage(
        [decision(1, urgency=Urgency.LOW), decision(1, resolved=True)],
        {1: 11},
        start=START,
        end=END,
        retained_keys={"group"},
    )
    assert [item.transition.is_resolved for item in state.pending] == [False, True]
    first_activation = state.pending[0].transition.group_key
    assert state.pending[0].confirm_ingested
    assert state.pending[1].transition.group_key == first_activation
    state.pending.clear()
    state = DeliveryState.from_json(state.to_json())
    state.stage(
        [
            decision(2, timestamp=END, urgency=Urgency.LOW),
            decision(2, timestamp=END + timedelta(minutes=1)),
            decision(2, timestamp=END + timedelta(minutes=2), resolved=True),
        ],
        {1: 12, 2: 22},
        start=END,
        end=END + timedelta(minutes=3),
        retained_keys={"group"},
    )
    state = DeliveryState.from_json(state.to_json())
    reopened, escalation, closed = state.pending
    assert reopened.transition.group_key != first_activation
    assert reopened.confirm_ingested
    assert not escalation.confirm_ingested
    assert closed.confirm_ingested
    assert [item.transition.is_resolved for item in state.pending] == [False, False, True]
    for item in state.pending:
        assert item.transition.group_key == reopened.transition.group_key
        assert item.detector_id == 11
        assert item.transition.project_id == 1


def test_delivery_forgets_unqueued_pins_removed_from_evaluator_scope() -> None:
    state = DeliveryState()
    state.stage([decision(1)], {1: 11}, start=START, end=END, retained_keys={"group"})
    state.pending.clear()
    state.stage([], {}, start=END, end=END + timedelta(minutes=1), retained_keys=set())
    assert not state.pins
    assert not state.pending

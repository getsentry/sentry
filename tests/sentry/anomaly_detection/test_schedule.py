from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import call, patch

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition
from arroyo.types import Topic as ArroyoTopic
from django.test import override_settings

from sentry import features
from sentry.anomaly_detection import schedule
from sentry.anomaly_detection.checkpoint.codec import CHECKPOINT_VERSION
from sentry.anomaly_detection.contracts import Urgency
from sentry.anomaly_detection.delivery import outbox, pending_transitions
from sentry.anomaly_detection.delivery.pending_transitions import DeliveryState
from sentry.anomaly_detection.delivery.transition import AnomalyTransition
from sentry.anomaly_detection.detector_handler import (
    AnomalyDetectionDetectorHandler,
    enabled_anomaly_detectors,
)
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision
from sentry.anomaly_detection.evaluation.series import SeriesRow
from sentry.anomaly_detection.grouptype import AnomalyDetection
from sentry.anomaly_detection.inputs.trace_lookup import TraceLookup
from sentry.conf.types.kafka_definition import Topic
from sentry.constants import ObjectStatus
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.locks import locks
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.organization import OrganizationStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import cell_silo_test
from sentry.utils import json, metrics
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.types import DetectorPriorityLevel, DetectorType

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
            patch.object(schedule, "_MAX_ORGS_PER_TICK", 2),
            patch.object(schedule.run_anomaly_detection, "delay") as enqueue,
        ):
            schedule.schedule_anomaly_detectors()
            assert [entry.args[0] for entry in enqueue.call_args_list] == ids[:2]
            enqueue.reset_mock()
            schedule.schedule_anomaly_detectors()
            assert [entry.args[0] for entry in enqueue.call_args_list] == ids[2:] + ids[:1]

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
        assert [call.kwargs for call in collect_issues.call_args_list] == [
            {"current_rows": []},
            {"current_rows": []},
        ]
        assert [call.kwargs["start"] for call in advance.call_args_list] == [START, END]
        assert [
            {
                project_id: handler.detector.id
                for project_id, handler in call.kwargs["handlers"].items()
            }
            for call in advance.call_args_list
        ] == [
            {str(self.project.id): primary.id, str(leaving.project_id): leaving.id},
            {str(self.project.id): primary.id},
        ]
        assert [call.kwargs["checkpoint"] for call in advance.call_args_list] == [None, checkpoint]
        state = AnomalyDetectionState.objects.get(organization=self.organization)
        assert state.next_minute == expected_end.replace(tzinfo=UTC)

    @freeze_time(NOW)
    def test_worker_enqueues_bounded_catchup_after_releasing_lease(self) -> None:
        self.make_detector(self.project)
        start = END - timedelta(minutes=31)
        state, _ = AnomalyDetectionState.objects.get_or_create(organization=self.organization)
        state.update(next_minute=start.replace(tzinfo=UTC))
        target = END.replace(tzinfo=UTC).isoformat()
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule,
                "advance_org",
                return_value=([], {"version": CHECKPOINT_VERSION, "qualified": []}),
            ) as advance,
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

    @freeze_time(NOW)
    def test_commits_large_batch_and_drains_a_bounded_number_per_run(self) -> None:
        self.make_detector(self.project)
        decisions = [decision(self.project.id, key=f"group-{index}") for index in range(320)]
        checkpoint = {
            "version": CHECKPOINT_VERSION,
            "qualified": [{"group_key": item.group_key} for item in decisions],
        }
        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=(decisions, checkpoint)) as advance,
            patch.object(outbox, "publish_anomaly_transition") as publish,
        ):
            assert schedule._run_organization(self.organization.id, END)
            assert publish.call_count == outbox._MAX_DELIVERIES
            assert schedule._run_organization(self.organization.id, END + timedelta(minutes=1))
            assert publish.call_count == 2 * outbox._MAX_DELIVERIES

        assert [entry.kwargs["start"] for entry in advance.call_args_list] == [START, END]
        state = AnomalyDetectionState.objects.get(organization=self.organization)
        assert state.next_minute == (END + timedelta(minutes=1)).replace(tzinfo=UTC)
        assert state.checkpoint == checkpoint
        delivery = DeliveryState.from_json(state.delivery)
        assert len(delivery.pending) == len(delivery.pins) == 320
        assert {entry.args[1].group_key for entry in publish.call_args_list} == {
            item.transition.group_key
            for item in delivery.pending
            if item.broker_acked_at is not None
        }

    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_cold_worker_publishes_anomaly_evaluated_from_measurements(self) -> None:
        detector = self.make_detector(self.project)
        broker = LocalBroker(MemoryMessageStorage[KafkaPayload]())
        topic = ArroyoTopic(get_topic_definition(Topic.INGEST_OCCURRENCES)["real_topic_name"])
        broker.create_topic(topic, partitions=1)
        project_id = str(self.project.id)
        minute_rows: list[SeriesRow] = [
            (
                START - timedelta(minutes=age),
                "errors",
                "count_unique(user)",
                project_id,
                "production",
                "",
                200.0 if age < 5 else 10.0,
            )
            for age in range(64, -1, -1)
        ]
        hourly_rows: list[SeriesRow] = [
            (
                START - timedelta(days=days, hours=hours),
                "errors",
                "count_unique(user)",
                project_id,
                "production",
                "",
                10.0,
            )
            for days in range(1, 8)
            for hours in (0, 1, 2)
        ]
        with (
            self.feature(
                {**FEATURES, "organizations:workflow-engine-evaluation-artifacts-eap": True}
            ),
            patch.object(schedule, "collect", return_value=minute_rows),
            patch.object(schedule, "_hourly_rows", return_value=hourly_rows),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(TraceLookup, "footprint", return_value=None),
            patch("sentry.issues.producer._confirmed_occurrence_producer", broker.get_producer()),
            patch(
                "sentry.workflow_engine.processors.evaluations.tracking._eap_emitter.send"
            ) as emit,
        ):
            schedule._run_organization(self.organization.id, END)

        message = broker.consume(Partition(topic, 0), 0)
        assert message is not None
        occurrence = json.loads(message.payload.value)
        assert occurrence["type"] == AnomalyDetection.type_id
        assert occurrence["project_id"] == self.project.id
        emit.assert_called_once()
        organization, result = emit.call_args.args
        assert organization == self.organization
        assert result.detector_id == detector.id
        assert result.project_id == self.project.id
        (evaluation,) = result.evaluation_artifacts()
        assert evaluation.triggered
        assert evaluation.priority == DetectorPriorityLevel.HIGH.value
        assert evaluation.event_id == occurrence["event_id"]
        state = AnomalyDetectionState.objects.get(organization=self.organization)
        (pending,) = DeliveryState.from_json(state.delivery).pending
        assert pending.transition.timestamp == START
        assert pending.broker_acked_at is not None

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

    def test_cold_worker_rechecks_scope_after_last_project_becomes_ineligible(self) -> None:
        self.make_detector(self.project)
        scoped = enabled_anomaly_detectors().filter(project__organization_id=self.organization.id)
        exists = scoped.exists

        def stale_candidate_lookup() -> bool:
            assert exists()
            assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()
            self.project.update(status=ObjectStatus.PENDING_DELETION)
            return True

        with (
            self.feature(FEATURES),
            patch.object(schedule, "enabled_anomaly_detectors") as enabled,
            patch.object(scoped, "exists", side_effect=stale_candidate_lookup),
            patch.object(schedule, "collect") as collect,
        ):
            enabled.return_value.filter.return_value = scoped
            assert not schedule._run_organization(self.organization.id, END)

        collect.assert_not_called()
        assert not AnomalyDetectionState.objects.filter(organization=self.organization).exists()

    @freeze_time(NOW)
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
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
            patch.object(outbox, "get_group_from_fingerprint", return_value=None) as lookup,
            patch.object(
                outbox,
                "publish_anomaly_transition",
                wraps=outbox.publish_anomaly_transition,
            ) as publish,
            patch("sentry.issues.producer._confirmed_occurrence_producer") as producer,
        ):
            broker_result = producer.produce.return_value.result
            broker_result.side_effect = TimeoutError("Kafka acknowledgement")
            schedule._run_organization(self.organization.id, END)
            state = AnomalyDetectionState.objects.get(organization=self.organization)
            assert state.next_minute == END.replace(tzinfo=UTC)
            pending = DeliveryState.from_json(state.delivery).pending
            assert [item.transition.is_resolved for item in pending] == [False, True]
            assert pending[0].transition.group_key == pending[1].transition.group_key
            assert pending[0].broker_acked_at is None
            assert pending[0].attempts == 1
            first_attempt = publish.call_args.args

            broker_result.side_effect = None
            schedule._run_organization(self.organization.id, END)
            publish.assert_called_once()
            retry_time = NOW + outbox._PUBLISH_RETRY_DELAY
            with freeze_time(retry_time):
                schedule._run_organization(self.organization.id, END)
            assert publish.call_args.args == first_attempt
            state = AnomalyDetectionState.objects.get(id=state.id)
            assert DeliveryState.from_json(state.delivery).pending[0].broker_acked_at == retry_time
            # Kafka acknowledgement alone must neither pop the open nor publish the close.
            schedule._run_organization(self.organization.id, END)
            assert publish.call_count == 2
            with freeze_time(retry_time + outbox._INGEST_RETRY_DELAY):
                schedule._run_organization(self.organization.id, END)
            assert publish.call_args.args == first_attempt
            assert publish.call_count == 3

            lookup.return_value = SimpleNamespace(
                status=GroupStatus.UNRESOLVED, last_seen=START.replace(tzinfo=UTC)
            )
            schedule._run_organization(self.organization.id, END)
            assert publish.call_count == 4
            assert producer.produce.call_count == 4
            payload = json.loads(producer.produce.call_args.args[1].value)
            assert payload["payload_type"] == "status_change"
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
    def test_rejected_open_does_not_block_next_window_or_unrelated_project(self) -> None:
        rejected_detector = self.make_detector(self.project)
        unrelated = self.create_project()
        first_window = [decision(self.project.id), decision(self.project.id, resolved=True)]
        second_window = [decision(unrelated.id, key="unrelated", timestamp=END)]
        qualified = [{"group_key": "group"}]
        checkpoint = {"version": CHECKPOINT_VERSION, "qualified": qualified}
        next_checkpoint = {
            **checkpoint,
            "qualified": [*qualified, {"group_key": "unrelated"}],
        }
        target = END + timedelta(minutes=1)
        groups: dict[int, SimpleNamespace] = {}

        def publish_transition(detector: Detector, _transition: AnomalyTransition) -> None:
            if detector == rejected_detector:
                raise TimeoutError("Kafka acknowledgement")

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(
                schedule,
                "advance_org",
                side_effect=[(first_window, checkpoint), (second_window, next_checkpoint)],
            ) as advance,
            patch.object(
                outbox,
                "get_group_from_fingerprint",
                side_effect=lambda project_id, _: groups.get(project_id),
            ),
            patch.object(
                outbox, "publish_anomaly_transition", side_effect=publish_transition
            ) as publish,
            patch.object(metrics, "incr") as incr,
        ):
            schedule._run_organization(self.organization.id, END)
            unrelated_detector = self.make_detector(unrelated)
            schedule._run_organization(self.organization.id, target)
            state = AnomalyDetectionState.objects.get(organization=self.organization)
            assert state.next_minute == target.replace(tzinfo=UTC)
            assert state.checkpoint == next_checkpoint
            pending = DeliveryState.from_json(state.delivery).pending
            rejected = [item for item in pending if item.logical_key == "group"]
            (unrelated_open,) = [item for item in pending if item.logical_key == "unrelated"]
            assert [item.kind for item in rejected] == ["open", "close"]
            assert rejected[0].attempts == 1
            assert rejected[0].broker_acked_at is None
            assert unrelated_open.broker_acked_at == NOW

            # The unrelated publication is independently confirmed. The rejected
            # open's remaining attempts never publish its dependent close.
            groups[unrelated.id] = SimpleNamespace(last_seen=END.replace(tzinfo=UTC))
            for attempt in range(1, outbox._MAX_ATTEMPTS + 1):
                with freeze_time(NOW + attempt * outbox._PUBLISH_RETRY_DELAY):
                    schedule._run_organization(self.organization.id, target)

        assert [entry.kwargs["start"] for entry in advance.call_args_list] == [START, END]
        rejected_publication = call(rejected_detector, rejected[0].transition)
        assert publish.call_args_list == [
            rejected_publication,
            call(unrelated_detector, unrelated_open.transition),
            *([rejected_publication] * (outbox._MAX_ATTEMPTS - 1)),
        ]
        incr.assert_any_call(
            "anomaly_detection.delivery_dropped",
            amount=2,
            tags={"reason": "attempts_exhausted", "kind": "open"},
            sample_rate=1.0,
        )
        state.refresh_from_db()
        delivery = DeliveryState.from_json(state.delivery)
        assert not delivery.pending
        assert delivery.pins["group"].activation_retired
        assert not delivery.pins["unrelated"].activation_retired

    @freeze_time(NOW)
    def test_concurrent_drain_cannot_resurrect_confirmed_open(self) -> None:
        detector = self.make_detector(self.project)
        delivery = DeliveryState()
        delivery.stage(
            [decision(self.project.id)],
            {self.project.id: detector.id},
            start=START,
            end=END,
            retained_keys={"group"},
        )
        checkpoint = {"version": CHECKPOINT_VERSION, "qualified": [{"group_key": "group"}]}
        state = AnomalyDetectionState.objects.create(
            organization=self.organization,
            next_minute=END.replace(tzinfo=UTC),
            checkpoint=checkpoint,
            delivery=delivery.to_json(),
        )
        next_checkpoint = {"version": CHECKPOINT_VERSION, "qualified": []}
        target = END + timedelta(minutes=1)
        update = decision(self.project.id, timestamp=END)

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org") as advance,
            patch.object(outbox, "get_group_from_fingerprint", return_value=None) as lookup,
            patch.object(outbox, "publish_anomaly_transition") as publish,
        ):

            def evaluate(**_kwargs: object) -> tuple[list[AnomalyDecision], dict[str, object]]:
                state.refresh_from_db()
                revision = state.date_updated
                assert DeliveryState.from_json(state.delivery).pending[0].broker_acked_at == NOW
                lookup.return_value = SimpleNamespace(last_seen=START.replace(tzinfo=UTC))
                assert state._state.db is not None
                outbox.PendingTransitionDrain(state.id, self.organization.id, state._state.db).run()
                state.refresh_from_db()
                assert state.date_updated > revision
                assert state.next_minute == END.replace(tzinfo=UTC)
                return [update], next_checkpoint

            advance.side_effect = evaluate
            assert not schedule._run_organization(self.organization.id, target)
            publish.assert_called_once_with(detector, delivery.pending[0].transition)
            state.refresh_from_db()
            assert state.next_minute == END.replace(tzinfo=UTC)
            assert state.checkpoint == checkpoint
            assert not DeliveryState.from_json(state.delivery).pending

            advance.side_effect = None
            advance.return_value = ([update], next_checkpoint)
            schedule._run_organization(self.organization.id, target)

        state.refresh_from_db()
        assert state.next_minute == target.replace(tzinfo=UTC)
        assert state.checkpoint == next_checkpoint
        (staged,) = DeliveryState.from_json(state.delivery).pending
        assert staged.kind == "update"
        assert staged.transition.group_key == delivery.pending[0].transition.group_key
        publish.assert_called_with(detector, staged.transition)

    @freeze_time(NOW)
    def test_independent_opens_do_not_wait_for_prior_activation(self) -> None:
        detector = self.make_detector(self.project)
        project_id = self.project.id
        state, _ = AnomalyDetectionState.objects.get_or_create(organization=self.organization)
        state.update(next_minute=START.replace(tzinfo=UTC))
        later_minute = END + timedelta(minutes=1)
        target = later_minute + timedelta(minutes=1)
        decisions = [
            decision(project_id, urgency=Urgency.MEDIUM),
            decision(project_id, key="independent"),
            decision(project_id, timestamp=END),
            decision(project_id, timestamp=later_minute, resolved=True),
        ]
        checkpoint = {
            "version": CHECKPOINT_VERSION,
            "qualified": [{"group_key": "group"}, {"group_key": "independent"}],
        }
        groups: dict[tuple[str, ...], SimpleNamespace] = {}
        handler = AnomalyDetectionDetectorHandler(detector)

        def fingerprint(transition: AnomalyTransition) -> tuple[str, ...]:
            return tuple(hash_fingerprint(handler.get_issue_fingerprint(transition.group_key)))

        with (
            self.feature(FEATURES),
            patch.object(schedule, "collect", return_value=[]),
            patch.object(schedule, "_hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(schedule, "advance_org", return_value=(decisions, checkpoint)) as advance,
            patch.object(
                outbox,
                "get_group_from_fingerprint",
                side_effect=lambda _project_id, fingerprint: groups.get(tuple(fingerprint)),
            ),
            patch.object(outbox, "publish_anomaly_transition") as publish,
        ):
            assert not schedule._run_organization(self.organization.id, target)
            first_open, second_open = [entry.args[1] for entry in publish.call_args_list]
            assert first_open.group_key != second_open.group_key
            assert not first_open.is_resolved
            assert not second_open.is_resolved

            groups[fingerprint(second_open)] = SimpleNamespace(
                last_seen=START.replace(tzinfo=UTC), status=GroupStatus.UNRESOLVED
            )
            schedule._run_organization(self.organization.id, target + timedelta(minutes=1))
            assert publish.call_count == 2
            state.refresh_from_db()
            pending = DeliveryState.from_json(state.delivery).pending
            assert [item.transition.group_key for item in pending] == [first_open.group_key] * 3

            first_group = groups[fingerprint(first_open)] = SimpleNamespace(
                last_seen=START.replace(tzinfo=UTC), status=GroupStatus.UNRESOLVED
            )
            schedule._run_organization(self.organization.id, target)
            assert publish.call_count == 3
            update = publish.call_args.args[1]
            assert update.group_key == first_open.group_key
            assert update.priority == DetectorPriorityLevel.HIGH
            assert not update.is_resolved

            schedule._run_organization(self.organization.id, target)
            assert publish.call_count == 3  # Broker acknowledgement cannot unblock the close.
            first_group.last_seen = END.replace(tzinfo=UTC)
            schedule._run_organization(self.organization.id, target)
            assert publish.call_count == 4
            close = publish.call_args.args[1]
            assert close.group_key == first_open.group_key
            assert close.is_resolved

        assert [entry.kwargs["start"] for entry in advance.call_args_list] == [START, target]

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
            patch.object(outbox, "publish_anomaly_transition") as publish,
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

    def test_missing_issue_does_not_retire_a_queued_reopen(self) -> None:
        self.assert_queued_reopen_survives_retirement(tombstoned=False)

    def test_tombstoned_issue_does_not_retire_a_queued_reopen(self) -> None:
        self.assert_queued_reopen_survives_retirement(tombstoned=True)

    def assert_queued_reopen_survives_retirement(self, *, tombstoned: bool) -> None:
        detector = self.make_detector(self.project)
        delivery = DeliveryState()
        detector_ids = {self.project.id: detector.id}
        delivery.stage(
            [decision(self.project.id)],
            detector_ids,
            start=START,
            end=END,
            retained_keys={"group"},
        )
        original = delivery.pending.pop().transition  # The first open already drained.
        original_fingerprint = hash_fingerprint(
            AnomalyDetectionDetectorHandler(detector).get_issue_fingerprint(original.group_key)
        )
        target = END + timedelta(minutes=2)
        delivery.stage(
            [
                decision(self.project.id, timestamp=END, resolved=True),
                decision(self.project.id, timestamp=END + timedelta(minutes=1)),
            ],
            detector_ids,
            start=END,
            end=target,
            retained_keys={"group"},
        )
        state, _ = AnomalyDetectionState.objects.get_or_create(organization=self.organization)
        state.update(delivery=delivery.to_json(), next_minute=target.replace(tzinfo=UTC))
        with (
            self.feature(FEATURES),
            patch.object(
                outbox,
                "_is_tombstoned",
                side_effect=lambda _project_id, fingerprint: (
                    tombstoned and fingerprint == original_fingerprint
                ),
            ),
            patch.object(outbox, "publish_anomaly_transition") as publish,
        ):
            schedule._run_organization(self.organization.id, target)

        publish.assert_called_once()
        owner, reopened = publish.call_args.args
        assert owner == detector
        assert not reopened.is_resolved
        assert reopened.group_key != original.group_key
        state.refresh_from_db()
        delivery = DeliveryState.from_json(state.delivery)
        assert [item.transition for item in delivery.pending] == [reopened]
        assert not delivery.pins["group"].activation_retired

    def test_project_limit_does_not_block_committed_delivery(self) -> None:
        detector = self.make_detector(self.project)
        self.make_detector(self.create_project())
        delivery = DeliveryState()
        delivery.stage(
            [decision(self.project.id)],
            {self.project.id: detector.id},
            start=START,
            end=END,
            retained_keys={"group"},
        )
        expected = delivery.pending[0].transition
        state, _ = AnomalyDetectionState.objects.get_or_create(organization=self.organization)
        state.update(delivery=delivery.to_json(), next_minute=END.replace(tzinfo=UTC))
        with (
            self.feature(FEATURES),
            patch.object(schedule, "_MAX_PROJECTS", 1),
            patch.object(schedule, "collect") as collect,
            patch.object(outbox, "get_group_from_fingerprint", return_value=None) as lookup,
            patch.object(outbox, "publish_anomaly_transition") as publish,
        ):
            target = END + timedelta(minutes=1)
            with pytest.raises(RuntimeError, match="exceeds the project limit"):
                schedule._run_organization(self.organization.id, target)
            lookup.return_value = SimpleNamespace(last_seen=START.replace(tzinfo=UTC))
            with pytest.raises(RuntimeError, match="exceeds the project limit"):
                schedule._run_organization(self.organization.id, target)

        publish.assert_called_once_with(detector, expected)
        collect.assert_not_called()
        state.refresh_from_db()
        assert state.next_minute == END.replace(tzinfo=UTC)
        assert not DeliveryState.from_json(state.delivery).pending

    def test_disabled_pinned_detector_retires_only_its_queued_work(self) -> None:
        detector = self.make_detector(self.project)
        replacement = self.make_detector(self.project, enabled=False)
        unrelated_project = self.create_project()
        unrelated_detector = self.make_detector(unrelated_project)
        delivery = DeliveryState()
        delivery.stage(
            [
                decision(self.project.id),
                decision(self.project.id, resolved=True),
                decision(unrelated_project.id, key="unrelated"),
            ],
            {self.project.id: detector.id, unrelated_project.id: unrelated_detector.id},
            start=START,
            end=END,
            retained_keys={"group", "unrelated"},
        )
        unrelated_open = delivery.pending[-1].transition
        state, _ = AnomalyDetectionState.objects.get_or_create(organization=self.organization)
        state.update(delivery=delivery.to_json(), next_minute=END.replace(tzinfo=UTC))
        detector.update(enabled=False)
        with (
            self.feature(FEATURES),
            patch.object(outbox, "publish_anomaly_transition") as publish,
        ):
            schedule._run_organization(self.organization.id, END)
        publish.assert_called_once_with(unrelated_detector, unrelated_open)

        state = AnomalyDetectionState.objects.get(id=state.id)
        delivery = DeliveryState.from_json(state.delivery)
        assert [item.transition for item in delivery.pending] == [unrelated_open]
        assert delivery.pins["group"].detector_id == detector.id
        assert delivery.pins["group"].owner_retired
        replacement.update(enabled=True)
        delivery.stage(
            [
                decision(self.project.id, timestamp=END),
                decision(self.project.id, timestamp=END, key="new"),
            ],
            {self.project.id: replacement.id},
            start=END,
            end=END + timedelta(minutes=1),
            retained_keys={"group", "new", "unrelated"},
        )
        assert [item.logical_key for item in delivery.pending] == ["unrelated", "new"]
        assert delivery.pending[1].detector_id == replacement.id


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


def test_delivery_keeps_pin_on_reopen_and_identifies_low_priority_open() -> None:
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
    assert state.pending[0].is_open
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
    assert reopened.is_open
    assert not escalation.is_open
    assert not closed.is_open
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


def test_delivery_coalesces_same_minute_open_update_in_place() -> None:
    state = DeliveryState()
    state.stage(
        [
            decision(1, urgency=Urgency.MEDIUM),
            decision(1, key="independent"),
            decision(1, urgency=Urgency.HIGH),
            decision(1, resolved=True),
        ],
        {1: 11},
        start=START,
        end=END,
        retained_keys={"group", "independent"},
    )
    opened, independent, closed = DeliveryState.from_json(state.to_json()).pending
    assert [item.logical_key for item in (opened, independent, closed)] == [
        "group",
        "independent",
        "group",
    ]
    assert opened.is_open
    assert opened.transition.priority == DetectorPriorityLevel.HIGH
    assert closed.transition.is_resolved
    assert opened.transition.group_key == closed.transition.group_key


def test_retired_activation_suppresses_updates_until_evaluator_reopens() -> None:
    state = DeliveryState()
    state.stage([decision(1)], {1: 11}, start=START, end=END, retained_keys={"group"})
    retired = state.pending[0]
    state.retire_activation(retired)
    state = DeliveryState.from_json(state.to_json())
    state.stage(
        [
            decision(1, timestamp=END),
            decision(1, timestamp=END, resolved=True),
            decision(1, timestamp=END + timedelta(minutes=1)),
        ],
        {1: 12},
        start=END,
        end=END + timedelta(minutes=2),
        retained_keys={"group"},
    )
    (reopened,) = state.pending
    assert reopened.detector_id == retired.detector_id == 11
    assert reopened.is_open
    assert reopened.transition.group_key != retired.transition.group_key
    assert reopened.transition.timestamp == END + timedelta(minutes=1)


def test_delivery_retains_pins_across_evaluation_batches() -> None:
    state = DeliveryState()
    retained_keys: set[str] = set()
    for batch in range(5):
        minute = START + timedelta(minutes=batch)
        decisions = [decision(1, key=f"group-{batch}-{i}", timestamp=minute) for i in range(225)]
        retained_keys.update(item.group_key for item in decisions)
        state.stage(
            decisions,
            {1: 11},
            start=minute,
            end=minute + timedelta(minutes=1),
            retained_keys=retained_keys,
        )
        state.pending.clear()
    assert DeliveryState.from_json(state.to_json()).pins.keys() == retained_keys


def test_delivery_backlog_prefers_ingested_closes_and_does_not_orphan_dependents() -> None:
    state = DeliveryState()
    keys = {"ingested", "untouched", "overflow"}
    state.stage([decision(1, key="ingested")], {1: 11}, start=START, end=END, retained_keys=keys)
    ingested = state.pending.pop().transition.group_key
    with (
        patch.object(pending_transitions, "_MAX_PENDING", 2),
        patch.object(metrics, "incr") as incr,
    ):
        state.stage(
            [
                decision(2, key="untouched", timestamp=END),
                decision(3, key="overflow", timestamp=END),
                decision(3, key="overflow", timestamp=END, resolved=True),
                decision(1, key="ingested", timestamp=END),
                decision(1, key="ingested", timestamp=END, resolved=True),
            ],
            {1: 11, 2: 22, 3: 33},
            start=END,
            end=END + timedelta(minutes=1),
            retained_keys=keys,
        )

    assert [(item.logical_key, item.kind) for item in state.pending] == [
        ("untouched", "open"),
        ("ingested", "close"),
    ]
    assert state.pending[1].transition.group_key == ingested
    assert state.pins["overflow"].activation_retired
    for kind in ("open", "update", "close"):
        incr.assert_any_call(
            "anomaly_detection.delivery_dropped",
            amount=1,
            tags={"reason": "backlog", "kind": kind},
            sample_rate=1.0,
        )

from collections import Counter
from collections.abc import Sequence
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from unittest import mock

from sentry import deletions
from sentry.anomaly_detection import schedule
from sentry.anomaly_detection.checkpoint.codec import _restore, _snapshot
from sentry.anomaly_detection.checkpoint.replay import (
    _CheckpointOnlyFootprints,
    remove_project_state,
)
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.correlation.correlator import GroupState, MemberState, episode_key
from sentry.anomaly_detection.correlation.footprint import (
    Footprint,
    SliceStats,
    service_of,
    slice_of,
)
from sentry.anomaly_detection.delivery.pending_transitions import DeliveryState
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.evaluation.series import SeriesRow
from sentry.anomaly_detection.grouptype import AnomalyDetection
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.activity import Activity
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupseen import GroupSeen
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.models.rule import Rule
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    ScheduleType,
)
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.services import eventstore
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import cell_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.uptime.models import UptimeSubscription, get_uptime_subscription
from sentry.viewer_context import ActorType, get_viewer_context
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel, DetectorType
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@requires_snuba
class DeleteProjectTest(BaseWorkflowTest, TransactionTestCase, HybridCloudTestMixin):
    def test_deletes_issue_inbox_items(self) -> None:
        project = self.create_project()
        project.update_option("sentry:similarity_backfill_completed", 1)
        group = self.create_group(project=project)
        item = self.create_inbox_item(subject_id=str(group.id), organization=project.organization)
        event = self.create_inbox_item_event(item)

        with mock.patch.dict("os.environ", {"_SENTRY_CLEANUP": "1"}), self.tasks():
            deletions.exec_sync(project)

        assert not Project.objects.filter(id=project.id).exists()
        assert not InboxItem.objects.filter(id=item.id).exists()
        assert not InboxItemEvent.objects.filter(id=event.id).exists()

    @mock.patch(
        "sentry.tasks.seer.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_seer_cleanup_uses_scheduled_actor_context(
        self, mock_delete_seer_grouping_records: mock.MagicMock
    ) -> None:
        project = self.create_project(name="test")
        project.update_option("sentry:similarity_backfill_completed", 1)
        event = self.store_event(data={"message": "error"}, project_id=project.id)
        assert event.group is not None

        def assert_viewer_context(*_args: object, **_kwargs: object) -> None:
            viewer_context = get_viewer_context()
            assert viewer_context is not None
            assert viewer_context.organization_id == project.organization_id
            assert viewer_context.project_id == project.id
            assert viewer_context.actor.actor_id == self.user.id
            assert viewer_context.actor.type == ActorType.USER

        mock_delete_seer_grouping_records.side_effect = assert_viewer_context
        self.ScheduledDeletion.schedule(instance=project, actor=self.user, days=0)

        with self.tasks():
            run_scheduled_deletions()

        mock_delete_seer_grouping_records.assert_called()
        assert get_viewer_context() is None

    def test_simple(self) -> None:
        project = self.create_project(name="test")
        rule = self.create_project_rule(project=project)
        event = self.store_event(data={}, project_id=project.id)
        assert event.group is not None
        group = event.group
        activity = Activity.objects.create(
            group=group,
            project=project,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        open_period = GroupOpenPeriod.objects.get(
            group=group,
            project=project,
        )
        GroupOpenPeriodActivity.objects.create(
            group_open_period=open_period, type=OpenPeriodActivityType.OPENED, value=75
        )
        open_period.update(
            date_started=before_now(minutes=1),
            date_ended=before_now(minutes=1),
        )
        open_period.save()
        GroupAssignee.objects.create(group=group, project=project, user_id=self.user.id)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        release = Release.objects.create(version="a" * 32, organization_id=project.organization_id)
        release.add_project(project)
        GroupResolution.objects.create(group=group, release=release)
        env = Environment.objects.create(organization_id=project.organization_id, name="foo")
        env.add_project(project)
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        commit_author = CommitAuthor.objects.create(
            organization_id=project.organization_id, name="foo", email="foo@example.com"
        )
        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=project.organization_id,
            author=commit_author,
            key="a" * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=0,
        )
        file = File.objects.create(name="debug-file", type="project.dif")
        dif = ProjectDebugFile.objects.create(
            file=file,
            debug_id="uuid",
            code_id="codeid",
            cpu_name="cpu",
            object_name="object",
            project_id=project.id,
        )
        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            name="hello.png",
            type="image/png",
        )
        hook = self.create_service_hook(
            actor=self.user,
            org=project.organization,
            project=project,
            url="https://example.com/webhook",
        )
        metric_alert_rule = self.create_alert_rule(
            organization=project.organization, projects=[project]
        )
        monitor = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=env.id,
        )
        checkin = self.create_monitor_checkin(
            monitor_environment=monitor_env,
            date_added=monitor.date_added,
            status=CheckInStatus.OK,
        )
        snuba_query = metric_alert_rule.snuba_query
        query_sub = QuerySubscription.objects.create(
            project=project,
            snuba_query=snuba_query,
            status=0,
            subscription_id="a-snuba-id-maybe",
            query_extra="",
        )

        self.ScheduledDeletion.schedule(instance=project, days=0)
        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not Rule.objects.filter(id=rule.id).exists()
        assert not EnvironmentProject.objects.filter(
            project_id=project.id, environment_id=env.id
        ).exists()
        assert Environment.objects.filter(id=env.id).exists()
        assert not Group.objects.filter(project_id=project.id).exists()
        assert not EventAttachment.objects.filter(project_id=project.id).exists()
        assert Release.objects.filter(id=release.id).exists()
        assert ReleaseCommit.objects.filter(release_id=release.id).exists()
        assert Commit.objects.filter(id=commit.id).exists()
        assert SnubaQuery.objects.filter(id=snuba_query.id).exists()
        assert not ProjectDebugFile.objects.filter(id=dif.id).exists()
        assert not File.objects.filter(id=file.id).exists()
        assert not ServiceHook.objects.filter(id=hook.id).exists()
        assert not Monitor.objects.filter(id=monitor.id).exists()
        assert not MonitorEnvironment.objects.filter(id=monitor_env.id).exists()
        assert not GroupOpenPeriod.objects.filter(id=open_period.id).exists()
        assert not GroupOpenPeriodActivity.objects.filter(
            group_open_period_id=open_period.id
        ).exists()
        assert not Activity.objects.filter(id=activity.id).exists()
        assert not MonitorCheckIn.objects.filter(id=checkin.id).exists()
        assert not QuerySubscription.objects.filter(id=query_sub.id).exists()

        assert AlertRule.objects.filter(id=metric_alert_rule.id).exists()

    def test_delete_error_events(self) -> None:
        keeper = self.create_project(name="keeper")
        project = self.create_project(name="test")
        event = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "oh no",
            },
            project_id=project.id,
        )
        assert event.group is not None
        group = event.group
        group_seen = GroupSeen.objects.create(group=group, project=project, user_id=self.user.id)

        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not GroupSeen.objects.filter(id=group_seen.id).exists()
        assert not Group.objects.filter(id=group.id).exists()

        conditions = eventstore.Filter(project_ids=[project.id, keeper.id], group_ids=[group.id])
        events = eventstore.backend.get_events(
            conditions, tenant_ids={"organization_id": 123, "referrer": "r"}
        )
        assert len(events) == 0

    @mock.patch("sentry.quotas.backend.remove_seat")
    def test_delete_with_uptime_monitors(self, mock_remove_seat: mock.MagicMock) -> None:
        project = self.create_project(name="test")
        detector = self.create_uptime_detector(project=project)
        detector_id = detector.id
        uptime_subscription = get_uptime_subscription(detector)

        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not Detector.objects.filter(id=detector_id).exists()
        assert not UptimeSubscription.objects.filter(id=uptime_subscription.id).exists()
        # remove_seat is called from both DetectorDeletionTask and
        # UptimeSubscriptionDeletionTask as belt-and-suspenders.
        assert mock_remove_seat.call_count == 2


@cell_silo_test
class DeleteProjectAnomalyStateTest(TransactionTestCase):
    BOUNDARY = datetime(2025, 1, 1, 12, 0)
    START = BOUNDARY - timedelta(minutes=1)

    def make_detector(self, project: Project, *, enabled: bool = True) -> Detector:
        return self.create_detector(
            project=project, type=DetectorType.ANOMALY_DETECTION, enabled=enabled
        )

    def add_finding(
        self, evaluator: OrgEvaluator, project: Project, env: str
    ) -> tuple[GroupState, AnomalyDecision]:
        key = SeriesKey(str(project.id), env, "endpoints", "p95(span.duration)", "/health")
        event = ChangeEvent(key, ChangeType.SLOWDOWN, self.START, 400.0, 100.0, 0.9)
        evaluator.series[key] = {self.START: event.actual}
        evaluator.novelty.observe(key, self.START)
        evaluator.novelty.record(event)
        group = evaluator.corr._create_group(self.START, MemberState(event, 4.0))
        decision = AnomalyDecision(
            group.group.id, project.id, self.START, Urgency.MEDIUM, False, "Slowdown", {}, env
        )
        evaluator.qualified[decision.group_key] = decision
        return group, decision

    def delete_project(self, project: Project) -> None:
        with mock.patch.dict("os.environ", {"_SENTRY_CLEANUP": "1"}), self.tasks():
            deletions.exec_sync(project)
        assert not Project.objects.filter(id=project.id).exists()

    def test_last_enabled_project_deletes_anomaly_state_with_feature_off(self) -> None:
        project = self.create_project()
        detector = self.make_detector(project)
        self.make_detector(self.create_project(), enabled=False)
        evaluator = OrgEvaluator(_CheckpointOnlyFootprints(), handlers={})
        evaluator.next_minute = self.BOUNDARY
        _, finding = self.add_finding(evaluator, project, "prod")
        delivery = DeliveryState()
        delivery.stage(
            [finding],
            {project.id: detector.id},
            start=self.START,
            end=self.BOUNDARY,
            retained_keys={finding.group_key},
        )
        AnomalyDetectionState.objects.get_or_create(
            organization_id=project.organization_id,
            defaults={
                "checkpoint": _snapshot(evaluator, self.BOUNDARY),
                "delivery": delivery.to_json(),
                "next_minute": self.BOUNDARY.replace(tzinfo=UTC),
            },
        )

        with self.feature(
            {schedule.FEATURE: False, AnomalyDetection.build_ingest_feature_name(): False}
        ):
            self.delete_project(project)

        assert not AnomalyDetectionState.objects.filter(
            organization_id=project.organization_id
        ).exists()

    def test_mixed_scope_scrubs_only_deleted_project_and_closes_original_activation(self) -> None:
        deleted, retained = self.create_project(), self.create_project()
        deleted_detector = self.make_detector(deleted)
        retained_detector = self.make_detector(retained)
        evaluator = OrgEvaluator(_CheckpointOnlyFootprints(), handlers={})
        evaluator.next_minute = self.BOUNDARY
        removed, removed_decision = self.add_finding(evaluator, deleted, "prod")
        kept, kept_decision = self.add_finding(evaluator, retained, "prod")
        mixed, mixed_decision = self.add_finding(evaluator, retained, "canary")
        mixed_retained_key = mixed.root.key

        # Correlation changed roots after publication; close the original activation.
        deleted_member = replace(removed.root, key=replace(removed.root.key, env="canary"))
        evaluator.corr._add_member(mixed, MemberState(deleted_member, 4.0))
        mixed.root = deleted_member
        deleted_edge = service_of(kept.root.key), "removed.example", service_of(removed.root.key)
        kept_edge = service_of(kept.root.key), "retained.example", service_of(mixed_retained_key)
        kept_slice, deleted_slice = slice_of(kept.root.key), slice_of(removed.root.key)
        stats = SliceStats(1.0, 400.0, 10)
        kept.members[episode_key(kept.root)].footprint = Footprint(
            kept.root.key,
            [],
            {kept_slice: stats, deleted_slice: stats},
            Counter({kept_edge: 2, deleted_edge: 1}),
        )
        evaluator.corr.state.edges.update({kept_edge: 2, deleted_edge: 1})
        evaluator.corr.state.edge_seen_at.update({kept_edge: self.START, deleted_edge: self.START})

        delivery = DeliveryState()
        delivery.stage(
            [removed_decision, kept_decision, mixed_decision],
            {deleted.id: deleted_detector.id, retained.id: retained_detector.id},
            start=self.START,
            end=self.BOUNDARY,
            retained_keys=set(evaluator.qualified),
        )
        # The mixed open was delivered; the unrelated open is still waiting for ingestion.
        removed_open, kept_open, mixed_open = delivery.pending
        kept_open.broker_acked_at = self.START.replace(tzinfo=UTC)
        delivery.pending = [removed_open, kept_open]
        state, _ = AnomalyDetectionState.objects.get_or_create(
            organization_id=deleted.organization_id,
            defaults={
                "checkpoint": _snapshot(evaluator, self.BOUNDARY),
                "delivery": delivery.to_json(),
                "next_minute": self.BOUNDARY.replace(tzinfo=UTC),
            },
        )

        self.delete_project(deleted)

        state.refresh_from_db()
        assert state.next_minute == self.BOUNDARY.replace(tzinfo=UTC)
        assert state.checkpoint is not None
        restored = _restore(_CheckpointOnlyFootprints(), state.checkpoint, handlers={})
        assert set(restored.series) == {kept.root.key, mixed_retained_key}
        assert (
            set(restored.novelty.history) == set(restored.novelty.coverage) == set(restored.series)
        )
        assert restored.corr.state.edges == {kept_edge: 2}
        assert restored.corr.state.edge_seen_at == {kept_edge: self.START}
        assert all(record["key"][0] == str(retained.id) for record in state.checkpoint["events"])
        assert restored.qualified == {kept_decision.group_key: kept_decision}
        (remaining,) = restored.corr.groups
        footprint = remaining.members[episode_key(kept.root)].footprint
        assert footprint is not None
        assert footprint.slices == {kept_slice: stats}
        assert footprint.edges == {kept_edge: 2}

        remaining_delivery = DeliveryState.from_json(state.delivery)
        unrelated_open, scope_close = remaining_delivery.pending
        assert unrelated_open == kept_open
        assert scope_close.logical_key == mixed_open.logical_key
        assert scope_close.detector_id == mixed_open.detector_id
        assert scope_close.transition == replace(
            mixed_open.transition, timestamp=self.BOUNDARY, is_resolved=True
        )
        assert remaining_delivery.pins == {
            kept_decision.group_key: delivery.pins[kept_decision.group_key],
            mixed_decision.group_key: replace(delivery.pins[mixed_decision.group_key], closed=True),
        }

        # Retrying cleanup must not queue another close or change unrelated work.
        saved = state.checkpoint, state.delivery
        remove_project_state(organization_id=deleted.organization_id, project_id=deleted.id)
        state.refresh_from_db()
        assert (state.checkpoint, state.delivery) == saved

    @freeze_time("2025-01-01T12:02:00Z")
    def test_in_flight_worker_cannot_restore_deleted_scope(self) -> None:
        deleted, retained = self.create_project(), self.create_project()
        self.make_detector(deleted)
        self.make_detector(retained)
        state, _ = AnomalyDetectionState.objects.get_or_create(
            organization_id=deleted.organization_id,
            defaults={"next_minute": self.START.replace(tzinfo=UTC)},
        )
        revision = state.date_updated

        def collect_then_delete(
            organization: Organization,
            projects: Sequence[Project],
            start: datetime,
            end: datetime,
            interval: str,
        ) -> list[SeriesRow]:
            assert {project.id for project in projects} == {deleted.id, retained.id}
            self.delete_project(deleted)
            return [(start, "requests", "count()", str(deleted.id), "prod", "", 100.0)]

        with (
            self.feature(
                {schedule.FEATURE: True, AnomalyDetection.build_ingest_feature_name(): True}
            ),
            mock.patch.object(schedule, "collect", side_effect=collect_then_delete) as collect,
            mock.patch.object(schedule, "_hourly_rows", return_value=[]),
            mock.patch.object(schedule, "collect_new_failure_modes", return_value=[]),
        ):
            assert not schedule._run_organization(deleted.organization_id, self.BOUNDARY)

        collect.assert_called_once()
        state.refresh_from_db()
        assert state.date_updated == revision + timedelta(microseconds=1)
        assert state.next_minute == self.START.replace(tzinfo=UTC)
        assert state.checkpoint is None
        assert state.delivery is None


class DeleteWorkflowEngineModelsTest(DeleteProjectTest):
    def setUp(self) -> None:
        self.workflow_engine_project = self.create_project(name="workflow_engine_test")
        self.snuba_query = self.create_snuba_query()
        self.subscription = QuerySubscription.objects.create(
            project=self.workflow_engine_project,
            status=QuerySubscription.Status.ACTIVE.value,
            subscription_id="123",
            snuba_query=self.snuba_query,
        )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.subscription.id
        )
        self.detector_data_condition_group = self.create_data_condition_group(
            organization=self.organization
        )
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            _,  # the workflow trigger group for a migrated metric alert rule is None
        ) = self.create_detector_and_workflow(project=self.workflow_engine_project)
        self.detector.update(workflow_condition_group=self.detector_data_condition_group)
        self.detector_trigger = self.create_data_condition(
            comparison=200,
            condition_result=DetectorPriorityLevel.HIGH,
            type=Condition.GREATER_OR_EQUAL,
            condition_group=self.detector_data_condition_group,
        )

        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )

    def test_delete_detector_data_source(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.workflow_engine_project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not DataSource.objects.filter(id=self.data_source.id).exists()
        assert not DataSourceDetector.objects.filter(id=self.data_source_detector.id).exists()
        assert not QuerySubscription.objects.filter(id=self.subscription.id).exists()
        assert not SnubaQuery.objects.filter(id=self.snuba_query.id).exists()

    def test_delete_detector_data_conditions(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.workflow_engine_project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not DataConditionGroup.objects.filter(
            id=self.detector_data_condition_group.id
        ).exists()
        assert not DataCondition.objects.filter(id=self.detector_trigger.id).exists()

    def test_not_delete_workflow(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.workflow_engine_project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()
        assert Workflow.objects.filter(id=self.workflow.id).exists()

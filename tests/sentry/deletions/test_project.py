from unittest import mock

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident
from sentry.models.activity import Activity
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
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.rulesnooze import RuleSnooze
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    ScheduleType,
)
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.services import eventstore
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.uptime.models import UptimeSubscription, get_uptime_subscription
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
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class DeleteProjectTest(BaseWorkflowTest, TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self) -> None:
        project = self.create_project(name="test")
        rule = self.create_project_rule(project=project)
        RuleActivity.objects.create(
            rule=rule, user_id=self.user.id, type=RuleActivityType.CREATED.value
        )
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
            resolution_activity=activity,
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
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
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
        incident = self.create_incident(
            organization=project.organization,
            projects=[project],
            alert_rule=metric_alert_rule,
            title="Something bad happened",
            subscription=query_sub,
        )

        rule_snooze = self.snooze_rule(user_id=self.user.id, alert_rule=metric_alert_rule)

        self.ScheduledDeletion.schedule(instance=project, days=0)
        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not Rule.objects.filter(id=rule.id).exists()
        assert not RuleActivity.objects.filter(rule_id=rule.id).exists()
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

        incident.refresh_from_db()
        assert len(incident.projects.all()) == 0, "Project relation should be removed"
        assert Incident.objects.filter(id=incident.id).exists()

        assert AlertRule.objects.filter(id=metric_alert_rule.id).exists()
        assert RuleSnooze.objects.filter(id=rule_snooze.id).exists()

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
        uptime_subscription = get_uptime_subscription(detector)

        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not Detector.objects.filter(id=detector.id).exists()
        assert not UptimeSubscription.objects.filter(id=uptime_subscription.id).exists()
        mock_remove_seat.assert_called_with(seat_object=detector)


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

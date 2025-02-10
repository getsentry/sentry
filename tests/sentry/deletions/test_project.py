from sentry import eventstore
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupseen import GroupSeen
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.models.rulesnooze import RuleSnooze
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorType,
    ScheduleType,
)
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import APITestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class DeleteProjectTest(APITestCase, TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self):
        project = self.create_project(name="test")
        event = self.store_event(data={}, project_id=project.id)
        assert event.group is not None
        group = event.group
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
        file_attachment = File.objects.create(name="hello.png", type="image/png")
        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            file_id=file_attachment.id,
            type=file_attachment.type,
            name="hello.png",
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
            type=MonitorType.CRON_JOB,
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
        assert not MonitorCheckIn.objects.filter(id=checkin.id).exists()
        assert not QuerySubscription.objects.filter(id=query_sub.id).exists()

        incident.refresh_from_db()
        assert len(incident.projects.all()) == 0, "Project relation should be removed"
        assert Incident.objects.filter(id=incident.id).exists()

        assert AlertRule.objects.filter(id=metric_alert_rule.id).exists()
        assert RuleSnooze.objects.filter(id=rule_snooze.id).exists()

    def test_delete_error_events(self):
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

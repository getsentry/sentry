from sentry import eventstore
from sentry.incidents.models import AlertRule
from sentry.models import (
    Commit,
    CommitAuthor,
    Environment,
    EnvironmentProject,
    EventAttachment,
    File,
    Group,
    GroupAssignee,
    GroupMeta,
    GroupResolution,
    GroupSeen,
    Project,
    ProjectDebugFile,
    Release,
    ReleaseCommit,
    Repository,
    RuleSnooze,
    ScheduledDeletion,
    ServiceHook,
)
from sentry.tasks.deletion.scheduled import run_deletion
from sentry.testutils import APITestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DeleteProjectTest(APITestCase, TransactionTestCase):
    def test_simple(self):
        project = self.create_project(name="test")
        event = self.store_event(data={}, project_id=project.id)
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
        rule_snooze = RuleSnooze.objects.create(user_id=self.user.id, alert_rule=metric_alert_rule)

        deletion = ScheduledDeletion.schedule(project, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

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
        assert not ProjectDebugFile.objects.filter(id=dif.id).exists()
        assert not File.objects.filter(id=file.id).exists()
        assert not ServiceHook.objects.filter(id=hook.id).exists()
        assert not AlertRule.objects.filter(id=metric_alert_rule.id).exists()
        assert not RuleSnooze.objects.filter(id=rule_snooze.id).exists()

    def test_delete_error_events(self):
        keeper = self.create_project(name="keeper")
        project = self.create_project(name="test")
        event = self.store_event(
            data={
                "timestamp": iso_format(before_now(minutes=1)),
                "message": "oh no",
            },
            project_id=project.id,
        )
        group = event.group
        group_seen = GroupSeen.objects.create(group=group, project=project, user_id=self.user.id)

        deletion = ScheduledDeletion.schedule(project, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Project.objects.filter(id=project.id).exists()
        assert not GroupSeen.objects.filter(id=group_seen.id).exists()
        assert not Group.objects.filter(id=group.id).exists()

        conditions = eventstore.Filter(project_ids=[project.id, keeper.id], group_ids=[group.id])
        events = eventstore.get_events(conditions)
        assert len(events) == 0

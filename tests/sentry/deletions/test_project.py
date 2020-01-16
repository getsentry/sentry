from __future__ import absolute_import

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
    Project,
    Release,
    ReleaseCommit,
    Repository,
    ScheduledDeletion,
    ProjectDebugFile,
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteProjectTest(TestCase):
    def test_simple(self):
        project = self.create_project(name="test")
        event = self.store_event(data={}, project_id=project.id)
        group = event.group
        GroupAssignee.objects.create(group=group, project=project, user=self.user)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        release = Release.objects.create(version="a" * 32, organization_id=project.organization_id)
        release.add_project(project)
        GroupResolution.objects.create(group=group, release=release)
        env = Environment.objects.create(
            organization_id=project.organization_id, project_id=project.id, name="foo"
        )
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
            project=project,
        )
        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            file=File.objects.create(name="hello.png", type="image/png"),
            name="hello.png",
        )

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

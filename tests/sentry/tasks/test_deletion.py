from __future__ import absolute_import

import pytest

from sentry.constants import ObjectStatus
from sentry.exceptions import DeleteAborted
from sentry.models import (
    Event, EventMapping, EventTag,
    Group, GroupAssignee, GroupMeta, GroupResolution, GroupRedirect, GroupStatus, GroupTagKey,
    GroupTagValue, Organization, OrganizationStatus, Project, ProjectStatus,
    Release, TagKey, TagValue, Team, TeamStatus, Commit, CommitAuthor,
    ReleaseCommit, Repository
)
from sentry.tasks.deletion import (
    delete_group, delete_organization, delete_project, delete_tag_key,
    delete_team, generic_delete
)
from sentry.testutils import TestCase


class DeleteOrganizationTest(TestCase):
    def test_simple(self):
        org = self.create_organization(
            name='test',
            status=OrganizationStatus.PENDING_DELETION,
        )
        self.create_team(organization=org, name='test1')
        self.create_team(organization=org, name='test2')
        repo = Repository.objects.create(
            organization_id=org.id,
            name=org.name,
        )
        commit_author = CommitAuthor.objects.create(
            organization_id=org.id,
            name='foo',
            email='foo@example.com',
        )
        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=org.id,
            author=commit_author,
            key='a' * 40,
        )
        with self.tasks():
            delete_organization(object_id=org.id)

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Repository.objects.filter(id=repo.id).exists()
        assert not CommitAuthor.objects.filter(id=commit_author.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()

    def test_cancels_without_pending_status(self):
        org = self.create_organization(
            name='test',
            status=OrganizationStatus.VISIBLE,
        )
        self.create_team(organization=org, name='test1')
        self.create_team(organization=org, name='test2')

        with self.assertRaises(DeleteAborted):
            with self.tasks():
                delete_organization(object_id=org.id)

        assert Organization.objects.filter(id=org.id).exists()


class DeleteTeamTest(TestCase):
    def test_simple(self):
        team = self.create_team(
            name='test',
            status=TeamStatus.PENDING_DELETION,
        )
        self.create_project(team=team, name='test1')
        self.create_project(team=team, name='test2')

        with self.tasks():
            delete_team(object_id=team.id)

        assert not Team.objects.filter(id=team.id).exists()

    def test_cancels_without_pending_status(self):
        team = self.create_team(
            name='test',
            status=TeamStatus.VISIBLE,
        )
        self.create_project(team=team, name='test1')
        self.create_project(team=team, name='test2')

        with self.assertRaises(DeleteAborted):
            with self.tasks():
                delete_team(object_id=team.id)

        assert Team.objects.filter(id=team.id).exists()


class DeleteProjectTest(TestCase):
    def test_simple(self):
        project = self.create_project(
            name='test',
            status=ProjectStatus.PENDING_DELETION,
        )
        group = self.create_group(project=project)
        GroupAssignee.objects.create(group=group, project=project, user=self.user)
        GroupMeta.objects.create(group=group, key='foo', value='bar')
        release = Release.objects.create(version='a' * 32, project=project)
        GroupResolution.objects.create(group=group, release=release)
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=project.name,
        )
        commit_author = CommitAuthor.objects.create(
            organization_id=project.organization_id,
            name='foo',
            email='foo@example.com',
        )
        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=project.organization_id,
            author=commit_author,
            key='a' * 40,
        )
        ReleaseCommit.objects.create(
            project_id=project.id,
            release=release,
            commit=commit,
            order=0,
        )

        with self.tasks():
            delete_project(object_id=project.id)

        assert not Project.objects.filter(id=project.id).exists()
        assert not ReleaseCommit.objects.filter(project_id=project.id).exists()
        assert Commit.objects.filter(id=commit.id).exists()

    def test_cancels_without_pending_status(self):
        project = self.create_project(
            name='test',
            status=ProjectStatus.VISIBLE,
        )
        with self.assertRaises(DeleteAborted):
            with self.tasks():
                delete_project(object_id=project.id)

        assert Project.objects.filter(id=project.id).exists()


class DeleteTagKeyTest(TestCase):
    def test_simple(self):
        team = self.create_team(name='test', slug='test')
        project = self.create_project(team=team, name='test1', slug='test1')
        group = self.create_group(project=project)
        tk = TagKey.objects.create(key='foo', project=project)
        TagValue.objects.create(key='foo', value='bar', project=project)
        GroupTagKey.objects.create(key='foo', group=group, project=project)
        GroupTagValue.objects.create(key='foo', value='bar', group=group, project=project)
        EventTag.objects.create(
            key_id=tk.id, group_id=group.id, value_id=1, project_id=project.id,
            event_id=1,
        )

        project2 = self.create_project(team=team, name='test2')
        group2 = self.create_group(project=project2)
        tk2 = TagKey.objects.create(key='foo', project=project2)
        gtk2 = GroupTagKey.objects.create(key='foo', group=group2, project=project2)
        gtv2 = GroupTagValue.objects.create(key='foo', value='bar', group=group2, project=project2)
        EventTag.objects.create(
            key_id=tk2.id, group_id=group2.id, value_id=1, project_id=project.id,
            event_id=1,
        )

        with self.tasks():
            delete_tag_key(object_id=tk.id)

            assert not GroupTagValue.objects.filter(key=tk.key, project=project).exists()
            assert not GroupTagKey.objects.filter(key=tk.key, project=project).exists()
            assert not TagValue.objects.filter(key=tk.key, project=project).exists()
            assert not TagKey.objects.filter(id=tk.id).exists()
            assert not EventTag.objects.filter(key_id=tk.id).exists()

        assert TagKey.objects.filter(id=tk2.id).exists()
        assert GroupTagKey.objects.filter(id=gtk2.id).exists()
        assert GroupTagValue.objects.filter(id=gtv2.id).exists()
        assert EventTag.objects.filter(key_id=tk2.id).exists()


class DeleteGroupTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        group = self.create_group(
            project=project,
            status=GroupStatus.PENDING_DELETION,
        )
        event = self.create_event(group=group)
        EventMapping.objects.create(
            project_id=project.id,
            event_id='a' * 32,
            group_id=group.id,
        )
        EventTag.objects.create(
            event_id=event.id,
            project_id=project.id,
            key_id=1,
            value_id=1,
        )
        GroupAssignee.objects.create(
            group=group,
            project=project,
            user=self.user,
        )
        GroupMeta.objects.create(
            group=group,
            key='foo',
            value='bar',
        )
        GroupRedirect.objects.create(
            group_id=group.id,
            previous_group_id=1,
        )

        with self.tasks():
            delete_group(object_id=group.id)

        assert not Group.objects.filter(id=group.id).exists()
        assert not Event.objects.filter(id=event.id).exists()
        assert not EventMapping.objects.filter(
            event_id='a' * 32,
            group_id=group.id,
        ).exists()
        assert not EventTag.objects.filter(event_id=event.id).exists()
        assert not GroupRedirect.objects.filter(group_id=group.id).exists()


class GenericDeleteTest(TestCase):
    def test_does_not_delete_visible(self):
        project = self.create_project(
            status=ObjectStatus.VISIBLE,
        )

        with self.tasks():
            with pytest.raises(DeleteAborted):
                generic_delete('sentry', 'project', object_id=project.id)

        project = Project.objects.get(id=project.id)
        assert project.status == ObjectStatus.VISIBLE

    def test_deletes(self):
        project = self.create_project(
            status=ObjectStatus.PENDING_DELETION,
        )

        with self.tasks():
            generic_delete('sentry', 'project', object_id=project.id)

        assert not Project.objects.filter(id=project.id).exists()

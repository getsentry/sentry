from __future__ import absolute_import

from datetime import datetime, timedelta
from sentry.utils.compat.mock import patch
from uuid import uuid4

import pytest

from sentry import nodestore
from sentry.constants import ObjectStatus
from sentry.eventstore.models import Event
from sentry.exceptions import DeleteAborted
from sentry.models import (
    ApiApplication,
    ApiApplicationStatus,
    ApiGrant,
    ApiToken,
    Commit,
    CommitAuthor,
    Environment,
    EnvironmentProject,
    Group,
    GroupAssignee,
    GroupHash,
    GroupMeta,
    GroupRedirect,
    GroupResolution,
    GroupStatus,
    Organization,
    OrganizationStatus,
    Project,
    ProjectStatus,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    Repository,
    Team,
    TeamStatus,
)
from sentry.plugins.providers.dummy.repository import DummyRepositoryProvider
from sentry.tasks.deletion import (
    delete_api_application,
    delete_groups,
    delete_organization,
    delete_project,
    delete_repository,
    delete_team,
    generic_delete,
    revoke_api_tokens,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class DeleteOrganizationTest(TestCase):
    def test_simple(self):
        org = self.create_organization(name="test", status=OrganizationStatus.PENDING_DELETION)
        user = self.create_user()
        self.create_team(organization=org, name="test1")
        self.create_team(organization=org, name="test2")
        release = Release.objects.create(version="a" * 32, organization_id=org.id)
        repo = Repository.objects.create(organization_id=org.id, name=org.name, provider="dummy")
        commit_author = CommitAuthor.objects.create(
            organization_id=org.id, name="foo", email="foo@example.com"
        )
        commit = Commit.objects.create(
            repository_id=repo.id, organization_id=org.id, author=commit_author, key="a" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=org.id, release=release, commit=commit, order=0
        )

        env = Environment.objects.create(organization_id=org.id, project_id=4, name="foo")
        release_env = ReleaseEnvironment.objects.create(
            organization_id=org.id, project_id=4, release_id=release.id, environment_id=env.id
        )

        with self.tasks():
            with patch.object(DummyRepositoryProvider, "delete_repository") as mock_delete_repo:
                delete_organization(object_id=org.id, actor_id=user.id)
                assert mock_delete_repo.call_count == 1

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Environment.objects.filter(id=env.id).exists()
        assert not ReleaseEnvironment.objects.filter(id=release_env.id).exists()
        assert not Repository.objects.filter(id=repo.id).exists()
        assert not ReleaseCommit.objects.filter(organization_id=org.id).exists()
        assert not Release.objects.filter(organization_id=org.id).exists()
        assert not CommitAuthor.objects.filter(id=commit_author.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()

    def test_cancels_without_pending_status(self):
        org = self.create_organization(name="test", status=OrganizationStatus.VISIBLE)
        self.create_team(organization=org, name="test1")
        self.create_team(organization=org, name="test2")

        with self.assertRaises(DeleteAborted):
            with self.tasks():
                delete_organization(object_id=org.id)

        assert Organization.objects.filter(id=org.id).exists()


class DeleteTeamTest(TestCase):
    def test_simple(self):
        team = self.create_team(name="test", status=TeamStatus.PENDING_DELETION)
        self.create_project(teams=[team], name="test1")
        self.create_project(teams=[team], name="test2")

        with self.tasks():
            delete_team(object_id=team.id)

        assert not Team.objects.filter(id=team.id).exists()

    def test_cancels_without_pending_status(self):
        team = self.create_team(name="test", status=TeamStatus.VISIBLE)
        self.create_project(teams=[team], name="test1")
        self.create_project(teams=[team], name="test2")

        with self.assertRaises(DeleteAborted):
            with self.tasks():
                delete_team(object_id=team.id)

        assert Team.objects.filter(id=team.id).exists()


class DeleteProjectTest(TestCase):
    def test_simple(self):
        project = self.create_project(name="test", status=ProjectStatus.PENDING_DELETION)
        group = self.create_group(project=project)
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

        with self.tasks():
            delete_project(object_id=project.id)

        assert not Project.objects.filter(id=project.id).exists()
        assert not EnvironmentProject.objects.filter(
            project_id=project.id, environment_id=env.id
        ).exists()
        assert Environment.objects.filter(id=env.id).exists()
        assert Release.objects.filter(id=release.id).exists()
        assert ReleaseCommit.objects.filter(release_id=release.id).exists()
        assert Commit.objects.filter(id=commit.id).exists()

    def test_cancels_without_pending_status(self):
        project = self.create_project(name="test", status=ProjectStatus.VISIBLE)
        with self.assertRaises(DeleteAborted):
            with self.tasks():
                delete_project(object_id=project.id)

        assert Project.objects.filter(id=project.id).exists()


class DeleteGroupTest(TestCase):
    def test_simple(self):
        event_id = "a" * 32
        event_id_2 = "b" * 32
        project = self.create_project()

        node_id = Event.generate_node_id(project.id, event_id)
        node_id_2 = Event.generate_node_id(project.id, event_id_2)

        event = self.store_event(
            data={
                "event_id": event_id,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        self.store_event(
            data={
                "event_id": event_id_2,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        group = event.group
        group.update(status=GroupStatus.PENDING_DELETION)

        GroupAssignee.objects.create(group=group, project=project, user=self.user)
        GroupHash.objects.create(project=project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

        assert nodestore.get(node_id)
        assert nodestore.get(node_id_2)

        with self.tasks():
            delete_groups(object_ids=[group.id])

        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()
        assert not nodestore.get(node_id)
        assert not nodestore.get(node_id_2)


class DeleteApplicationTest(TestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(
            owner=self.user, status=ApiApplicationStatus.pending_deletion
        )
        ApiToken.objects.create(application=app, user=self.user, scopes=0)
        ApiGrant.objects.create(
            application=app, user=self.user, scopes=0, redirect_uri="http://example.com"
        )

        with self.tasks():
            delete_api_application(object_id=app.id)

        assert not ApiApplication.objects.filter(id=app.id).exists()
        assert not ApiGrant.objects.filter(application=app).exists()
        assert not ApiToken.objects.filter(application=app).exists()


class RevokeApiTokensTest(TestCase):
    def test_basic(self):
        app = ApiApplication.objects.create(owner=self.user)
        token1 = ApiToken.objects.create(
            application=app, user=self.create_user("bar@example.com"), scopes=0
        )
        token2 = ApiToken.objects.create(
            application=app, user=self.create_user("foo@example.com"), scopes=0
        )

        with self.tasks():
            revoke_api_tokens(object_id=app.id)

        assert not ApiToken.objects.filter(id=token1.id).exists()
        assert not ApiToken.objects.filter(id=token2.id).exists()

    def test_with_timestamp(self):
        cutoff = datetime(2017, 1, 1)
        app = ApiApplication.objects.create(owner=self.user)
        token1 = ApiToken.objects.create(
            application=app, user=self.create_user("bar@example.com"), scopes=0, date_added=cutoff
        )
        token2 = ApiToken.objects.create(
            application=app,
            user=self.create_user("foo@example.com"),
            scopes=0,
            date_added=cutoff + timedelta(days=1),
        )

        with self.tasks():
            revoke_api_tokens(object_id=app.id, timestamp=cutoff)

        assert not ApiToken.objects.filter(id=token1.id).exists()
        assert ApiToken.objects.filter(id=token2.id).exists()


class GenericDeleteTest(TestCase):
    def test_does_not_delete_visible(self):
        project = self.create_project(status=ObjectStatus.VISIBLE)

        with self.tasks():
            with pytest.raises(DeleteAborted):
                generic_delete("sentry", "project", object_id=project.id)

        project = Project.objects.get(id=project.id)
        assert project.status == ObjectStatus.VISIBLE

    def test_deletes(self):
        project = self.create_project(status=ObjectStatus.PENDING_DELETION)

        with self.tasks():
            generic_delete("sentry", "project", object_id=project.id)

        assert not Project.objects.filter(id=project.id).exists()


class DeleteRepoTest(TestCase):
    def test_does_not_delete_visible(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            status=ObjectStatus.VISIBLE,
            provider="dummy",
            organization_id=org.id,
            name="example/example",
        )

        with self.tasks():
            with pytest.raises(DeleteAborted):
                delete_repository(object_id=repo.id)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.VISIBLE

    def test_deletes(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            status=ObjectStatus.PENDING_DELETION,
            organization_id=org.id,
            provider="dummy",
            name="example/example",
        )
        repo2 = Repository.objects.create(
            status=ObjectStatus.PENDING_DELETION,
            organization_id=org.id,
            provider="dummy",
            name="example/example2",
        )
        commit = Commit.objects.create(
            repository_id=repo.id, organization_id=org.id, key="1234abcd"
        )
        commit2 = Commit.objects.create(
            repository_id=repo2.id, organization_id=org.id, key="1234abcd"
        )

        with self.tasks():
            delete_repository(object_id=repo.id)

        assert not Repository.objects.filter(id=repo.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()
        assert Commit.objects.filter(id=commit2.id).exists()

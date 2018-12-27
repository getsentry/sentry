from __future__ import absolute_import

from sentry.models import (
    Commit, CommitAuthor, Environment, Organization, Release, ReleaseCommit, ReleaseEnvironment,
    Repository, ScheduledDeletion
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteOrganizationTest(TestCase):
    def test_simple(self):
        org = self.create_organization(
            name='test',
        )
        org2 = self.create_organization(name='test2')
        self.create_team(organization=org, name='test1')
        self.create_team(organization=org, name='test2')
        release = Release.objects.create(version='a' * 32, organization_id=org.id)
        repo = Repository.objects.create(
            organization_id=org.id,
            name=org.name,
            provider='dummy',
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
        ReleaseCommit.objects.create(
            organization_id=org.id,
            release=release,
            commit=commit,
            order=0,
        )

        env = Environment.objects.create(organization_id=org.id, project_id=4, name='foo')
        release_env = ReleaseEnvironment.objects.create(
            organization_id=org.id, project_id=4, release_id=release.id, environment_id=env.id
        )

        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert Organization.objects.filter(id=org2.id).exists()

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Environment.objects.filter(id=env.id).exists()
        assert not ReleaseEnvironment.objects.filter(id=release_env.id).exists()
        assert not Repository.objects.filter(id=repo.id).exists()
        assert not ReleaseCommit.objects.filter(organization_id=org.id).exists()
        assert not Release.objects.filter(organization_id=org.id).exists()
        assert not CommitAuthor.objects.filter(id=commit_author.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()

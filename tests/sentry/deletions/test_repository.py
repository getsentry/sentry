from __future__ import absolute_import

from sentry.models import Commit, Repository, ScheduledDeletion
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteRepositoryTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            provider='dummy',
            name='example/example',
        )
        repo2 = Repository.objects.create(
            organization_id=org.id,
            provider='dummy',
            name='example/example2',
        )
        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=org.id,
            key='1234abcd',
        )
        commit2 = Commit.objects.create(
            repository_id=repo2.id,
            organization_id=org.id,
            key='1234abcd',
        )

        deletion = ScheduledDeletion.schedule(repo, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Repository.objects.filter(id=repo.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()
        assert Commit.objects.filter(id=commit2.id).exists()

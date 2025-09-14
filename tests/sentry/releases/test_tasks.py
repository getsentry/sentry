from django.core.cache import cache

from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange as OldCommitFileChange
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.releases.models import Commit, CommitFileChange
from sentry.releases.tasks import backfill_commits_for_release
from sentry.testutils.cases import TestCase


class BackfillCommitsForReleaseAsyncTest(TestCase):
    def setUp(self):
        super().setUp()
        self.repo = Repository.objects.create(
            name="test-repo",
            organization_id=self.organization.id,
        )
        self.author = CommitAuthor.objects.create(
            organization_id=self.organization.id,
            email="test@example.com",
            name="Test Author",
        )
        self.release = self.create_release(project=self.project, version="1.0.0")

    def test_backfill_commits_and_file_changes(self):
        old_commit1 = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="commit1",
            message="First commit",
            author=self.author,
        )
        old_commit2 = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="commit2",
            message="Second commit",
            author=self.author,
        )
        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=self.release,
            commit=old_commit1,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=self.release,
            commit=old_commit2,
            order=2,
        )
        old_fc1 = OldCommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit_id=old_commit1.id,
            filename="file1.py",
            type="A",
        )
        old_fc2 = OldCommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit_id=old_commit1.id,
            filename="file2.py",
            type="M",
        )
        old_fc3 = OldCommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit_id=old_commit2.id,
            filename="file3.py",
            type="D",
        )
        assert not Commit.objects.filter(id__in=[old_commit1.id, old_commit2.id]).exists()
        assert not CommitFileChange.objects.filter(
            id__in=[old_fc1.id, old_fc2.id, old_fc3.id]
        ).exists()
        backfill_commits_for_release(self.organization.id, self.release.id)
        assert Commit.objects.filter(id=old_commit1.id).exists()
        assert Commit.objects.filter(id=old_commit2.id).exists()
        assert CommitFileChange.objects.filter(id=old_fc1.id, commit_id=old_commit1.id).exists()
        assert CommitFileChange.objects.filter(id=old_fc2.id, commit_id=old_commit1.id).exists()
        assert CommitFileChange.objects.filter(id=old_fc3.id, commit_id=old_commit2.id).exists()

    def test_backfill_idempotent(self):
        old_commit = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="idempotent_test",
            message="Test idempotency",
            author=self.author,
        )
        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=self.release,
            commit=old_commit,
            order=1,
        )
        backfill_commits_for_release(self.organization.id, self.release.id)
        backfill_commits_for_release(self.organization.id, self.release.id)
        assert Commit.objects.filter(id=old_commit.id).count() == 1
        new_commit = Commit.objects.get(id=old_commit.id)
        assert new_commit.id == old_commit.id

    def test_backfill_partial_existing_data(self):
        old_commit1 = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="partial1",
            message="Partial 1",
            author=self.author,
        )
        old_commit2 = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="partial2",
            message="Partial 2",
            author=self.author,
        )

        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=self.release,
            commit=old_commit1,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=self.release,
            commit=old_commit2,
            order=2,
        )
        Commit.objects.create(
            id=old_commit1.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="partial1",
            message="Partial 1",
            author=self.author,
            date_added=old_commit1.date_added,
        )
        backfill_commits_for_release(self.organization.id, self.release.id)
        assert Commit.objects.filter(id=old_commit1.id).count() == 1
        assert Commit.objects.filter(id=old_commit2.id).count() == 1
        new_commit1 = Commit.objects.get(id=old_commit1.id)
        new_commit2 = Commit.objects.get(id=old_commit2.id)
        assert new_commit1.id == old_commit1.id
        assert new_commit2.id == old_commit2.id

    def test_backfill_with_cache(self):
        old_commit = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="cache_test",
            message="Cache test",
            author=self.author,
        )
        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=self.release,
            commit=old_commit,
            order=1,
        )
        backfill_commits_for_release(self.organization.id, self.release.id)
        assert Commit.objects.filter(id=old_commit.id).exists()
        new_commit = Commit.objects.get(id=old_commit.id)
        assert new_commit.id == old_commit.id
        Commit.objects.filter(id=old_commit.id).delete()
        backfill_commits_for_release(self.organization.id, self.release.id)
        assert not Commit.objects.filter(id=old_commit.id).exists()
        cache_key = f"commit-backfill:release:{self.release.id}"
        cache.delete(cache_key)
        backfill_commits_for_release(self.organization.id, self.release.id)
        assert Commit.objects.filter(id=old_commit.id).exists()
        new_commit = Commit.objects.get(id=old_commit.id)
        assert new_commit.id == old_commit.id

    def test_backfill_missing_organization(self):
        """Test that task handles missing organization gracefully"""
        # Call with non-existent organization ID
        backfill_commits_for_release(999999, self.release.id)
        # Should not raise an exception, just log and return

    def test_backfill_missing_release(self):
        """Test that task handles missing release gracefully"""
        # Call with non-existent release ID
        backfill_commits_for_release(self.organization.id, 999999)
        # Should not raise an exception, just log and return

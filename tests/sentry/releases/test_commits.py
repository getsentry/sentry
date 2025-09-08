from unittest.mock import patch

import pytest
from django.db import OperationalError
from django.utils import timezone

from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange as OldCommitFileChange
from sentry.models.repository import Repository
from sentry.releases.commits import bulk_create_commit_file_changes, create_commit
from sentry.releases.models import Commit, CommitFileChange
from sentry.testutils.cases import TestCase


class CreateCommitDualWriteTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo = Repository.objects.create(
            name="test-repo",
            organization_id=self.organization.id,
        )
        self.author = CommitAuthor.objects.create(
            organization_id=self.organization.id,
            email="test@example.com",
            name="Test Author",
        )

    def test_create_commit_without_feature_flag(self):
        """Test that only the old commit is created when feature flag is disabled"""
        with self.feature({"organizations:commit-retention-dual-writing": False}):
            old_commit, new_commit = create_commit(
                organization=self.organization,
                repo_id=self.repo.id,
                key="abc123",
                message="Test commit message",
                author=self.author,
            )
            assert old_commit is not None
            assert old_commit.organization_id == self.organization.id
            assert old_commit.repository_id == self.repo.id
            assert old_commit.key == "abc123"
            assert old_commit.message == "Test commit message"
            assert old_commit.author == self.author
            assert new_commit is None
            assert not Commit.objects.filter(key="abc123").exists()

    def test_create_commit_with_feature_flag(self):
        """Test that both commits are created when feature flag is enabled"""
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            old_commit, new_commit = create_commit(
                organization=self.organization,
                repo_id=self.repo.id,
                key="def456",
                message="Test commit with dual write",
                author=self.author,
            )

            assert old_commit.organization_id == self.organization.id
            assert old_commit.repository_id == self.repo.id
            assert old_commit.key == "def456"
            assert old_commit.message == "Test commit with dual write"
            assert old_commit.author == self.author
            assert new_commit is not None
            assert new_commit.organization_id == self.organization.id
            assert new_commit.repository_id == self.repo.id
            assert new_commit.key == "def456"
            assert new_commit.message == "Test commit with dual write"
            assert new_commit.author == self.author

    def test_create_commit_preserves_primary_key(self):
        """Test that the new commit uses the same primary key as the old commit"""
        # First, create some commits WITHOUT dual write to advance the auto-increment
        # This ensures the tables don't just happen to have the same ID by chance
        with self.feature({"organizations:commit-retention-dual-writing": False}):
            OldCommit.objects.create(
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                key="dummy1",
                message="Dummy commit 1",
            )
            dummy_commit2 = OldCommit.objects.create(
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                key="dummy2",
                message="Dummy commit 2",
            )

        # Now manually create a commit in the new table with a different ID
        # to ensure the auto-increment sequences are out of sync
        manual_new_commit = Commit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="manual",
            message="Manual commit to desync IDs",
        )

        # Now test that dual write preserves the old commit's ID
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            old_commit, new_commit = create_commit(
                organization=self.organization,
                repo_id=self.repo.id,
                key="ghi789",
                message="Test PK preservation",
                author=self.author,
            )

            assert new_commit is not None
            assert new_commit.id == old_commit.id
            # The IDs should NOT be sequential with the manual commit we created
            assert new_commit.id != manual_new_commit.id + 1
            assert old_commit.id > dummy_commit2.id
            fetched_new = Commit.objects.get(id=old_commit.id)
            assert fetched_new.key == "ghi789"
            assert fetched_new.organization_id == self.organization.id

    def test_create_commit_with_custom_date(self):
        """Test that custom date_added is preserved in both models"""
        custom_date = timezone.now().replace(year=2020, month=1, day=1)
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            old_commit, new_commit = create_commit(
                organization=self.organization,
                repo_id=self.repo.id,
                key="jkl012",
                message="Test with custom date",
                author=self.author,
                date_added=custom_date,
            )
            assert old_commit.date_added == custom_date
            assert new_commit is not None
            assert new_commit.date_added == custom_date

    def test_create_commit_with_none_values(self):
        """Test that None values are handled correctly"""
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            old_commit, new_commit = create_commit(
                organization=self.organization,
                repo_id=self.repo.id,
                key="pqr678",
                message=None,
                author=None,
            )
            assert old_commit.message is None
            assert old_commit.author is None
            assert new_commit is not None
            assert new_commit.message is None
            assert new_commit.author is None
            assert new_commit.id == old_commit.id

    def test_create_commit_transaction_atomicity(self):
        """Test that both commits are rolled back when new commit creation fails"""
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            with (
                patch.object(
                    Commit.objects, "create", side_effect=OperationalError("Connection failed")
                ),
                pytest.raises(OperationalError),
            ):
                create_commit(
                    organization=self.organization,
                    repo_id=self.repo.id,
                    key="test_atomicity_key",
                    message="This should fail and rollback",
                    author=self.author,
                )
            assert not OldCommit.objects.filter(key="test_atomicity_key").exists()
            assert not Commit.objects.filter(key="test_atomicity_key").exists()


class CreateCommitFileChangeDualWriteTest(TestCase):
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
        # Create a commit to use for file changes
        # We need to ensure it exists in both tables for the foreign key to work
        self.commit = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="base_commit",
            message="Base commit for testing",
            author=self.author,
        )
        # Also create it in the new table with the same ID for tests that use feature flag
        Commit.objects.create(
            id=self.commit.id,
            organization_id=self.commit.organization_id,
            repository_id=self.commit.repository_id,
            key=self.commit.key,
            message=self.commit.message,
            author=self.commit.author,
            date_added=self.commit.date_added,
        )

    def test_create_file_change_without_feature_flag(self):
        """Test that only the old file changes are created when feature flag is disabled"""
        with self.feature({"organizations:commit-retention-dual-writing": False}):
            file_changes = [
                OldCommitFileChange(
                    organization_id=self.organization.id,
                    commit_id=self.commit.id,
                    filename="src/main.py",
                    type="A",
                ),
            ]
            old_file_changes, new_file_changes = bulk_create_commit_file_changes(
                organization=self.organization,
                file_changes=file_changes,
            )
            assert len(old_file_changes) == 1
            assert old_file_changes[0].organization_id == self.organization.id
            assert old_file_changes[0].commit_id == self.commit.id
            assert old_file_changes[0].filename == "src/main.py"
            assert old_file_changes[0].type == "A"
            assert new_file_changes is None
            assert not CommitFileChange.objects.filter(filename="src/main.py").exists()

    def test_create_file_change_with_feature_flag(self):
        """Test that both file changes are created when feature flag is enabled"""
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            file_changes = [
                OldCommitFileChange(
                    organization_id=self.organization.id,
                    commit_id=self.commit.id,
                    filename="src/app.py",
                    type="M",
                ),
            ]
            old_file_changes, new_file_changes = bulk_create_commit_file_changes(
                organization=self.organization,
                file_changes=file_changes,
            )
            assert len(old_file_changes) == 1
            assert old_file_changes[0].organization_id == self.organization.id
            assert old_file_changes[0].commit_id == self.commit.id
            assert old_file_changes[0].filename == "src/app.py"
            assert old_file_changes[0].type == "M"
            assert new_file_changes is not None
            assert len(new_file_changes) == 1
            assert new_file_changes[0].organization_id == self.organization.id
            assert new_file_changes[0].commit_id == self.commit.id
            assert new_file_changes[0].filename == "src/app.py"
            assert new_file_changes[0].type == "M"

    def test_create_file_change_preserves_primary_key(self):
        """Test that the new file change uses the same primary key as the old file change"""
        # First, create some file changes WITHOUT dual write to advance the auto-increment
        # This ensures the tables don't just happen to have the same ID by chance
        with self.feature({"organizations:commit-retention-dual-writing": False}):
            OldCommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=self.commit.id,
                filename="dummy1.py",
                type="A",
            )
            dummy_fc2 = OldCommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=self.commit.id,
                filename="dummy2.py",
                type="M",
            )

        # Now manually create a file change in the new table with a different ID
        # to ensure the auto-increment sequences are out of sync
        manual_new_fc = CommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit_id=self.commit.id,
            filename="manual.py",
            type="D",
        )

        # Now test that dual write preserves the old file change's ID
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            file_changes = [
                OldCommitFileChange(
                    organization_id=self.organization.id,
                    commit_id=self.commit.id,
                    filename="test_pk.py",
                    type="M",
                ),
            ]
            old_file_changes, new_file_changes = bulk_create_commit_file_changes(
                organization=self.organization,
                file_changes=file_changes,
            )
            assert len(old_file_changes) == 1
            assert new_file_changes is not None
            assert len(new_file_changes) == 1
            assert new_file_changes[0].id == old_file_changes[0].id
            # The IDs should NOT be sequential with the manual file change we created
            assert new_file_changes[0].id != manual_new_fc.id + 1
            assert old_file_changes[0].id > dummy_fc2.id
            fetched_new = CommitFileChange.objects.get(id=old_file_changes[0].id)
            assert fetched_new.filename == "test_pk.py"
            assert fetched_new.organization_id == self.organization.id

    def test_create_file_change_transaction_atomicity(self):
        """Test that the operation is atomic when dual write fails"""
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            # Create a file change that will conflict on the unique constraint
            existing_old = OldCommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=self.commit.id,
                filename="unique_file.py",
                type="A",
            )
            with pytest.raises(Exception):
                file_changes = [
                    OldCommitFileChange(
                        organization_id=self.organization.id,
                        commit_id=self.commit.id,
                        filename="unique_file.py",
                        type="M",
                    ),
                ]
                bulk_create_commit_file_changes(
                    organization=self.organization,
                    file_changes=file_changes,
                )

            existing_old.refresh_from_db()
            assert existing_old.type == "A"
            assert not CommitFileChange.objects.filter(filename="unique_file.py").exists()

    def test_bulk_create_multiple_file_changes(self):
        """Test that bulk creation works with multiple file changes"""
        with self.feature({"organizations:commit-retention-dual-writing": True}):
            file_changes = [
                OldCommitFileChange(
                    organization_id=self.organization.id,
                    commit_id=self.commit.id,
                    filename="file1.py",
                    type="A",
                ),
                OldCommitFileChange(
                    organization_id=self.organization.id,
                    commit_id=self.commit.id,
                    filename="file2.py",
                    type="M",
                ),
                OldCommitFileChange(
                    organization_id=self.organization.id,
                    commit_id=self.commit.id,
                    filename="file3.py",
                    type="D",
                ),
            ]

            old_file_changes, new_file_changes = bulk_create_commit_file_changes(
                organization=self.organization,
                file_changes=file_changes,
            )

            assert len(old_file_changes) == 3
            assert old_file_changes[0].filename == "file1.py"
            assert old_file_changes[0].type == "A"
            assert old_file_changes[1].filename == "file2.py"
            assert old_file_changes[1].type == "M"
            assert old_file_changes[2].filename == "file3.py"
            assert old_file_changes[2].type == "D"
            assert new_file_changes is not None
            assert len(new_file_changes) == 3
            assert new_file_changes[0].filename == "file1.py"
            assert new_file_changes[0].type == "A"
            assert new_file_changes[1].filename == "file2.py"
            assert new_file_changes[1].type == "M"
            assert new_file_changes[2].filename == "file3.py"
            assert new_file_changes[2].type == "D"

            for old_fc, new_fc in zip(old_file_changes, new_file_changes):
                assert old_fc.id == new_fc.id

            assert (
                OldCommitFileChange.objects.filter(
                    filename__in=["file1.py", "file2.py", "file3.py"]
                ).count()
                == 3
            )
            assert (
                CommitFileChange.objects.filter(
                    filename__in=["file1.py", "file2.py", "file3.py"]
                ).count()
                == 3
            )

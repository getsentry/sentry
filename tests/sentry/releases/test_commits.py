from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from django.db import OperationalError
from django.utils import timezone

from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange as OldCommitFileChange
from sentry.models.repository import Repository
from sentry.releases.commits import (
    bulk_create_commit_file_changes,
    create_commit,
    get_dual_write_start_date,
    get_or_create_commit,
    update_commit,
)
from sentry.releases.models import Commit, CommitFileChange
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


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

    def test_create_commit(self):
        """Test that both commits are created"""
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
        with (
            patch.object(
                Commit.objects,
                "get_or_create",
                side_effect=OperationalError("Connection failed"),
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


class GetOrCreateCommitDualWriteTest(TestCase):
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

    def test_get_or_create_commit_creates_new(self):
        """Test that get_or_create creates a new commit when it doesn't exist"""
        old_commit, new_commit, created = get_or_create_commit(
            organization=self.organization,
            repo_id=self.repo.id,
            key="new123",
            message="New commit message",
            author=self.author,
        )

        assert created is True
        assert old_commit.key == "new123"
        assert old_commit.message == "New commit message"
        assert old_commit.author == self.author

        assert new_commit is not None
        assert new_commit.id == old_commit.id
        assert new_commit.key == "new123"
        assert new_commit.message == "New commit message"
        assert new_commit.author == self.author

    def test_get_or_create_commit_gets_existing(self):
        """Test that get_or_create returns existing commit when it exists"""
        existing_old, existing_new = create_commit(
            organization=self.organization,
            repo_id=self.repo.id,
            key="existing456",
            message="Existing commit",
            author=self.author,
        )
        assert existing_new is not None
        old_commit, new_commit, created = get_or_create_commit(
            organization=self.organization,
            repo_id=self.repo.id,
            key="existing456",
            message="This should not be used",
            author=None,
        )
        assert created is False
        assert old_commit.id == existing_old.id
        assert old_commit.key == "existing456"
        assert old_commit.message == "Existing commit"
        assert old_commit.author == self.author
        assert new_commit is not None
        assert new_commit.id == existing_new.id

    def test_get_or_create_commit_backfills_to_new_table(self):
        """Test that get_or_create backfills to new table if commit exists only in old table"""
        old_only_commit = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="old_only789",
            message="Old table only",
            author=self.author,
        )
        assert not Commit.objects.filter(id=old_only_commit.id).exists()

        old_commit, new_commit, created = get_or_create_commit(
            organization=self.organization,
            repo_id=self.repo.id,
            key="old_only789",
            message="Should not be used",
        )

        assert created is False
        assert old_commit.id == old_only_commit.id
        assert old_commit.message == "Old table only"
        assert new_commit is not None
        assert new_commit.id == old_only_commit.id
        assert new_commit.key == "old_only789"
        assert new_commit.message == "Old table only"
        assert new_commit.author == self.author


class UpdateCommitTest(TestCase):
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

    def test_update_commit_with_dual_write(self):
        """Test updating a commit updates both tables when new_commit is provided"""
        old_commit = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="abc123",
            message="Initial message",
            author=self.author,
        )
        new_commit = Commit.objects.create(
            id=old_commit.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="abc123",
            message="Initial message",
            author=self.author,
            date_added=old_commit.date_added,
        )
        update_commit(old_commit, new_commit, message="Updated message")
        old_commit.refresh_from_db()
        new_commit.refresh_from_db()
        assert old_commit.message == "Updated message"
        assert new_commit.message == "Updated message"

    def test_update_commit_atomic_transaction(self):
        """Test that updates are atomic when dual write is enabled"""
        old_commit = OldCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="ghi789",
            message="Initial message",
            author=self.author,
        )
        new_commit = Commit.objects.create(
            id=old_commit.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="ghi789",
            message="Initial message",
            author=self.author,
            date_added=old_commit.date_added,
        )
        with (
            patch.object(Commit, "update", side_effect=Exception("Update failed")),
            pytest.raises(Exception, match="Update failed"),
        ):
            update_commit(old_commit, new_commit, message="Should fail")

        old_commit.refresh_from_db()
        new_commit.refresh_from_db()
        assert old_commit.message == "Initial message"
        assert new_commit.message == "Initial message"


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

    def test_create_file_change(self):
        """Test that both file changes are created when feature flag is enabled"""
        file_changes = [
            OldCommitFileChange(
                organization_id=self.organization.id,
                commit_id=self.commit.id,
                filename="src/app.py",
                type="M",
            ),
        ]
        old_file_changes, new_file_changes = bulk_create_commit_file_changes(file_changes)
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

        file_changes = [
            OldCommitFileChange(
                organization_id=self.organization.id,
                commit_id=self.commit.id,
                filename="test_pk.py",
                type="M",
            ),
        ]
        old_file_changes, new_file_changes = bulk_create_commit_file_changes(file_changes)
        assert len(old_file_changes) == 1
        assert new_file_changes is not None
        assert len(new_file_changes) == 1
        # With ignore_conflicts, returned objects don't have IDs, so fetch from DB
        fetched_old = OldCommitFileChange.objects.get(
            commit_id=self.commit.id, filename="test_pk.py", type="M"
        )
        fetched_new = CommitFileChange.objects.get(
            commit_id=self.commit.id, filename="test_pk.py", type="M"
        )
        assert fetched_new.id == fetched_old.id
        # The IDs should NOT be sequential with the manual file change we created
        assert fetched_new.id != manual_new_fc.id + 1
        assert fetched_old.id > dummy_fc2.id
        assert fetched_new.filename == "test_pk.py"
        assert fetched_new.organization_id == self.organization.id

    def test_create_file_change_idempotent(self):
        """Test that the operation is idempotent with ignore_conflicts"""
        # Create a file change first
        existing_old = OldCommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit_id=self.commit.id,
            filename="unique_file.py",
            type="A",
        )
        # Try to create the same file change again (should be ignored, not error)
        file_changes = [
            OldCommitFileChange(
                organization_id=self.organization.id,
                commit_id=self.commit.id,
                filename="unique_file.py",
                type="A",  # Same type - exact duplicate
            ),
        ]
        # Should not raise due to ignore_conflicts
        bulk_create_commit_file_changes(file_changes)

        existing_old.refresh_from_db()
        assert existing_old.type == "A"
        # Should have dual written the existing one
        assert CommitFileChange.objects.filter(
            commit_id=self.commit.id, filename="unique_file.py"
        ).exists()
        new_fc = CommitFileChange.objects.get(commit_id=self.commit.id, filename="unique_file.py")
        assert new_fc.id == existing_old.id

    def test_bulk_create_multiple_file_changes(self):
        """Test that bulk creation works with multiple file changes"""
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

        old_file_changes, new_file_changes = bulk_create_commit_file_changes(file_changes)

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

        # With ignore_conflicts, returned objects don't have IDs, so fetch from DB
        for filename, ftype in [("file1.py", "A"), ("file2.py", "M"), ("file3.py", "D")]:
            old_fc = OldCommitFileChange.objects.get(
                commit_id=self.commit.id, filename=filename, type=ftype
            )
            new_fc = CommitFileChange.objects.get(
                commit_id=self.commit.id, filename=filename, type=ftype
            )
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


class GetDualWriteStartDateTest(TestCase):
    def test_get_dual_write_start_date_not_set(self):
        assert get_dual_write_start_date() is None

    def test_get_dual_write_start_date_valid_naive(self):
        """Test that naive datetime is converted to UTC"""
        with override_options({"commit.dual-write-start-date": "2024-01-15T10:30:00"}):
            result = get_dual_write_start_date()
            assert result is not None
            assert result.tzinfo is not None
            assert result == datetime(2024, 1, 15, 10, 30, tzinfo=UTC)

    def test_get_dual_write_start_date_valid_with_timezone(self):
        """Test that timezone-aware datetime is preserved"""
        with override_options({"commit.dual-write-start-date": "2024-01-15T10:30:00+05:00"}):
            result = get_dual_write_start_date()
            assert result is not None
            assert result.tzinfo is not None
            # The datetime should be the same moment in time
            expected = datetime(2024, 1, 15, 5, 30, tzinfo=UTC)
            assert result == expected

    def test_get_dual_write_start_date_invalid(self):
        with override_options({"commit.dual-write-start-date": "not-a-date"}):
            assert get_dual_write_start_date() is None

    def test_get_dual_write_start_date_empty_string(self):
        with override_options({"commit.dual-write-start-date": ""}):
            assert get_dual_write_start_date() is None

    def test_get_dual_write_start_date_comparison_with_django_models(self):
        """Test that the returned datetime can be compared with Django model datetimes"""
        with override_options({"commit.dual-write-start-date": "2024-01-15T10:30:00"}):
            dual_write_start = get_dual_write_start_date()
            assert dual_write_start is not None

            # Django's timezone.now() returns timezone-aware datetime
            now = timezone.now()
            # This comparison should not raise TypeError
            assert now > dual_write_start

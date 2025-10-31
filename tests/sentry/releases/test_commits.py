from unittest.mock import patch

import pytest
from django.db import OperationalError
from django.utils import timezone

from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.repository import Repository
from sentry.releases.commits import create_commit
from sentry.releases.models import Commit
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

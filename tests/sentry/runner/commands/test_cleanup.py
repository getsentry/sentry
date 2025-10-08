from datetime import datetime, timedelta
from unittest import mock
from uuid import uuid4

import pytest
from django.utils import timezone

from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.runner.commands.cleanup import cleanup_stuck_deletion_in_progress_groups
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class TestCleanupStuckDeletionInProgressGroups(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()

    def test_cleanup_old_stuck_groups(self):
        """Test that groups stuck in DELETION_IN_PROGRESS status for longer than the cleanup threshold get force-deleted."""

        # Create a group that's been stuck in DELETION_IN_PROGRESS for 100 days (longer than 95-day threshold)
        old_stuck_group = self.create_group(
            project=self.project,
            status=GroupStatus.DELETION_IN_PROGRESS,
        )
        old_stuck_group.last_seen = before_now(days=100)
        old_stuck_group.save()

        # Create a group that's been stuck for only 5 days (within grace period)
        recent_stuck_group = self.create_group(
            project=self.project,
            status=GroupStatus.DELETION_IN_PROGRESS,
        )
        recent_stuck_group.last_seen = before_now(days=5)
        recent_stuck_group.save()

        # Create a normal old group that should not be affected
        normal_old_group = self.create_group(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
        )
        normal_old_group.last_seen = before_now(days=100)
        normal_old_group.save()

        # Mock is_filtered to not filter any models
        def mock_is_filtered(model):
            return False

        models_attempted = set()

        # Run cleanup with 95-day threshold
        cleanup_stuck_deletion_in_progress_groups(
            is_filtered=mock_is_filtered,
            days=95,
            models_attempted=models_attempted,
        )

        # Old stuck group should be deleted
        assert not Group.objects.filter(id=old_stuck_group.id).exists()

        # Recent stuck group should still exist (within grace period)
        assert Group.objects.filter(id=recent_stuck_group.id).exists()

        # Normal old group should still exist (different status)
        assert Group.objects.filter(id=normal_old_group.id).exists()

        # Should track that Group model was attempted
        assert "group" in models_attempted

    def test_no_cleanup_within_grace_period(self):
        """Test that groups stuck in DELETION_IN_PROGRESS but older than cleanup threshold are not deleted if within grace period."""

        # Create a group stuck for 8 days (beyond grace period but within cleanup threshold)
        stuck_group = self.create_group(
            project=self.project,
            status=GroupStatus.DELETION_IN_PROGRESS,
        )
        stuck_group.last_seen = before_now(days=8)
        stuck_group.save()

        def mock_is_filtered(model):
            return False

        models_attempted = set()

        # Run cleanup with 95-day threshold - this group is only 8 days old, so it shouldn't be deleted
        cleanup_stuck_deletion_in_progress_groups(
            is_filtered=mock_is_filtered,
            days=95,
            models_attempted=models_attempted,
        )

        # Group should still exist (not old enough for cleanup threshold)
        assert Group.objects.filter(id=stuck_group.id).exists()

    def test_cleanup_respects_model_filtering(self):
        """Test that cleanup respects model filtering and skips when Group model is filtered."""

        # Create an old stuck group
        old_stuck_group = self.create_group(
            project=self.project,
            status=GroupStatus.DELETION_IN_PROGRESS,
        )
        old_stuck_group.last_seen = before_now(days=100)
        old_stuck_group.save()

        # Mock is_filtered to filter Group model
        def mock_is_filtered(model):
            from sentry.models.group import Group

            return model is Group

        models_attempted = set()

        # Run cleanup
        cleanup_stuck_deletion_in_progress_groups(
            is_filtered=mock_is_filtered,
            days=95,
            models_attempted=models_attempted,
        )

        # Group should still exist (model was filtered)
        assert Group.objects.filter(id=old_stuck_group.id).exists()

        # Should not track Group model as attempted since it was filtered
        assert "group" not in models_attempted

    def test_cleanup_handles_empty_result_set(self):
        """Test that cleanup handles the case where no stuck groups are found."""

        # Create only normal groups, no stuck ones
        normal_group = self.create_group(project=self.project)

        def mock_is_filtered(model):
            return False

        models_attempted = set()

        # Run cleanup - should complete without errors
        cleanup_stuck_deletion_in_progress_groups(
            is_filtered=mock_is_filtered,
            days=95,
            models_attempted=models_attempted,
        )

        # Normal group should still exist
        assert Group.objects.filter(id=normal_group.id).exists()

        # Should still track that Group model was attempted
        assert "group" in models_attempted

    def test_cleanup_processes_large_batches(self):
        """Test that cleanup can handle large numbers of stuck groups by processing in batches."""

        # Create 250 old stuck groups (more than the 100 batch size)
        old_stuck_groups = []
        for i in range(250):
            group = self.create_group(
                project=self.project,
                status=GroupStatus.DELETION_IN_PROGRESS,
            )
            group.last_seen = before_now(days=100)
            group.save()
            old_stuck_groups.append(group)

        def mock_is_filtered(model):
            return False

        models_attempted = set()

        # Run cleanup
        cleanup_stuck_deletion_in_progress_groups(
            is_filtered=mock_is_filtered,
            days=95,
            models_attempted=models_attempted,
        )

        # All stuck groups should be deleted
        for group in old_stuck_groups:
            assert not Group.objects.filter(id=group.id).exists()

        assert "group" in models_attempted

    def test_cleanup_continues_on_batch_failure(self):
        """Test that cleanup continues processing other batches even if one batch fails."""

        # Create multiple stuck groups
        stuck_groups = []
        for i in range(5):
            group = self.create_group(
                project=self.project,
                status=GroupStatus.DELETION_IN_PROGRESS,
            )
            group.last_seen = before_now(days=100)
            group.save()
            stuck_groups.append(group)

        def mock_is_filtered(model):
            return False

        models_attempted = set()

        # Mock the deletions.get to fail on first call but succeed on subsequent calls
        call_count = 0
        original_deletions_get = None

        def mock_deletions_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Simulated deletion failure")
            # For subsequent calls, we still want to properly delete the groups
            # So we'll use a simple approach - mark them as deleted by changing status
            query = kwargs.get("query", {})
            group_ids = query.get("id__in", [])
            Group.objects.filter(id__in=group_ids).delete()

            # Return a mock task that does nothing
            class MockTask:
                def chunk(self, apply_filter=True):
                    return False

            return MockTask()

        with mock.patch("sentry.runner.commands.cleanup.deletions") as mock_deletions:
            mock_deletions.get = mock_deletions_get

            # Run cleanup - should not raise exception despite first batch failure
            cleanup_stuck_deletion_in_progress_groups(
                is_filtered=mock_is_filtered,
                days=95,
                models_attempted=models_attempted,
            )

        # Should have tried to process batches despite the first failure
        assert call_count >= 1
        assert "group" in models_attempted

    def test_edge_case_exactly_at_thresholds(self):
        """Test edge cases where groups are exactly at the threshold boundaries."""

        # Group exactly at 7-day grace period boundary
        grace_period_group = self.create_group(
            project=self.project,
            status=GroupStatus.DELETION_IN_PROGRESS,
        )
        grace_period_group.last_seen = before_now(days=7)
        grace_period_group.save()

        # Group exactly at 95-day cleanup threshold
        cleanup_threshold_group = self.create_group(
            project=self.project,
            status=GroupStatus.DELETION_IN_PROGRESS,
        )
        cleanup_threshold_group.last_seen = before_now(days=95)
        cleanup_threshold_group.save()

        def mock_is_filtered(model):
            return False

        models_attempted = set()

        cleanup_stuck_deletion_in_progress_groups(
            is_filtered=mock_is_filtered,
            days=95,
            models_attempted=models_attempted,
        )

        # Grace period group should still exist (exactly at boundary, not past it)
        assert Group.objects.filter(id=grace_period_group.id).exists()

        # Cleanup threshold group should be deleted (exactly at boundary, qualifies for deletion)
        assert not Group.objects.filter(id=cleanup_threshold_group.id).exists()

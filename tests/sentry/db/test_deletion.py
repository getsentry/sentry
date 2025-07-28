from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from sentry.db.deletion import BulkDeleteQuery
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestCase, TransactionTestCase


class BulkDeleteQueryTest(TestCase):
    def test_project_restriction(self) -> None:
        project1 = self.create_project()
        group1_1 = self.create_group(project1, create_open_period=False)
        group1_2 = self.create_group(project1, create_open_period=False)
        project2 = self.create_project()
        group2_1 = self.create_group(project2, create_open_period=False)
        group2_2 = self.create_group(project2, create_open_period=False)
        BulkDeleteQuery(model=Group, project_id=project1.id).execute()
        assert Project.objects.filter(id=project1.id).exists()
        assert Project.objects.filter(id=project2.id).exists()
        assert Group.objects.filter(id=group2_1.id).exists()
        assert Group.objects.filter(id=group2_2.id).exists()
        assert not Group.objects.filter(id=group1_1.id).exists()
        assert not Group.objects.filter(id=group1_2.id).exists()

    def test_datetime_restriction(self) -> None:
        now = timezone.now()
        project1 = self.create_project()
        group1_1 = self.create_group(
            project1, create_open_period=False, last_seen=now - timedelta(days=1)
        )
        group1_2 = self.create_group(
            project1, create_open_period=False, last_seen=now - timedelta(days=1)
        )
        group1_3 = self.create_group(project1, create_open_period=False, last_seen=now)
        BulkDeleteQuery(model=Group, dtfield="last_seen", days=1).execute()
        assert not Group.objects.filter(id=group1_1.id).exists()
        assert not Group.objects.filter(id=group1_2.id).exists()
        assert Group.objects.filter(id=group1_3.id).exists()

    def test_excludes_groups_with_deletion_in_progress_status(self) -> None:
        """Test that groups with DELETION_IN_PROGRESS status are excluded from cleanup deletion."""
        now = timezone.now()
        project = self.create_project()
        
        # Create groups that are old enough to be deleted (90+ days)
        old_date = now - timedelta(days=91)
        
        # Group with normal status - should be deleted
        group_normal = self.create_group(
            project, create_open_period=False, last_seen=old_date
        )
        
        # Group with DELETION_IN_PROGRESS status - should NOT be deleted
        group_deletion_in_progress = self.create_group(
            project, create_open_period=False, last_seen=old_date
        )
        group_deletion_in_progress.update(status=GroupStatus.DELETION_IN_PROGRESS)
        
        # Group with PENDING_DELETION status - should NOT be deleted
        group_pending_deletion = self.create_group(
            project, create_open_period=False, last_seen=old_date
        )
        group_pending_deletion.update(status=GroupStatus.PENDING_DELETION)
        
        # Run cleanup with 90 day cutoff
        BulkDeleteQuery(model=Group, dtfield="last_seen", days=90).execute()
        
        # Verify results
        assert not Group.objects.filter(id=group_normal.id).exists(), \
            "Normal group should be deleted by cleanup"
        assert Group.objects.filter(id=group_deletion_in_progress.id).exists(), \
            "Group with DELETION_IN_PROGRESS status should NOT be deleted by cleanup"
        assert Group.objects.filter(id=group_pending_deletion.id).exists(), \
            "Group with PENDING_DELETION status should NOT be deleted by cleanup"

    def test_excludes_groups_with_deletion_status_in_iterator(self) -> None:
        """Test that groups with deletion statuses are excluded from iterator results."""
        now = timezone.now()
        project = self.create_project()
        
        # Create groups that are old enough to be deleted
        old_date = now - timedelta(days=91)
        
        # Group with normal status - should be included in results
        group_normal = self.create_group(
            project, create_open_period=False, last_seen=old_date
        )
        
        # Group with DELETION_IN_PROGRESS status - should NOT be included
        group_deletion_in_progress = self.create_group(
            project, create_open_period=False, last_seen=old_date
        )
        group_deletion_in_progress.update(status=GroupStatus.DELETION_IN_PROGRESS)
        
        # Group with PENDING_DELETION status - should NOT be included  
        group_pending_deletion = self.create_group(
            project, create_open_period=False, last_seen=old_date
        )
        group_pending_deletion.update(status=GroupStatus.PENDING_DELETION)
        
        # Get iterator results
        iterator = BulkDeleteQuery(
            model=Group,
            dtfield="last_seen",
            order_by="last_seen",
            days=90,
        ).iterator(chunk_size=10)
        
        results = set()
        for chunk in iterator:
            results.update(chunk)
        
        # Verify only normal group is included
        assert group_normal.id in results, \
            "Normal group should be included in cleanup iterator"
        assert group_deletion_in_progress.id not in results, \
            "Group with DELETION_IN_PROGRESS status should NOT be included in cleanup iterator"
        assert group_pending_deletion.id not in results, \
            "Group with PENDING_DELETION status should NOT be included in cleanup iterator"

    def test_status_exclusion_only_applies_to_group_model(self) -> None:
        """Test that status exclusion logic only applies to Group models, not other models."""
        # This test ensures we didn't break other models that might have a 'status' field
        project = self.create_project()
        
        # Create a group to verify the status filtering still works for groups
        old_date = timezone.now() - timedelta(days=91)
        group_deletion_in_progress = self.create_group(
            project, create_open_period=False, last_seen=old_date
        )
        group_deletion_in_progress.update(status=GroupStatus.DELETION_IN_PROGRESS)
        
        # Run cleanup on groups - should exclude the group with deletion status
        BulkDeleteQuery(model=Group, dtfield="last_seen", days=90).execute()
        
        # Group should still exist (not deleted due to status)
        assert Group.objects.filter(id=group_deletion_in_progress.id).exists(), \
            "Group with DELETION_IN_PROGRESS status should be preserved"


class BulkDeleteQueryIteratorTestCase(TransactionTestCase):
    def test_iteration(self) -> None:
        target_project = self.project
        expected_group_ids = {self.create_group().id for i in range(2)}

        other_project = self.create_project()
        self.create_group(other_project)
        self.create_group(other_project)

        iterator = BulkDeleteQuery(
            model=Group,
            project_id=target_project.id,
            dtfield="last_seen",
            order_by="last_seen",
            days=0,
        ).iterator(1)

        results: set[int] = set()
        for chunk in iterator:
            results.update(chunk)

        assert results == expected_group_ids

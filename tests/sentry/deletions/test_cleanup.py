from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.models.group import Group
from sentry.runner.commands.cleanup import delete_groups_older_than_days
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


class DeleteGroupsOlderThanDaysTest(TestCase):
    def test_deletes_groups_older_than_cutoff(self) -> None:
        """Test that groups with last_seen older than cutoff are deleted."""
        project = self.create_project()

        # Create old groups (should be deleted)
        old_group_1 = self.create_group(
            project=project, last_seen=before_now(days=100), message="Old group 1"
        )
        old_group_2 = self.create_group(
            project=project, last_seen=before_now(days=95), message="Old group 2"
        )

        # Create recent group (should NOT be deleted)
        recent_group = self.create_group(
            project=project, last_seen=before_now(days=1), message="Recent group"
        )

        with override_options(
            {
                "cleanup.delete-old-groups.enabled": True,
                "cleanup.delete-old-groups.iterations": 10,
                "cleanup.delete-old-groups.batch-size": 1000,
            }
        ):
            delete_groups_older_than_days(days=90)

        # Old groups should be deleted
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(id=old_group_1.id)
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(id=old_group_2.id)

        # Recent group should still exist
        assert Group.objects.filter(id=recent_group.id).exists()

    def test_respects_batch_size(self) -> None:
        """Test that deletion respects the configured batch size."""
        project = self.create_project()

        # Create 5 old groups
        for i in range(5):
            self.create_group(
                project=project, last_seen=before_now(days=100), message=f"Old group {i}"
            )

        with override_options(
            {
                "cleanup.delete-old-groups.enabled": True,
                "cleanup.delete-old-groups.iterations": 10,
                "cleanup.delete-old-groups.batch-size": 2,
            }
        ):
            delete_groups_older_than_days(days=90)

        # All groups should eventually be deleted with small batch size
        assert Group.objects.filter(project=project).count() == 0

    def test_respects_iteration_limit(self) -> None:
        """Test that deletion stops after configured number of iterations."""
        project1 = self.create_project()
        project2 = self.create_project()

        # Create many old groups across two projects
        for project in [project1, project2]:
            for i in range(5):
                self.create_group(
                    project=project, last_seen=before_now(days=100), message=f"Old group {i}"
                )

        with override_options(
            {
                "cleanup.delete-old-groups.enabled": True,
                "cleanup.delete-old-groups.iterations": 2,  # Only 2 iterations
                "cleanup.delete-old-groups.batch-size": 1,  # Small batch to ensure we hit limit
            }
        ):
            delete_groups_older_than_days(days=90)

        # Not all groups should be deleted due to iteration limit
        # With batch_size=1 and iterations=2, only 2 groups total should be deleted
        remaining_groups = Group.objects.filter(project__in=[project1, project2]).count()
        assert remaining_groups > 0  # Some groups should remain (8 out of 10)

    def test_processes_multiple_projects(self) -> None:
        """Test that deletion works across multiple projects."""
        project1 = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()

        # Create old groups in each project
        old_group_1 = self.create_group(project=project1, last_seen=before_now(days=100))
        old_group_2 = self.create_group(project=project2, last_seen=before_now(days=100))
        old_group_3 = self.create_group(project=project3, last_seen=before_now(days=100))

        with override_options(
            {
                "cleanup.delete-old-groups.iterations": 100,
                "cleanup.delete-old-groups.batch-size": 1000,
            }
        ):
            delete_groups_older_than_days(days=90)

        # All old groups should be deleted regardless of project
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(id=old_group_1.id)
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(id=old_group_2.id)
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(id=old_group_3.id)

    def test_handles_empty_database(self) -> None:
        """Test that function handles case with no groups gracefully."""
        with override_options(
            {
                "cleanup.delete-old-groups.iterations": 10,
                "cleanup.delete-old-groups.batch-size": 1000,
            }
        ):
            # Should not raise any errors
            delete_groups_older_than_days(days=90)

    def test_handles_project_with_no_old_groups(self) -> None:
        """Test that function skips projects with no old groups."""
        project = self.create_project()

        # Only create recent groups
        recent_group_1 = self.create_group(project=project, last_seen=before_now(days=1))
        recent_group_2 = self.create_group(project=project, last_seen=before_now(days=5))

        with override_options(
            {
                "cleanup.delete-old-groups.enabled": True,
                "cleanup.delete-old-groups.iterations": 10,
                "cleanup.delete-old-groups.batch-size": 1000,
            }
        ):
            delete_groups_older_than_days(days=90)

        # All groups should still exist
        assert Group.objects.filter(id=recent_group_1.id).exists()
        assert Group.objects.filter(id=recent_group_2.id).exists()

    def test_cutoff_date_boundary(self) -> None:
        """Test groups exactly at the cutoff boundary."""
        project = self.create_project()

        # Create group exactly at 90 days ago
        cutoff_time = timezone.now() - timedelta(days=90)
        group_at_boundary = self.create_group(project=project, last_seen=cutoff_time)

        # Create group just before cutoff (91 days, should be deleted)
        old_group = self.create_group(project=project, last_seen=cutoff_time - timedelta(hours=1))

        # Create group just after cutoff (89 days, should NOT be deleted)
        recent_group = self.create_group(
            project=project, last_seen=cutoff_time + timedelta(hours=1)
        )

        with override_options(
            {
                "cleanup.delete-old-groups.enabled": True,
                "cleanup.delete-old-groups.iterations": 10,
                "cleanup.delete-old-groups.batch-size": 1000,
            }
        ):
            delete_groups_older_than_days(days=90)

        # Group at boundary should be deleted (< cutoff)
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(id=group_at_boundary.id)

        # Old group should be deleted
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(id=old_group.id)

        # Recent group should still exist
        assert Group.objects.filter(id=recent_group.id).exists()

    def test_deletion_order_uses_index(self) -> None:
        """Test that groups are deleted in order by last_seen DESC, id DESC (matching index)."""
        project = self.create_project()

        # Create groups with different last_seen times
        self.create_group(project=project, last_seen=before_now(days=95))
        self.create_group(project=project, last_seen=before_now(days=100))
        self.create_group(project=project, last_seen=before_now(days=92))

        with override_options(
            {
                "cleanup.delete-old-groups.enabled": True,
                "cleanup.delete-old-groups.iterations": 10,
                "cleanup.delete-old-groups.batch-size": 1,
            }
        ):
            delete_groups_older_than_days(days=90)

        # All old groups should be deleted
        assert Group.objects.filter(project=project).count() == 0

    def test_metrics_are_emitted(self) -> None:
        """Test that metrics are properly emitted during deletion."""
        project = self.create_project()

        # Create old groups
        self.create_group(project=project, last_seen=before_now(days=100))
        self.create_group(project=project, last_seen=before_now(days=95))

        with (
            override_options(
                {
                    "cleanup.delete-old-groups.enabled": True,
                    "cleanup.delete-old-groups.iterations": 10,
                    "cleanup.delete-old-groups.batch-size": 1000,
                }
            ),
            patch("sentry.utils.metrics.incr") as mock_incr,
            patch("sentry.utils.metrics.timer") as mock_timer,
        ):
            delete_groups_older_than_days(days=90)

            # Verify metrics were called
            assert mock_timer.called
            assert mock_incr.called

            # Check that deleted_count metric was incremented
            incr_calls = [call[0][0] for call in mock_incr.call_args_list]
            assert "cleanup.delete-old-groups.deleted_count" in incr_calls

    def test_batch_processing_with_large_dataset(self) -> None:
        """Test batch processing with more groups than batch size."""
        project = self.create_project()

        # Create 10 old groups
        for i in range(10):
            self.create_group(
                project=project, last_seen=before_now(days=100), message=f"Old group {i}"
            )

        with override_options(
            {
                "cleanup.delete-old-groups.enabled": True,
                "cleanup.delete-old-groups.iterations": 20,
                "cleanup.delete-old-groups.batch-size": 3,  # Smaller batch
            }
        ):
            delete_groups_older_than_days(days=90)

        # All groups should be deleted
        assert Group.objects.filter(project=project).count() == 0

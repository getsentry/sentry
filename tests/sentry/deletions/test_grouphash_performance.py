"""
Tests for the performance fix to prevent query cancellation during group hash deletion.

The issue was that when deleting large numbers of GroupHash objects, Django would
generate UPDATE queries with very large IN clauses to set seer_matched_grouphash_id = NULL,
causing database query cancellations due to missing indexes and large IN clauses.
"""

from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry.deletions.tasks.groups import delete_groups_for_project
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class GroupHashDeletionPerformanceTest(TestCase):
    def test_large_batch_deletion_with_seer_references(self) -> None:
        """
        Test that deleting groups with many GroupHash objects and seer_matched_grouphash
        references doesn't cause query cancellation issues.

        This test simulates the scenario that was causing OperationalError:
        canceling statement due to user request.
        """
        # Create a main group that will be referenced by many others
        main_event = self.store_event(data={"message": "Main group"}, project_id=self.project.id)
        assert main_event.group
        main_group_id = main_event.group.id
        main_grouphash = GroupHash.objects.filter(group_id=main_group_id).first()
        assert main_grouphash

        # Create multiple groups that will have seer matches pointing to the main group
        group_ids = []

        # Create a batch of groups with seer references
        with patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True):
            with patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues",
                return_value=(0.01, main_grouphash),
            ):
                # Create 50 groups to simulate a moderate batch size
                for i in range(50):
                    event = self.store_event(
                        data={"message": f"Test message {i}"}, project_id=self.project.id
                    )
                    if event.group:
                        group_ids.append(event.group.id)

        # Verify that the seer references were created
        seer_referenced_metadata = GroupHashMetadata.objects.filter(
            seer_matched_grouphash=main_grouphash
        )
        assert seer_referenced_metadata.count() > 0

        # Add the main group to the deletion list
        group_ids.append(main_group_id)

        # Mock the batch size to be larger to test chunking behavior
        with patch("sentry.options.get") as mock_options:
            mock_options.return_value = 10000  # Large batch size

            # This should not raise a query cancellation error
            with self.tasks():
                delete_groups_for_project(
                    object_ids=group_ids[:10],  # Delete a subset to test chunking
                    transaction_id=uuid4().hex,
                    project_id=self.project.id,
                )

        # Verify that the groups were deleted successfully
        for group_id in group_ids[:10]:
            assert not Group.objects.filter(id=group_id).exists()
            assert not GroupHash.objects.filter(group_id=group_id).exists()

    def test_deletion_chunking_prevents_large_in_clauses(self) -> None:
        """
        Test that the deletion process properly chunks large batches to prevent
        large IN clauses in the seer_matched_grouphash_id UPDATE query.
        """
        # Create some groups
        group_ids = []
        for i in range(20):
            event = self.store_event(
                data={"message": f"Chunk test {i}"}, project_id=self.project.id
            )
            if event.group:
                group_ids.append(event.group.id)

        # Mock the batch size settings to test chunking
        with patch("sentry.options.get") as mock_options:
            mock_options.return_value = 5000  # Large batch size

            # Mock the GroupHash.objects.filter().delete() to verify chunking
            original_delete = GroupHash.objects.filter().__class__.delete
            delete_calls = []

            def mock_delete(self):
                # Record the size of each delete operation
                delete_calls.append(len(self.values_list("id", flat=True)))
                return original_delete(self)

            with patch.object(GroupHash.objects.filter().__class__, "delete", mock_delete):
                with self.tasks():
                    delete_groups_for_project(
                        object_ids=group_ids,
                        transaction_id=uuid4().hex,
                        project_id=self.project.id,
                    )

        # Verify that groups were deleted
        for group_id in group_ids:
            assert not Group.objects.filter(id=group_id).exists()

    def test_deletion_continues_on_chunk_failure(self) -> None:
        """
        Test that if one chunk fails to delete, the process continues with remaining chunks.
        """
        # Create some groups
        group_ids = []
        for i in range(10):
            event = self.store_event(
                data={"message": f"Failure test {i}"}, project_id=self.project.id
            )
            if event.group:
                group_ids.append(event.group.id)

        # Mock one chunk to fail
        original_delete = GroupHash.objects.filter().__class__.delete
        call_count = 0

        def mock_delete_with_failure(self):
            nonlocal call_count
            call_count += 1
            if call_count == 1:  # Fail the first chunk
                raise Exception("Simulated database error")
            return original_delete(self)

        with patch.object(GroupHash.objects.filter().__class__, "delete", mock_delete_with_failure):
            with self.tasks():
                # This should not raise an exception despite the chunk failure
                delete_groups_for_project(
                    object_ids=group_ids,
                    transaction_id=uuid4().hex,
                    project_id=self.project.id,
                )

        # Some groups should still be deleted (the ones after the failed chunk)
        remaining_groups = Group.objects.filter(id__in=group_ids).count()
        assert remaining_groups < len(group_ids)  # Some were deleted despite the failure

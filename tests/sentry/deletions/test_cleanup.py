from multiprocessing import JoinableQueue as Queue
from unittest.mock import Mock, patch

import pytest

from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.runner.commands.cleanup import (
    _STOP_WORKER,
    _cleanup,
    multiprocess_worker,
    process_deletion_task,
)
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now

RETENTION_DAYS = 2
LESS_THAN_RETENTION_DAYS = before_now(days=RETENTION_DAYS - 1).isoformat()
MORE_THAN_RETENTION_DAYS = before_now(days=RETENTION_DAYS + 1).isoformat()


# TransactionTestCase is needed to ensure that the events are stored in the same transaction
# as the cleanup process since it uses raw SQL queries and cannot see test transactions
class TestGroupDeletion(TestCase):
    """Test the group deletion functionality."""

    def _create_group(
        self,
        fingerprint: str,
        timestamp: str,
        status: int = GroupStatus.UNRESOLVED,
        project_id: int | None = None,
    ) -> Event:
        if project_id is None:
            project_id = self.project.id
        event = self.store_event(
            data={"fingerprint": [fingerprint], "timestamp": timestamp}, project_id=project_id
        )
        assert event.group is not None

        if status != GroupStatus.UNRESOLVED:
            event.group.status = status
            event.group.substatus = None
            event.group.save()

        assert event.group.status == status

        return event

    def test_only_deletes_old_groups(self) -> None:
        """Test cleanup only deletes old groups."""
        young_event = self._create_group("group1", LESS_THAN_RETENTION_DAYS)
        assert young_event.group is not None
        group_id = young_event.group.id
        self._create_group("group2", MORE_THAN_RETENTION_DAYS)
        assert Group.objects.count() == 2
        assert GroupHash.objects.count() == 2

        _cleanup(
            model=("Group",),
            days=RETENTION_DAYS,
            router="default",
            silent=True,
            disable_multiprocessing=True,
        )

        assert Group.objects.filter(id=group_id).exists()
        assert Group.objects.count() == 1
        assert GroupHash.objects.count() == 1

    def test_delete_old_pending_groups(self) -> None:
        """Test cleanup does not delete pending deletion groups."""
        self._create_group("group1", MORE_THAN_RETENTION_DAYS, GroupStatus.PENDING_DELETION)

        assert GroupHash.objects.count() == 1
        assert Group.objects.count() == 1

        _cleanup(
            model=("Group",),
            days=RETENTION_DAYS,
            router="default",
            silent=True,
            disable_multiprocessing=True,
        )

        assert Group.objects.count() == 0
        assert GroupHash.objects.count() == 0

    def test_delete_old_pending_groups_for_multiple_projects(self) -> None:
        """Test cleanup deletes old pending groups for multiple projects."""
        self._create_group("group1", MORE_THAN_RETENTION_DAYS, GroupStatus.PENDING_DELETION)
        project2 = self.create_project(name="Project 2")
        self._create_group(
            "group1", MORE_THAN_RETENTION_DAYS, GroupStatus.PENDING_DELETION, project2.id
        )

        assert GroupHash.objects.count() == 2
        assert Group.objects.count() == 2

        _cleanup(
            model=("Group",),
            days=RETENTION_DAYS,
            router="default",
            silent=True,
            disable_multiprocessing=True,
        )

        assert Group.objects.count() == 0
        assert GroupHash.objects.count() == 0


class TestCleanupMultiprocessing(TransactionTestCase):
    """Test the multiprocessing functionality in cleanup."""

    def test_multiprocess_worker_stop_signal(self) -> None:
        """Test that multiprocess_worker stops when receiving STOP_WORKER signal."""
        task_queue = Queue()

        # Put stop signal in queue
        task_queue.put(_STOP_WORKER)

        # This should return without processing anything
        multiprocess_worker(task_queue)

        # Verify task was marked as done
        assert task_queue.empty()

    def test_multiprocess_worker_processes_tasks(self) -> None:
        """Test that multiprocess_worker processes regular tasks."""
        task_queue = Queue()

        # Create a group to delete
        event = self.store_event(
            data={"fingerprint": ["test-fingerprint"], "timestamp": MORE_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )
        assert event.group is not None
        group_id = event.group.id

        # Queue a task and then stop signal
        task_queue.put(("sentry.models.Group", (group_id,)))
        task_queue.put(_STOP_WORKER)

        # Process the tasks
        multiprocess_worker(task_queue)

        # Verify group was deleted
        assert not Group.objects.filter(id=group_id).exists()

    def test_multiprocess_worker_handles_exceptions(self) -> None:
        """Test that multiprocess_worker handles exceptions gracefully."""
        task_queue = Queue()

        # Queue an invalid task that should cause an exception
        task_queue.put(("invalid.model.name", (999999,)))
        task_queue.put(_STOP_WORKER)

        # This should not raise an exception despite the invalid task
        multiprocess_worker(task_queue)

    def test_process_deletion_task_deletes_group(self) -> None:
        """Test that process_deletion_task properly deletes a group."""
        # Create a group to delete
        event = self.store_event(
            data={"fingerprint": ["test-fingerprint"], "timestamp": MORE_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )
        assert event.group is not None
        group_id = event.group.id

        # Process deletion task
        process_deletion_task("sentry.models.Group", [group_id])

        # Verify group was deleted
        assert not Group.objects.filter(id=group_id).exists()

    def test_process_deletion_task_with_multiple_ids(self) -> None:
        """Test that process_deletion_task handles multiple IDs."""
        # Create multiple groups
        event1 = self.store_event(
            data={"fingerprint": ["test-fingerprint-1"], "timestamp": MORE_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"fingerprint": ["test-fingerprint-2"], "timestamp": MORE_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )
        assert event1.group is not None
        assert event2.group is not None
        group_ids = [event1.group.id, event2.group.id]

        # Process deletion task with multiple IDs
        process_deletion_task("sentry.models.Group", group_ids)

        # Verify both groups were deleted
        assert not Group.objects.filter(id__in=group_ids).exists()

    def test_process_deletion_task_skips_models(self) -> None:
        """Test that process_deletion_task respects skip_models configuration."""
        # Create a group
        event = self.store_event(
            data={"fingerprint": ["test-fingerprint"], "timestamp": MORE_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )
        assert event.group is not None
        group_id = event.group.id

        # Group should be in skip_models by default (see line 96 in cleanup.py)
        # So calling process_deletion_task should still work as it's handled specially
        process_deletion_task("sentry.models.Group", [group_id])

        # Verify group was deleted (Group model handling bypasses skip_models)
        assert not Group.objects.filter(id=group_id).exists()

    @pytest.mark.skip("Flaky test")
    @patch("sentry.runner.commands.cleanup.Process")
    def test_cleanup_creates_worker_processes(self, mock_process) -> None:
        """Test that _cleanup creates the correct number of worker processes."""
        # Create a mock process instance
        mock_process_instance = Mock()
        mock_process.return_value = mock_process_instance

        # Create a test group
        self.store_event(
            data={"fingerprint": ["test"], "timestamp": MORE_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )

        concurrency = 3
        _cleanup(
            model=("Group",),
            days=RETENTION_DAYS,
            router="default",
            silent=True,
            concurrency=concurrency,
        )

        # Verify processes were created
        assert mock_process.call_count == concurrency
        assert mock_process_instance.start.call_count == concurrency
        assert mock_process_instance.join.call_count == concurrency

    def test_cleanup_with_multiprocessing_integration(self) -> None:
        """Test full cleanup process with multiprocessing enabled."""
        # Create test data
        young_event = self.store_event(
            data={"fingerprint": ["young-group"], "timestamp": LESS_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )
        old_event = self.store_event(
            data={"fingerprint": ["old-group"], "timestamp": MORE_THAN_RETENTION_DAYS},
            project_id=self.project.id,
        )

        assert young_event.group is not None
        assert old_event.group is not None
        young_group_id = young_event.group.id
        old_group_id = old_event.group.id

        initial_count = Group.objects.count()
        assert initial_count == 2

        # Run cleanup with low concurrency to avoid test complexity
        _cleanup(
            model=("Group",),
            days=RETENTION_DAYS,
            router="default",
            silent=True,
            concurrency=1,  # Use single worker to avoid race conditions in tests
        )

        # Verify only old group was deleted
        assert Group.objects.filter(id=young_group_id).exists()
        assert not Group.objects.filter(id=old_group_id).exists()
        assert Group.objects.count() == 1

    def test_multiprocessing_queue_task_distribution(self) -> None:
        """Test that tasks are properly distributed via the queue."""
        from multiprocessing import Queue as MPQueue

        task_queue: Queue = MPQueue()

        # Create test groups
        events = []
        group_ids = []
        for i in range(5):
            event = self.store_event(
                data={"fingerprint": [f"test-{i}"], "timestamp": MORE_THAN_RETENTION_DAYS},
                project_id=self.project.id,
            )
            events.append(event)
            assert event.group is not None
            group_ids.append(event.group.id)

        # Queue tasks manually
        for group_id in group_ids:
            task_queue.put(("sentry.models.Group", [group_id]))
        task_queue.put(_STOP_WORKER)

        # Process all tasks in a single worker
        multiprocess_worker(task_queue)

        # Verify all groups were deleted
        assert Group.objects.filter(id__in=group_ids).count() == 0

    def test_worker_queue_empty_behavior(self) -> None:
        """Test worker behavior when queue becomes empty."""
        task_queue = Queue()

        # Only put stop signal
        task_queue.put(_STOP_WORKER)

        # Worker should exit cleanly
        multiprocess_worker(task_queue)

        # Queue should be empty and properly task_done() called
        assert task_queue.empty()

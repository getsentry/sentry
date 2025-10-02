from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.runner.commands.cleanup import (
    _STOP_WORKER,
    _cleanup,
    multiprocess_worker,
    start_pool,
    stop_pool,
)
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now

RETENTION_DAYS = 2
LESS_THAN_RETENTION_DAYS = before_now(days=RETENTION_DAYS - 1).isoformat()
MORE_THAN_RETENTION_DAYS = before_now(days=RETENTION_DAYS + 1).isoformat()


# TransactionTestCase is needed to ensure that the events are stored in the same transaction
# as the cleanup process since it uses raw SQL queries and cannot see test transactions
class TestGroupDeletion(TransactionTestCase):
    """Test cleanup."""

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

        _cleanup(model=("Group",), days=RETENTION_DAYS, router="default", silent=True)

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

        _cleanup(model=("Group",), days=RETENTION_DAYS, router="default", silent=True)

        assert Group.objects.count() == 0
        assert GroupHash.objects.count() == 0


class TestCleanupMultiprocessing(TransactionTestCase):
    """Test the multiprocessing functionality in cleanup."""

    def test_starting_and_stopping_pool(self) -> None:
        """Test that starting and stopping the pool works."""
        pool, task_queue = start_pool(1)
        stop_pool(pool, task_queue)

    def test_multiprocess_worker_handles_exceptions(self) -> None:
        """Test that multiprocess_worker handles exceptions gracefully."""
        pool, task_queue = start_pool(1)

        # Queue an invalid task that should cause an exception
        task_queue.put(("invalid.model.name", (999999,)))
        task_queue.put(_STOP_WORKER)

        # This should not raise an exception despite the invalid task
        multiprocess_worker(task_queue)
        stop_pool(pool, task_queue)

    def test_worker_queue_empty_behavior(self) -> None:
        """Test worker behavior when queue becomes empty."""
        pool, task_queue = start_pool(1)

        # Only put stop signal
        task_queue.put(_STOP_WORKER)

        # Worker should exit cleanly
        multiprocess_worker(task_queue)
        stop_pool(pool, task_queue)
        # Queue should be empty and properly task_done() called
        assert task_queue.empty()

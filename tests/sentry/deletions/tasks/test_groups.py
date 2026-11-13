from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry import deletions, nodestore
from sentry.deletions.tasks.groups import delete_groups_for_project, discard_group
from sentry.exceptions import DeleteAborted
from sentry.locks import locks
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupredirect import GroupRedirect
from sentry.models.grouptombstone import GroupTombstone
from sentry.services import eventstore
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils.locking import UnableToAcquireLock

pytestmark = [requires_snuba]


class DeleteGroupTest(TestCase):
    def test_simple(self) -> None:
        event_id = "a" * 32
        event_id_2 = "b" * 32

        node_id = Event.generate_node_id(self.project.id, event_id)
        node_id_2 = Event.generate_node_id(self.project.id, event_id_2)

        event = self.store_event(
            data={
                "event_id": event_id,
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "event_id": event_id_2,
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )

        assert event.group is not None
        group = event.group
        # The API call marks the groups as pending deletion
        group.update(status=GroupStatus.PENDING_DELETION, substatus=None)

        conditions = eventstore.Filter(project_ids=[self.project.id], group_ids=[group.id])
        tenant_ids = {"organization_id": self.organization.id, "referrer": "foo"}
        events = eventstore.backend.get_events(conditions, tenant_ids=tenant_ids)
        assert len(events) == 2

        GroupAssignee.objects.create(group=group, project=self.project, user_id=self.user.id)
        grouphash = GroupHash.objects.create(project=self.project, group=group, hash=uuid4().hex)
        GroupHashMetadata.objects.create(grouphash=grouphash)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

        assert nodestore.backend.get(node_id)
        assert nodestore.backend.get(node_id_2)

        with self.tasks():
            delete_groups_for_project(
                object_ids=[group.id], transaction_id=uuid4().hex, project_id=self.project.id
            )

        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not GroupHashMetadata.objects.filter(grouphash_id=grouphash.id).exists()
        assert not Group.objects.filter(id=group.id).exists()
        assert not nodestore.backend.get(node_id)
        assert not nodestore.backend.get(node_id_2)

        # Ensure events are deleted from Snuba
        events = eventstore.backend.get_events(conditions, tenant_ids=tenant_ids)
        assert len(events) == 0

    def test_max_chunk_size_calls_once(self) -> None:
        CHUNK_SIZE = 5
        with patch(
            "sentry.deletions.defaults.group.GroupDeletionTask.DEFAULT_CHUNK_SIZE",
            new=CHUNK_SIZE,
        ):
            groups = self.create_n_groups_with_hashes(CHUNK_SIZE - 1, self.project)
            group_ids = [group.id for group in groups]

            task = deletions.get(model=Group, query={"id__in": group_ids})
            assert task.query_limit == task.chunk_size == CHUNK_SIZE  # type: ignore[attr-defined]

            has_more = True
            calls = 0
            while has_more:
                has_more = task.chunk()
                calls += 1

            assert calls == 1
            assert not Group.objects.filter(id__in=group_ids).exists()

    def test_max_chunk_size_plus_one_calls_twice(self) -> None:
        CHUNK_SIZE = 5
        with patch(
            "sentry.deletions.defaults.group.GroupDeletionTask.DEFAULT_CHUNK_SIZE",
            new=CHUNK_SIZE,
        ):
            # This test creates one more group than the chunk size
            groups = self.create_n_groups_with_hashes(CHUNK_SIZE + 1, self.project)
            group_ids = [group.id for group in groups]

            task = deletions.get(model=Group, query={"id__in": group_ids})
            assert task.query_limit == task.chunk_size == CHUNK_SIZE  # type: ignore[attr-defined]

            has_more = True
            calls = 0
            while has_more:
                has_more = task.chunk()
                calls += 1

            assert calls == 2
            assert not Group.objects.filter(id__in=group_ids).exists()

    def test_no_object_ids(self) -> None:
        with self.tasks(), pytest.raises(DeleteAborted) as excinfo:
            delete_groups_for_project(
                object_ids=[], transaction_id=uuid4().hex, project_id=self.project.id
            )
        assert str(excinfo.value) == "delete_groups.empty_object_ids"

    def test_groups_are_already_deleted(self) -> None:
        group = self.create_group()
        group.delete()

        with self.tasks(), pytest.raises(DeleteAborted) as excinfo:
            delete_groups_for_project(
                object_ids=[group.id], transaction_id=uuid4().hex, project_id=self.project.id
            )
        assert str(excinfo.value) == "delete_groups.no_groups_found"

    def test_prevent_project_groups_mismatch(self) -> None:
        group = self.create_group()
        project2 = self.create_project()
        group2 = self.create_group(project=project2)
        group_ids = [group.id, group2.id]

        with self.tasks(), pytest.raises(DeleteAborted) as excinfo:
            delete_groups_for_project(
                object_ids=group_ids,
                transaction_id=uuid4().hex,
                project_id=group.project_id,
            )
        assert (
            str(excinfo.value)
            == f"delete_groups.project_id_mismatch: 1 groups don't belong to project {group.project_id}"
        )

    def test_scheduled_tasks_with_too_many_groups(self) -> None:
        NEW_CHUNK_SIZE = 2
        groups = self.create_n_groups_with_hashes(NEW_CHUNK_SIZE + 1, self.project)
        assert len(groups) > NEW_CHUNK_SIZE
        group_ids = [group.id for group in groups]

        with (
            patch("sentry.deletions.tasks.groups.GROUP_CHUNK_SIZE", NEW_CHUNK_SIZE),
            self.tasks(),
            pytest.raises(DeleteAborted) as excinfo,
        ):
            delete_groups_for_project(
                object_ids=group_ids, transaction_id=uuid4().hex, project_id=self.project.id
            )
        assert (
            str(excinfo.value)
            == f"delete_groups.object_ids_too_large: {len(group_ids)} groups is greater than GROUP_CHUNK_SIZE"
        )


class DiscardGroupTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.tombstone = GroupTombstone.objects.create(
            previous_group_id=self.group.id, project_id=self.project.id
        )
        self.group_hash = GroupHash.objects.create(
            project=self.project, hash="a" * 32, group=self.group
        )

    def run_task(self) -> None:
        discard_group(
            group_id=self.group.id,
            project_id=self.project.id,
            tombstone_id=self.tombstone.id,
            transaction_id=uuid4().hex,
        )

    def test_moves_hashes_before_marking_group_pending_deletion(self) -> None:
        with patch("sentry.deletions.tasks.groups.delete_groups_for_project") as delete_task:
            self.run_task()

        self.group_hash.refresh_from_db()
        assert self.group_hash.group_id is None
        assert self.group_hash.group_tombstone_id == self.tombstone.id
        assert Group.objects.get(id=self.group.id).status == GroupStatus.PENDING_DELETION
        delete_task.apply_async.assert_called_once()
        assert delete_task.apply_async.call_args.kwargs["kwargs"]["object_ids"] == [self.group.id]

    def test_does_not_schedule_deletion_again_for_pending_group(self) -> None:
        self.group.update(status=GroupStatus.PENDING_DELETION)

        with patch("sentry.deletions.tasks.groups.delete_groups_for_project") as delete_task:
            self.run_task()

        self.group_hash.refresh_from_db()
        assert self.group_hash.group_tombstone_id == self.tombstone.id
        delete_task.apply_async.assert_not_called()

    def test_retry_schedules_deletion_when_earlier_run_failed_to(self) -> None:
        with (
            patch("sentry.deletions.tasks.groups.delete_groups_for_project") as delete_task,
            pytest.raises(RuntimeError),
        ):
            delete_task.apply_async.side_effect = RuntimeError
            self.run_task()

        assert Group.objects.get(id=self.group.id).status == GroupStatus.UNRESOLVED

        with patch("sentry.deletions.tasks.groups.delete_groups_for_project") as delete_task:
            self.run_task()

        delete_task.apply_async.assert_called_once()
        assert Group.objects.get(id=self.group.id).status == GroupStatus.PENDING_DELETION

    def test_stops_without_deleting_when_tombstone_was_removed(self) -> None:
        self.tombstone.delete()

        with patch("sentry.deletions.tasks.groups.delete_groups_for_project") as delete_task:
            self.run_task()

        self.group_hash.refresh_from_db()
        assert self.group_hash.group_id == self.group.id
        assert self.group_hash.group_tombstone_id is None
        assert Group.objects.get(id=self.group.id).status == GroupStatus.UNRESOLVED
        delete_task.apply_async.assert_not_called()

    def test_deletes_group_without_hashes_when_tombstone_was_removed(self) -> None:
        self.group_hash.update(group=None, group_tombstone_id=None)
        self.tombstone.delete()

        with patch("sentry.deletions.tasks.groups.delete_groups_for_project") as delete_task:
            self.run_task()

        delete_task.apply_async.assert_called_once()
        assert Group.objects.get(id=self.group.id).status == GroupStatus.PENDING_DELETION

    def test_records_metric_when_retries_are_exhausted(self) -> None:
        with (
            patch(
                "sentry.deletions.tasks.groups.delete_groups_for_project.apply_async",
                side_effect=RuntimeError,
            ),
            patch("sentry.deletions.tasks.groups.current_task", return_value=None),
            patch("sentry.deletions.tasks.groups.metrics") as metrics,
            pytest.raises(RuntimeError),
        ):
            self.run_task()

        metrics.incr.assert_called_once_with(
            "deletions.discard_group.retries_exhausted", sample_rate=1.0
        )

    def test_retries_when_another_run_holds_the_lock(self) -> None:
        lock = locks.get(f"discard-group:{self.group.id}", duration=60, name="discard_group")
        with (
            lock.acquire(),
            patch("sentry.deletions.tasks.groups.delete_groups_for_project") as delete_task,
            pytest.raises(UnableToAcquireLock),
        ):
            self.run_task()

        self.group_hash.refresh_from_db()
        assert self.group_hash.group_id == self.group.id
        assert Group.objects.get(id=self.group.id).status == GroupStatus.UNRESOLVED
        delete_task.apply_async.assert_not_called()

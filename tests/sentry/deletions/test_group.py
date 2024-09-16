from time import time
from unittest import mock
from uuid import uuid4

from sentry import nodestore
from sentry.deletions.defaults.group import EventDataDeletionTask
from sentry.deletions.tasks.groups import delete_groups
from sentry.eventstore.models import Event
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupredirect import GroupRedirect
from sentry.models.userreport import UserReport
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class DeleteGroupTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.event_id = "a" * 32
        self.event_id2 = "b" * 32
        self.event_id3 = "c" * 32

        self.project = self.create_project()

        self.event = self.store_event(
            data={
                "event_id": self.event_id,
                "tags": {"foo": "bar"},
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "event_id": self.event_id2,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )

        self.keep_event = self.store_event(
            data={
                "event_id": self.event_id3,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group2"],
            },
            project_id=self.project.id,
        )
        group = self.event.group

        UserReport.objects.create(
            group_id=group.id, project_id=self.event.project_id, name="With group id"
        )
        UserReport.objects.create(
            event_id=self.event.event_id, project_id=self.event.project_id, name="With event id"
        )
        file = File.objects.create(name="hello.png", type="image/png")
        EventAttachment.objects.create(
            event_id=self.event.event_id,
            project_id=self.event.project_id,
            file_id=file.id,
            type=file.type,
            name="hello.png",
        )
        GroupAssignee.objects.create(group=group, project=self.project, user_id=self.user.id)
        GroupHash.objects.create(project=self.project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

        self.node_id = Event.generate_node_id(self.project.id, self.event_id)
        self.node_id2 = Event.generate_node_id(self.project.id, self.event_id2)
        self.node_id3 = Event.generate_node_id(self.project.id, self.event_id3)

    def test_simple(self):
        EventDataDeletionTask.DEFAULT_CHUNK_SIZE = 1  # test chunking logic
        group = self.event.group
        assert nodestore.backend.get(self.node_id)
        assert nodestore.backend.get(self.node_id2)
        assert nodestore.backend.get(self.node_id3)

        with self.tasks():
            delete_groups(object_ids=[group.id])

        assert not UserReport.objects.filter(group_id=group.id).exists()
        assert not UserReport.objects.filter(event_id=self.event.event_id).exists()
        assert not EventAttachment.objects.filter(event_id=self.event.event_id).exists()

        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()
        assert not nodestore.backend.get(self.node_id)
        assert not nodestore.backend.get(self.node_id2)
        assert nodestore.backend.get(self.node_id3), "Does not remove from second group"
        assert Group.objects.filter(id=self.keep_event.group_id).exists()

    def test_simple_multiple_groups(self):
        other_event = self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )
        other_node_id = Event.generate_node_id(self.project.id, other_event.event_id)
        keep_node_id = Event.generate_node_id(self.project.id, self.keep_event.event_id)

        group = self.event.group
        with self.tasks():
            delete_groups(object_ids=[group.id, other_event.group_id])

        assert not Group.objects.filter(id=group.id).exists()
        assert not Group.objects.filter(id=other_event.group_id).exists()
        assert not nodestore.backend.get(self.node_id)
        assert not nodestore.backend.get(other_node_id)

        assert Group.objects.filter(id=self.keep_event.group_id).exists()
        assert nodestore.backend.get(keep_node_id)

    def test_grouphistory_relation(self):
        other_event = self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )
        other_group = other_event.group
        group = self.event.group
        history_one = self.create_group_history(group=group, status=GroupHistoryStatus.ONGOING)
        history_two = self.create_group_history(
            group=group,
            status=GroupHistoryStatus.RESOLVED,
            prev_history=history_one,
        )
        other_history_one = self.create_group_history(
            group=other_group, status=GroupHistoryStatus.ONGOING
        )
        other_history_two = self.create_group_history(
            group=other_group,
            status=GroupHistoryStatus.RESOLVED,
            prev_history=other_history_one,
        )
        with self.tasks():
            delete_groups(object_ids=[group.id, other_group.id])

        assert GroupHistory.objects.filter(id=history_one.id).exists() is False
        assert GroupHistory.objects.filter(id=history_two.id).exists() is False
        assert GroupHistory.objects.filter(id=other_history_one.id).exists() is False
        assert GroupHistory.objects.filter(id=other_history_two.id).exists() is False

    @mock.patch("os.environ.get")
    @mock.patch("sentry.nodestore.delete_multi")
    def test_cleanup(self, nodestore_delete_multi, os_environ):
        os_environ.side_effect = lambda key: "1" if key == "_SENTRY_CLEANUP" else None
        group = self.event.group

        with self.tasks():
            delete_groups(object_ids=[group.id])

        assert nodestore_delete_multi.call_count == 0

    @mock.patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_delete_groups_delete_grouping_records_by_hash(
        self, mock_delete_seer_grouping_records_by_hash_apply_async
    ):
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))
        other_event = self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )
        other_node_id = Event.generate_node_id(self.project.id, other_event.event_id)
        keep_node_id = Event.generate_node_id(self.project.id, self.keep_event.event_id)

        hashes = [
            grouphash.hash
            for grouphash in GroupHash.objects.filter(
                project_id=self.project.id, group_id__in=[self.event.group.id, other_event.group_id]
            )
        ]
        group = self.event.group
        with self.tasks():
            delete_groups(object_ids=[group.id, other_event.group_id])

        assert not Group.objects.filter(id=group.id).exists()
        assert not Group.objects.filter(id=other_event.group_id).exists()
        assert not nodestore.backend.get(self.node_id)
        assert not nodestore.backend.get(other_node_id)

        assert Group.objects.filter(id=self.keep_event.group_id).exists()
        assert nodestore.backend.get(keep_node_id)

        assert mock_delete_seer_grouping_records_by_hash_apply_async.call_args[1] == {
            "args": [group.project.id, hashes, 0]
        }

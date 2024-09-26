from time import time
from unittest import mock
from uuid import uuid4

from sentry import nodestore
from sentry.deletions.defaults.group import EventDataDeletionTask
from sentry.deletions.tasks.groups import delete_groups
from sentry.eventstore.models import Event
from sentry.issues.grouptype import ReplayDeadClickType
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
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class DeleteGroupTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        one_minute = iso_format(before_now(minutes=1))
        group1_data = {"timestamp": one_minute, "fingerprint": ["group1"]}
        group2_data = {"timestamp": one_minute, "fingerprint": ["group2"]}

        # Group 1 events
        self.event = self.store_event(
            data=group1_data | {"tags": {"foo": "bar"}}, project_id=self.project.id
        )
        self.event_id = self.event.event_id
        self.node_id = Event.generate_node_id(self.project.id, self.event_id)
        group = self.event.group
        self.event_id2 = self.store_event(data=group1_data, project_id=self.project.id).event_id
        self.node_id2 = Event.generate_node_id(self.project.id, self.event_id2)

        # Group 2 event
        self.keep_event = self.store_event(data=group2_data, project_id=self.project.id)
        self.event_id3 = self.keep_event.event_id
        self.node_id3 = Event.generate_node_id(self.project.id, self.event_id3)

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


class DeleteIssuePlatformTest(TestCase, SnubaTestCase, OccurrenceTestMixin):
    def test_issue_platform(self):
        event = self.store_event(data={}, project_id=self.project.id)
        issue_occurrence, group_info = self.process_occurrence(
            event_id=event.event_id,
            project_id=self.project.id,
            # We are using ReplayDeadClickType as a representative of Issue Platform
            type=ReplayDeadClickType.type_id,
            event_data={
                "fingerprint": ["issue-platform-group"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
        )
        assert group_info is not None
        issue_platform_group = group_info.group
        assert event.group_id != issue_platform_group.id

        with self.tasks():
            delete_groups(object_ids=[issue_platform_group.id])

        # The original event and group still exist
        assert Group.objects.filter(id=event.group_id).exists()
        node_id = Event.generate_node_id(event.project_id, event.event_id)
        assert nodestore.backend.get(node_id)

        # The Issue Platform group and occurrence are deleted
        assert issue_platform_group.issue_type == ReplayDeadClickType
        assert not Group.objects.filter(id=issue_platform_group.id).exists()
        node_id = Event.generate_node_id(issue_occurrence.project_id, issue_occurrence.id)
        assert not nodestore.backend.get(node_id)

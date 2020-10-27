from __future__ import absolute_import

from sentry.utils.compat import mock
from uuid import uuid4

from sentry.models import (
    EventAttachment,
    File,
    Group,
    GroupAssignee,
    GroupHash,
    GroupMeta,
    GroupRedirect,
    Activity,
    UserReport,
)
from sentry import nodestore
from sentry.deletions.defaults.group import EventDataDeletionTask
from sentry.eventstore.models import Event
from sentry.tasks.deletion import delete_groups
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class DeleteGroupTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(DeleteGroupTest, self).setUp()
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

        self.store_event(
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
            file=file,
            type=file.type,
            name="hello.png",
        )
        GroupAssignee.objects.create(group=group, project=self.project, user=self.user)
        GroupHash.objects.create(project=self.project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)
        Activity.objects.create(group=group, project=self.project, type=Activity.SET_RESOLVED)

        self.node_id = Event.generate_node_id(self.project.id, self.event_id)
        self.node_id2 = Event.generate_node_id(self.project.id, self.event_id2)
        self.node_id3 = Event.generate_node_id(self.project.id, self.event_id3)

    def test_simple(self):
        EventDataDeletionTask.DEFAULT_CHUNK_SIZE = 1  # test chunking logic
        group = self.event.group
        assert nodestore.get(self.node_id)
        assert nodestore.get(self.node_id2)
        assert nodestore.get(self.node_id3)

        with self.tasks():
            delete_groups(object_ids=[group.id])

        assert not UserReport.objects.filter(group_id=group.id).exists()
        assert not UserReport.objects.filter(event_id=self.event.event_id).exists()
        assert not EventAttachment.objects.filter(event_id=self.event.event_id).exists()

        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()
        assert not Activity.objects.filter(group_id=group.id).exists()
        assert not nodestore.get(self.node_id)
        assert not nodestore.get(self.node_id2)
        assert nodestore.get(self.node_id3), "Does not remove from second group"

    @mock.patch("os.environ.get")
    @mock.patch("sentry.nodestore.delete_multi")
    def test_cleanup(self, nodestore_delete_multi, os_environ):
        os_environ.side_effect = lambda key: "1" if key == "_SENTRY_CLEANUP" else None
        group = self.event.group

        with self.tasks():
            delete_groups(object_ids=[group.id])

        assert nodestore_delete_multi.call_count == 0

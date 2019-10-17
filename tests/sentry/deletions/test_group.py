from __future__ import absolute_import

from uuid import uuid4

from sentry.models import (
    Event,
    Group,
    GroupAssignee,
    GroupHash,
    GroupMeta,
    GroupRedirect,
    GroupStatus,
    ScheduledDeletion,
    UserReport,
)
from sentry import nodestore
from sentry.deletions.defaults.group import GroupNodeDeletionTask
from sentry.tasks.deletion import run_deletion

from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class DeleteGroupTest(TestCase, SnubaTestCase):
    def test_simple(self):
        GroupNodeDeletionTask.DEFAULT_CHUNK_SIZE = 1  # test chunking logic
        event_id = "a" * 32
        event_id2 = "b" * 32
        project = self.create_project()
        node_id = Event.generate_node_id(project.id, event_id)
        node_id2 = Event.generate_node_id(project.id, event_id2)

        event = self.store_event(
            data={
                "event_id": event_id,
                "tags": {"foo": "bar"},
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        self.store_event(
            data={
                "event_id": event_id2,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        group = event.group
        group.update(status=GroupStatus.PENDING_DELETION)

        project = self.create_project()

        UserReport.objects.create(group_id=group.id, project_id=event.project_id, name="Jane Doe")

        GroupAssignee.objects.create(group=group, project=project, user=self.user)
        GroupHash.objects.create(project=project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

        deletion = ScheduledDeletion.schedule(group, days=0)
        deletion.update(in_progress=True)

        assert nodestore.get(node_id)
        assert nodestore.get(node_id2)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Event.objects.filter(id=event.id).exists()
        assert not UserReport.objects.filter(group_id=group.id).exists()
        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()

        assert not nodestore.get(node_id)
        assert not nodestore.get(node_id2)

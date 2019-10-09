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
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class DeleteGroupTest(TestCase):
    def test_simple(self):
        key = "key"
        value = "value"

        event_id = "a" * 32
        project = self.create_project()
        event = self.store_event(
            data={
                "event_id": event_id,
                "tags": {key: value},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=project.id,
        )
        group = event.group
        group.update(status=GroupStatus.PENDING_DELETION)

        project = self.create_project()
        group = self.create_group(project=project)
        event = self.create_event(group=group)

        UserReport.objects.create(group_id=group.id, project_id=event.project_id, name="Jane Doe")

        GroupAssignee.objects.create(group=group, project=project, user=self.user)
        GroupHash.objects.create(project=project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

        deletion = ScheduledDeletion.schedule(group, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Event.objects.filter(id=event.id).exists()
        assert not UserReport.objects.filter(group_id=group.id).exists()
        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()

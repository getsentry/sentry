from __future__ import absolute_import

from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

from sentry import tagstore
from sentry.models import (
    EventAttachment, File, Group, GroupAssignee, GroupHash, GroupMeta, GroupRedirect,
    ScheduledDeletion, UserReport
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteGroupTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        key = 'key'
        value = 'value'
        event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'tags': {key: value},
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
            },
            project_id=project.id,
        )
        group = event.group

        EventAttachment.objects.create(
            event_id=event.event_id,
            group_id=event.group_id,
            project_id=event.project_id,
            file=File.objects.create(
                name='hello.png',
                type='image/png',
            ),
            name='hello.png',
        )
        UserReport.objects.create(
            group_id=group.id,
            project_id=event.project_id,
            name='Jane Doe',
        )
        GroupAssignee.objects.create(
            group=group,
            project=project,
            user=self.user,
        )
        GroupHash.objects.create(
            project=project,
            group=group,
            hash=uuid4().hex,
        )
        GroupMeta.objects.create(
            group=group,
            key='foo',
            value='bar',
        )
        GroupRedirect.objects.create(
            group_id=group.id,
            previous_group_id=1,
        )

        deletion = ScheduledDeletion.schedule(group, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        with self.assertRaises(Group.DoesNotExist):
            tagstore.get_group_tag_key(project.id, group.id, None, key)

        assert not UserReport.objects.filter(group_id=group.id).exists()
        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()

from __future__ import absolute_import

from uuid import uuid4

from sentry import tagstore
from sentry.tagstore.models import EventTag
from sentry.models import (
    Event, EventAttachment, EventMapping, File, Group, GroupAssignee, GroupHash, GroupMeta, GroupRedirect,
    ScheduledDeletion, UserReport
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteGroupTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        group = self.create_group(
            project=project,
        )
        event = self.create_event(group=group)
        EventMapping.objects.create(
            project_id=project.id,
            event_id='a' * 32,
            group_id=group.id,
        )
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
        key = 'key'
        value = 'value'
        tk = tagstore.create_tag_key(
            project_id=project.id,
            environment_id=self.environment.id,
            key=key
        )
        tv = tagstore.create_tag_value(
            project_id=project.id,
            environment_id=self.environment.id,
            key=key,
            value=value
        )
        tagstore.create_event_tags(
            event_id=event.id,
            group_id=group.id,
            project_id=project.id,
            environment_id=self.environment.id,
            tags=[
                (tk.key, tv.value),
            ],
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

        assert not Event.objects.filter(id=event.id).exists()
        assert not EventAttachment.objects.filter(
            event_id=event.event_id,
            group_id=group.id,
        ).exists()
        assert not EventMapping.objects.filter(
            group_id=group.id,
        ).exists()
        assert not EventTag.objects.filter(event_id=event.id).exists()
        assert not UserReport.objects.filter(group_id=group.id).exists()
        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()

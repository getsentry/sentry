from __future__ import absolute_import

from sentry import tagstore
from sentry.tagstore.models import EventTag
from sentry.models import (
    Event, EventAttachment, EventMapping, File, ScheduledDeletion, UserReport
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteEventTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        group = self.create_group(
            project=project,
        )
        event = self.create_event(group=group)
        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            file=File.objects.create(
                name='hello.png',
                type='image/png',
            ),
            name='hello.png',
        )
        UserReport.objects.create(
            event_id=event.event_id,
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

        deletion = ScheduledDeletion.schedule(event, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Event.objects.filter(id=event.id).exists()
        assert not EventAttachment.objects.filter(
            event_id=event.event_id,
            project_id=project.id,
        ).exists()
        assert not EventMapping.objects.filter(
            event_id=event.event_id,
            project_id=project.id,
        ).exists()
        assert not UserReport.objects.filter(
            event_id=event.event_id,
            project_id=project.id,
        ).exists()
        assert not EventTag.objects.filter(event_id=event.id).exists()

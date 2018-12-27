from __future__ import absolute_import

import six

from datetime import datetime

from sentry.models import EventAttachment, File
from sentry.testutils import APITestCase


class EventAttachmentsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        release = self.create_release(project, self.user)

        group = self.create_group(project=project, first_release=release)

        event1 = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2016, 8, 13, 3, 8, 25),
            tags={'sentry:release': release.version}
        )
        event2 = self.create_event(
            event_id='b',
            group=group,
            datetime=datetime(2016, 8, 13, 3, 8, 25),
            tags={'sentry:release': release.version}
        )

        attachment1 = EventAttachment.objects.create(
            event_id=event1.event_id,
            group_id=event1.group_id,
            project_id=event1.project_id,
            file=File.objects.create(
                name='hello.png',
                type='image/png',
            ),
            name='hello.png',
        )

        EventAttachment.objects.create(
            event_id=event2.event_id,
            group_id=event2.group_id,
            project_id=event2.project_id,
            file=File.objects.create(
                name='hello.png',
                type='image/png',
            ),
            name='hello.png',
        )

        path = u'/api/0/projects/{}/{}/events/{}/attachments/'.format(
            event1.project.organization.slug,
            event1.project.slug,
            event1.id,
        )

        with self.feature('organizations:event-attachments'):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(attachment1.id)

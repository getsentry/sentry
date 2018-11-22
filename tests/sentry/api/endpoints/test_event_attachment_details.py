from __future__ import absolute_import

import six

from datetime import datetime
from six import BytesIO

from sentry.models import EventAttachment, File
from sentry.testutils import APITestCase


class EventAttachmentDetailsTest(APITestCase):
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

        path = u'/api/0/projects/{}/{}/events/{}/attachments/{}/'.format(
            event1.project.organization.slug,
            event1.project.slug,
            event1.id,
            attachment1.id,
        )

        with self.feature('organizations:event-attachments'):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(attachment1.id)

    def test_download(self):
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

        file1 = File.objects.create(
            name='hello.png',
            type='image/png',
        )
        file1.putfile(BytesIO('File contents here'))

        attachment1 = EventAttachment.objects.create(
            event_id=event1.event_id,
            group_id=event1.group_id,
            project_id=event1.project_id,
            file=file1,
            name='hello.png',
        )

        path = u'/api/0/projects/{}/{}/events/{}/attachments/{}/?download'.format(
            event1.project.organization.slug,
            event1.project.slug,
            event1.id,
            attachment1.id,
        )

        with self.feature('organizations:event-attachments'):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.get('Content-Disposition') == 'attachment; filename="hello.png"'
        assert response.get('Content-Length') == six.text_type(file1.size)
        assert response.get('Content-Type') == 'application/octet-stream'
        assert 'File contents here' == BytesIO(b"".join(response.streaming_content)).getvalue()

from __future__ import absolute_import

import six

from sentry.models import EventAttachment, File
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class EventAttachmentsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        min_ago = iso_format(before_now(minutes=1))
        event1 = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )
        event2 = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )

        attachment1 = EventAttachment.objects.create(
            event_id=event1.event_id,
            project_id=event1.project_id,
            file=File.objects.create(name="hello.png", type="image/png"),
            name="hello.png",
        )
        file = File.objects.create(name="hello.png", type="image/png")
        EventAttachment.objects.create(
            event_id=event2.event_id,
            project_id=event2.project_id,
            file=file,
            type=file.type,
            name="hello.png",
        )

        path = u"/api/0/projects/{}/{}/events/{}/attachments/".format(
            event1.project.organization.slug, event1.project.slug, event1.event_id
        )

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(attachment1.id)

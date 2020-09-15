from __future__ import absolute_import

import six
from six.moves.urllib.parse import urlencode

from sentry.models import EventAttachment, File
from sentry.testutils import APITestCase


class GroupEventAttachmentsTest(APITestCase):
    def create_attachment(self, type=None):
        if type is None:
            type = "event.attachment"

        self.file = File.objects.create(name="hello.png", type=type)
        self.file.putfile(six.BytesIO(b"File contents here"))

        self.attachment = EventAttachment.objects.create(
            event_id=self.event.event_id,
            project_id=self.event.project_id,
            group_id=self.group.id,
            file=self.file,
            type=self.file.type,
            name="hello.png",
        )

        return self.attachment

    def path(self, types=None):
        path = u"/api/0/issues/%s/attachments/" % (self.group.id,)

        query = [("types", t) for t in types or ()]
        if query:
            path += "?" + urlencode(query)

        return path

    def test_basic(self):
        self.login_as(user=self.user)

        attachment = self.create_attachment()

        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.path())

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(attachment.id)

    def test_filter(self):
        self.login_as(user=self.user)

        self.create_attachment(type="event.attachment")
        attachment2 = self.create_attachment(type="event.minidump")

        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.path(types=["event.minidump"]))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(attachment2.id)

    def test_without_feature(self):
        self.login_as(user=self.user)
        self.create_attachment()

        with self.feature({"organizations:event-attachments": False}):
            response = self.client.get(self.path())

        assert response.status_code == 404, response.content

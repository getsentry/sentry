from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from six import BytesIO

from sentry.models import EventAttachment, File
from sentry.testutils import APITestCase, PermissionTestCase


class CreateAttachmentMixin(object):
    def create_attachment(self):
        self.project = self.create_project()
        self.release = self.create_release(self.project, self.user)
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": min_ago,
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )

        self.file = File.objects.create(name="hello.png", type="image/png")
        self.file.putfile(BytesIO("File contents here"))

        self.attachment = EventAttachment.objects.create(
            event_id=self.event.event_id,
            project_id=self.event.project_id,
            file=self.file,
            name="hello.png",
        )

        return self.attachment


class EventAttachmentDetailsTest(APITestCase, CreateAttachmentMixin):
    def test_simple(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = u"/api/0/projects/{}/{}/events/{}/attachments/{}/".format(
            self.organization.slug, self.project.slug, self.event.event_id, self.attachment.id
        )

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(self.attachment.id)

    def test_download(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = u"/api/0/projects/{}/{}/events/{}/attachments/{}/?download".format(
            self.organization.slug, self.project.slug, self.event.event_id, self.attachment.id
        )

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="hello.png"'
        assert response.get("Content-Length") == six.text_type(self.file.size)
        assert response.get("Content-Type") == "application/octet-stream"
        assert "File contents here" == BytesIO(b"".join(response.streaming_content)).getvalue()


class EventAttachmentDetailsPermissionTest(PermissionTestCase, CreateAttachmentMixin):
    def setUp(self):
        super(EventAttachmentDetailsPermissionTest, self).setUp()
        self.create_attachment()
        self.path = u"/api/0/projects/{}/{}/events/{}/attachments/{}/?download".format(
            self.organization.slug, self.project.slug, self.event.event_id, self.attachment.id
        )

    def test_member_can_access_by_default(self):
        with self.feature("organizations:event-attachments"):
            self.assert_member_can_access(self.path)
            self.assert_can_access(self.owner, self.path)

    def test_member_cannot_access_for_owner_role(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        with self.feature("organizations:event-attachments"):
            self.assert_member_cannot_access(self.path)
            self.assert_can_access(self.owner, self.path)

    def test_random_user_cannot_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        user = self.create_user()

        with self.feature("organizations:event-attachments"):
            self.assert_cannot_access(user, self.path)

    def test_superuser_can_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        superuser = self.create_user(is_superuser=True)

        with self.feature("organizations:event-attachments"):
            self.assert_can_access(superuser, self.path)

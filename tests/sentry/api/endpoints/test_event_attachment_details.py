from io import BytesIO

from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase, PermissionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class CreateAttachmentMixin:
    def create_attachment(self):
        self.project = self.create_project()
        self.release = self.create_release(self.project, self.user)
        min_ago = iso_format(before_now(minutes=1))
        self.event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": min_ago,
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )

        self.file = File.objects.create(name="hello.png", type="image/png; foo=bar")
        self.file.putfile(BytesIO(b"File contents here"))

        self.attachment = EventAttachment.objects.create(
            event_id=self.event.event_id,
            project_id=self.event.project_id,
            file_id=self.file.id,
            type=self.file.type,
            name="hello.png",
        )

        return self.attachment


@region_silo_test
class EventAttachmentDetailsTest(APITestCase, CreateAttachmentMixin):
    def test_simple(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.attachment.id)
        assert response.data["mimetype"] == "image/png"
        assert response.data["event_id"] == self.event.event_id

    def test_download(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/?download"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="hello.png"'
        assert response.get("Content-Length") == str(self.file.size)
        assert response.get("Content-Type") == "application/octet-stream"
        assert b"File contents here" == close_streaming_response(response)

    def test_delete(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"

        with self.feature("organizations:event-attachments"):
            response = self.client.delete(path)

        assert response.status_code == 204, response.content
        assert EventAttachment.objects.count() == 0


@region_silo_test
class EventAttachmentDetailsPermissionTest(PermissionTestCase, CreateAttachmentMixin):
    def setUp(self):
        super().setUp()
        self.create_attachment()
        self.path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/?download"

    def test_member_can_access_by_default(self):
        with self.feature("organizations:event-attachments"):
            close_streaming_response(self.assert_member_can_access(self.path))
            close_streaming_response(self.assert_can_access(self.owner, self.path))

    def test_member_cannot_access_for_owner_role(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        with self.feature("organizations:event-attachments"):
            self.assert_member_cannot_access(self.path)
            close_streaming_response(self.assert_can_access(self.owner, self.path))

    def test_member_on_owner_team_can_access_for_owner_role(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        owner_team = self.create_team(organization=self.organization, org_role="owner")
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, teams=[owner_team, self.team])
        with self.feature("organizations:event-attachments"):
            close_streaming_response(self.assert_can_access(user, self.path))

    def test_random_user_cannot_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        user = self.create_user()

        with self.feature("organizations:event-attachments"):
            self.assert_cannot_access(user, self.path)

    def test_superuser_can_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        superuser = self.create_user(is_superuser=True)

        with self.feature("organizations:event-attachments"):
            close_streaming_response(self.assert_can_access(superuser, self.path))

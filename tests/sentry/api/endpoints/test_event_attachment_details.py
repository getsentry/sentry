from sentry.attachments.base import CachedAttachment
from sentry.models.eventattachment import EventAttachment
from sentry.testutils.cases import APITestCase, PermissionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

ATTACHMENT_CONTENT = b"File contents here" * 10_000


class CreateAttachmentMixin:
    def create_attachment(self, content: bytes | None = None):
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

        data = content if content is not None else ATTACHMENT_CONTENT
        attachment = CachedAttachment(
            name="hello.png", content_type="image/png; foo=bar", data=data
        )
        file = EventAttachment.putfile(
            self.project.id,
            attachment,
        )

        self.attachment = EventAttachment.objects.create(
            event_id=self.event.event_id,
            project_id=self.event.project_id,
            type=attachment.type,
            name=attachment.name,
            content_type=file.content_type,
            size=file.size,
            sha1=file.sha1,
            # storage:
            file_id=file.file_id,
            blob_path=file.blob_path,
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
        path1 = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/?download"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path1)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="hello.png"'
        assert response.get("Content-Length") == str(self.attachment.size)
        assert response.get("Content-Type") == "image/png"
        assert close_streaming_response(response) == ATTACHMENT_CONTENT

        with self.options(
            {
                "eventattachments.store-blobs.sample-rate": 1,
            }
        ):
            self.create_attachment()

        path2 = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/?download"
        assert path1 is not path2

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path2)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="hello.png"'
        assert response.get("Content-Length") == str(self.attachment.size)
        assert response.get("Content-Type") == "image/png"
        assert close_streaming_response(response) == ATTACHMENT_CONTENT

    def test_zero_sized_attachment(self):
        self.login_as(user=self.user)

        self.create_attachment(b"")

        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.attachment.id)
        assert response.data["event_id"] == self.event.event_id
        assert response.data["size"] == 0
        assert response.data["sha1"] == "da39a3ee5e6b4b0d3255bfef95601890afd80709"

        path = f"{path}?download"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="hello.png"'
        assert response.get("Content-Length") == "0"
        assert response.get("Content-Type") == "image/png"
        assert close_streaming_response(response) == b""

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

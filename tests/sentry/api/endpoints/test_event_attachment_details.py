import pytest
from django.test import override_settings

from sentry.attachments.base import CachedAttachment
from sentry.models.activity import Activity
from sentry.models.eventattachment import EventAttachment
from sentry.testutils.cases import APITestCase, PermissionTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]

ATTACHMENT_CONTENT = b"File contents here" * 10_000


class CreateAttachmentMixin(TestCase):
    def create_attachment(self, content: bytes | None = None, group_id: int | None = None):
        self.project = self.create_project()
        self.release = self.create_release(self.project, self.user)
        min_ago = before_now(minutes=1).isoformat()
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
            group_id=group_id,
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


class EventAttachmentDetailsTest(APITestCase, CreateAttachmentMixin):
    @with_feature("organizations:event-attachments")
    def test_simple(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.attachment.id)
        assert response.data["mimetype"] == "image/png"
        assert response.data["event_id"] == self.event.event_id

    @with_feature("organizations:event-attachments")
    def test_download(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path1 = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/?download"

        response = self.client.get(path1)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="hello.png"'
        assert response.get("Content-Length") == str(self.attachment.size)
        assert response.get("Content-Type") == "image/png"
        assert close_streaming_response(response) == ATTACHMENT_CONTENT

    @with_feature("organizations:event-attachments")
    def test_zero_sized_attachment(self):
        self.login_as(user=self.user)

        self.create_attachment(b"")

        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.attachment.id)
        assert response.data["event_id"] == self.event.event_id
        assert response.data["size"] == 0
        assert response.data["sha1"] == "da39a3ee5e6b4b0d3255bfef95601890afd80709"

        path = f"{path}?download"

        response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="hello.png"'
        assert response.get("Content-Length") == "0"
        assert response.get("Content-Type") == "image/png"
        assert close_streaming_response(response) == b""

    @with_feature("organizations:event-attachments")
    def test_delete(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"

        response = self.client.delete(path)

        assert response.status_code == 204, response.content
        assert EventAttachment.objects.count() == 0

    @with_feature("organizations:event-attachments")
    def test_delete_activity_no_group(self):
        self.login_as(user=self.user)

        self.create_attachment(group_id=None)
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"
        response = self.client.delete(path)
        assert response.status_code == 204

        # an activity with no group cannot be associated with an issue or displayed in an issue details page
        with pytest.raises(Activity.DoesNotExist):
            Activity.objects.get(type=ActivityType.DELETED_ATTACHMENT.value)

    @with_feature("organizations:event-attachments")
    def test_delete_activity_with_group(self):
        self.login_as(user=self.user)

        group_id = self.create_group().id
        self.create_attachment(group_id=group_id)
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"
        response = self.client.delete(path)
        assert response.status_code == 204

        delete_activity = Activity.objects.get(type=ActivityType.DELETED_ATTACHMENT.value)
        assert delete_activity.project == self.project
        assert delete_activity.group_id == group_id
        assert delete_activity.group is not None
        assert delete_activity.group.id == group_id


class EventAttachmentDetailsPermissionTest(PermissionTestCase, CreateAttachmentMixin):
    def setUp(self):
        super().setUp()
        self.create_attachment()
        self.path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/?download"

    @with_feature("organizations:event-attachments")
    def test_member_can_access_by_default(self):
        close_streaming_response(self.assert_member_can_access(self.path))
        close_streaming_response(self.assert_can_access(self.owner, self.path))

    @with_feature("organizations:event-attachments")
    def test_member_cannot_access_for_owner_role(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        self.assert_member_cannot_access(self.path)
        close_streaming_response(self.assert_can_access(self.owner, self.path))

    @with_feature("organizations:event-attachments")
    def test_random_user_cannot_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        user = self.create_user()

        self.assert_cannot_access(user, self.path)

    @with_feature("organizations:event-attachments")
    def test_superuser_can_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        superuser = self.create_user(is_superuser=True)

        close_streaming_response(self.assert_can_access(superuser, self.path))

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.assert_can_access(superuser, self.path)
            self.assert_can_access(superuser, self.path, method="DELETE")

    @with_feature("organizations:event-attachments")
    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_read_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        superuser = self.create_user(is_superuser=True)

        close_streaming_response(self.assert_can_access(superuser, self.path))

        self.assert_cannot_access(superuser, self.path, method="DELETE")

    @with_feature("organizations:event-attachments")
    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_write_can_access(self):
        self.organization.update_option("sentry:attachments_role", "owner")
        superuser = self.create_user(is_superuser=True)

        self.add_user_permission(superuser, "superuser.write")

        close_streaming_response(self.assert_can_access(superuser, self.path))

        self.assert_can_access(superuser, self.path, method="DELETE")

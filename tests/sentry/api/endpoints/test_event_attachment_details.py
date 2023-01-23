import zipfile
from io import BytesIO

from sentry.models import EventAttachment, File, create_files_from_dif_zip
from sentry.testutils import APITestCase, PermissionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

PROGUARD_UUID = "467ade76-6d0b-11ed-a1eb-0242ac120002"
PROGUARD_SOURCE = b"""\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
    65:65:void <init>() -> <init>
    67:67:java.lang.Class[] getClassContext() -> a
    69:69:java.lang.Class[] getExtraClassContext() -> a
    65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
"""


class CreateAttachmentMixin:
    def create_attachment(
        self,
        name="hello.png",
        file_type="image/png",
        attachment_type=None,
        contents=b"File contents here",
        event_data=None,
    ):
        self.project = self.create_project()
        self.release = self.create_release(self.project, self.user)
        min_ago = iso_format(before_now(minutes=1))
        event_data = event_data or {}
        self.event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": min_ago,
                "tags": {"sentry:release": self.release.version},
                **event_data,
            },
            project_id=self.project.id,
        )

        self.file = File.objects.create(name=name, type=f"{file_type}; foo=bar")
        self.file.putfile(BytesIO(contents))

        self.attachment = EventAttachment.objects.create(
            event_id=self.event.event_id,
            project_id=self.event.project_id,
            file_id=self.file.id,
            type=attachment_type or self.file.type,
            name=name,
        )
        assert self.attachment.mimetype == file_type

        return self.attachment


@region_silo_test(stable=True)
class EventAttachmentDetailsTest(APITestCase, CreateAttachmentMixin):
    def test_simple(self):
        self.login_as(user=self.user)

        self.create_attachment()
        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.attachment.id)
        assert response.data["mimetype"] == self.attachment.mimetype
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
        assert b"File contents here" == b"".join(response.streaming_content)

    def test_download_view_hierarchy_with_proguard_file(self):
        def create_proguard():
            with zipfile.ZipFile(BytesIO(), "w") as f:
                f.writestr(f"proguard/{PROGUARD_UUID}.txt", PROGUARD_SOURCE)
                create_files_from_dif_zip(f, project=self.project)

        self.login_as(user=self.user)

        obfuscated_view_hierarchy = {
            "rendering_system": "Test System",
            "windows": [
                {
                    "identifier": "parent",
                    "type": "org.a.b.g$a",
                    "children": [
                        {
                            "identifier": "child",
                            "type": "org.a.b.g$a",
                        }
                    ],
                }
            ],
        }

        self.create_attachment(
            name="view_hierarchy.json",
            file_type="application/json",
            attachment_type="event.view_hierarchy",
            contents=(json.dumps(obfuscated_view_hierarchy).encode("utf-8")),
            event_data={
                "debug_meta": {"images": [{"uuid": PROGUARD_UUID, "type": "proguard"}]},
            },
        )
        create_proguard()

        path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/events/{self.event.event_id}/attachments/{self.attachment.id}/?download"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="view_hierarchy.json"'
        assert response.get("Content-Length") == str(self.file.size)
        assert response.get("Content-Type") == "application/octet-stream"
        assert (
            b"".join(response.streaming_content)
            == b'{"rendering_system":"Test System","windows":[{"identifier":"parent","type":"org.slf4j.helpers.Util$ClassContextSecurityManager","children":[{"identifier":"child","type":"org.slf4j.helpers.Util$ClassContextSecurityManager"}]}]}'
        )

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

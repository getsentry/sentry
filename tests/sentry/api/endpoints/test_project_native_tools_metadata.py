from unittest.mock import patch

from sentry.models.eventattachment import EventAttachment
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

SYSTEM_INFO = {
    "os_name": "Windows NT",
    "os_version": "10.0.19041",
    "cpu_arch": "x86_64",
}


class ProjectNativeToolsMetadataTest(APITestCase):
    endpoint = "sentry-api-0-project-native-tools-metadata"

    def setUp(self) -> None:
        super().setUp()
        self.superuser = self.create_user(is_superuser=True)
        self.login_as(user=self.superuser, superuser=True)
        self.event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=self.project.id
        )

    def path(self, event_id: str) -> str:
        return f"/api/0/projects/{self.organization.slug}/{self.project.slug}/native-tools/{event_id}/metadata/"

    def create_minidump(self, blob_path: str = "v2/some-stored-id") -> EventAttachment:
        return EventAttachment.objects.create(
            project_id=self.project.id,
            event_id=self.event.event_id,
            type="event.minidump",
            name="upload_file_minidump",
            size=1234,
            blob_path=blob_path,
        )

    @patch("sentry.api.endpoints.project_native_tools_metadata.Symbolicator")
    def test_simple(self, mock_symbolicator: object) -> None:
        self.create_minidump()
        mock_symbolicator.return_value.get_minidump_metadata.return_value = SYSTEM_INFO

        with self.feature("organizations:native-tools"):
            response = self.client.get(self.path(self.event.event_id))

        assert response.status_code == 200, response.content
        assert response.data == SYSTEM_INFO
        mock_symbolicator.return_value.get_minidump_metadata.assert_called_once_with(
            "some-stored-id"
        )

    def test_requires_superuser(self) -> None:
        """An ordinary org member must not be able to reach this endpoint."""
        self.create_minidump()
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(user=member)

        with self.feature("organizations:native-tools"):
            response = self.client.get(self.path(self.event.event_id))

        assert response.status_code == 403, response.content

    def test_owner_without_superuser_is_denied(self) -> None:
        """Even the org owner must not be able to reach this endpoint."""
        self.create_minidump()
        self.login_as(user=self.user)

        with self.feature("organizations:native-tools"):
            response = self.client.get(self.path(self.event.event_id))

        assert response.status_code == 403, response.content

    def test_feature_disabled(self) -> None:
        self.create_minidump()

        response = self.client.get(self.path(self.event.event_id))

        assert response.status_code == 404, response.content

    def test_unknown_event(self) -> None:
        with self.feature("organizations:native-tools"):
            response = self.client.get(self.path("a" * 32))

        assert response.status_code == 404, response.content
        assert response.data["detail"] == "Event not found"

    def test_no_minidump(self) -> None:
        with self.feature("organizations:native-tools"):
            response = self.client.get(self.path(self.event.event_id))

        assert response.status_code == 404, response.content
        assert response.data["detail"] == "Event has no minidump attachment"

    def test_minidump_not_in_objectstore(self) -> None:
        self.create_minidump(blob_path="eventattachments/v1/abc")

        with self.feature("organizations:native-tools"):
            response = self.client.get(self.path(self.event.event_id))

        assert response.status_code == 400, response.content

    @patch("sentry.api.endpoints.project_native_tools_metadata.Symbolicator")
    def test_symbolicator_failure(self, mock_symbolicator: object) -> None:
        self.create_minidump()
        mock_symbolicator.return_value.get_minidump_metadata.return_value = {
            "status": "failed",
            "message": "internal server error",
        }

        with self.feature("organizations:native-tools"):
            response = self.client.get(self.path(self.event.event_id))

        assert response.status_code == 502, response.content

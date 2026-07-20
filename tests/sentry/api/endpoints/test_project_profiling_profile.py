from io import BytesIO
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.urls import reverse
from objectstore_client.errors import RequestError

from sentry.models.profilechunkattachment import ProfileChunkAttachment
from sentry.testutils.cases import APITestCase

PROFILING_FEATURES = {"organizations:profiling": True}


class ProjectProfilingProfileTest(APITestCase):
    endpoint = "sentry-api-0-project-profiling-profile"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self) -> None:
        response = self.get_response(self.project.organization.slug, self.project.id, str(uuid4()))
        assert response.status_code == 404


class ProjectProfilingChunkAttachmentTest(APITestCase):
    endpoint = "sentry-api-0-project-profiling-chunk-attachment"
    features = {
        "organizations:continuous-profiling-perfetto": True,
    }

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.profiler_id = uuid4().hex
        self.chunk_id = uuid4().hex
        self.attachment = ProfileChunkAttachment.objects.create(
            project_id=self.project.id,
            profiler_id=self.profiler_id,
            chunk_id=self.chunk_id,
            name="trace.perfetto",
            content_type="application/x-perfetto",
            stored_id=uuid4().hex,
        )

    def get_url(self, attachment_id=None):
        return reverse(
            self.endpoint,
            args=(
                self.organization.slug,
                self.project.slug,
                self.profiler_id,
                self.chunk_id,
                attachment_id if attachment_id is not None else self.attachment.id,
            ),
        )

    def test_no_feature(self) -> None:
        response = self.client.get(self.get_url())
        assert response.status_code == 404

    def test_unknown_attachment(self) -> None:
        with self.feature(self.features):
            response = self.client.get(self.get_url(attachment_id=1234567))
        assert response.status_code == 404

    def test_returns_metadata_without_download(self) -> None:
        with self.feature(self.features):
            response = self.client.get(self.get_url())
        assert response.status_code == 200
        assert response.data["id"] == str(self.attachment.id)
        assert response.data["name"] == "trace.perfetto"

    @patch("sentry.api.endpoints.project_profiling_profile.get_profile_attachments_session")
    def test_downloads_blob(self, mock_session: MagicMock) -> None:
        blob = MagicMock()
        blob.payload = BytesIO(b"perfetto-bytes")
        blob.metadata.compression = None
        mock_session.return_value.get.return_value = blob

        with self.feature(self.features):
            response = self.client.get(self.get_url(), {"download": "1"})

        assert response.status_code == 200
        assert b"".join(response.streaming_content) == b"perfetto-bytes"
        assert response["Content-Disposition"] == 'attachment; filename="trace.perfetto"'
        mock_session.return_value.get.assert_called_once()

    @patch("sentry.api.endpoints.project_profiling_profile.get_profile_attachments_session")
    def test_download_tolerates_expired_blob(self, mock_session: MagicMock) -> None:
        mock_session.return_value.get.side_effect = RequestError("gone", 404, "")

        with self.feature(self.features):
            response = self.client.get(self.get_url(), {"download": "1"})

        assert response.status_code == 404

    def test_cannot_access_attachment_from_other_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        other_attachment = ProfileChunkAttachment.objects.create(
            project_id=other_project.id,
            profiler_id=self.profiler_id,
            chunk_id=self.chunk_id,
            name="trace.perfetto",
            content_type="application/x-perfetto",
            stored_id=uuid4().hex,
        )

        # Requesting the other project's attachment through this project's URL must 404.
        with self.feature(self.features):
            response = self.client.get(self.get_url(attachment_id=other_attachment.id))
        assert response.status_code == 404

    def test_member_cannot_access_for_higher_attachments_role(self) -> None:
        self.organization.update_option("sentry:attachments_role", "owner")
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(user=member)

        with self.feature(self.features):
            response = self.client.get(self.get_url(), {"download": "1"})
        assert response.status_code == 403

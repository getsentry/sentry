from unittest.mock import MagicMock, call, patch

from django.urls import reverse
from objectstore_client import RequestError

from sentry.objectstore import UsecaseId
from sentry.testutils.cases import APITestCase


class ProjectPreprodArtifactImageTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )
        self.image_id = "test-image-123"
        self.base_path = f"/api/0/{self.org.slug}/{self.project.slug}/files/images/{self.image_id}/"

    def _get_url(self, image_id=None):
        image_id = image_id or self.image_id
        return reverse(
            "sentry-api-0-project-preprod-artifact-image",
            args=[self.org.slug, self.project.slug, image_id],
        )

    def _create_mock_session(self, image_data, content_type):
        """Create a mock object store session that returns the given data and content type."""
        mock_result = MagicMock()
        mock_result.payload.read.return_value = image_data
        mock_result.metadata.content_type = content_type

        mock_session = MagicMock()
        mock_session.get.return_value = mock_result

        return mock_session

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_session")
    def test_explicit_app_icon_type_does_not_require_prefix(self, mock_get_session) -> None:
        image_id = "opaque-icon-id"
        icon_data = b"app icon"
        primary = self._create_mock_session(icon_data, "image/png")
        mock_get_session.return_value = primary

        response = self.client.get(self._get_url(image_id), {"image_type": "preprod_size_app_icon"})

        assert response.status_code == 200
        assert response.content == icon_data
        mock_get_session.assert_called_once_with(UsecaseId.PREPROD_SIZE, self.project)
        primary.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_session")
    def test_rejects_unknown_image_type(self, mock_get_session) -> None:
        response = self.client.get(self._get_url("icn_123456789abc"), {"image_type": "attachments"})

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid image_type"}
        mock_get_session.assert_not_called()

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_session")
    def test_app_icon_reads_preprod_size(self, mock_get_session) -> None:
        image_id = "icn_123456789abc"
        icon_data = b"app icon"
        primary = self._create_mock_session(icon_data, "image/png")
        mock_get_session.return_value = primary

        response = self.client.get(self._get_url(image_id))

        assert response.status_code == 200
        assert response.content == icon_data
        assert response["Content-Type"] == "image/png"
        mock_get_session.assert_called_once_with(UsecaseId.PREPROD_SIZE, self.project)
        primary.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_session")
    def test_app_icon_falls_back_to_preprod(self, mock_get_session) -> None:
        image_id = "icn_123456789abc"
        object_key = f"{self.org.id}/{self.project.id}/{image_id}"
        icon_data = b"legacy app icon"
        primary = MagicMock()
        primary.get.return_value = None
        fallback = self._create_mock_session(icon_data, "image/png")
        mock_get_session.side_effect = [primary, fallback]

        response = self.client.get(self._get_url(image_id))

        assert response.status_code == 200
        assert response.content == icon_data
        assert mock_get_session.call_args_list == [
            call(UsecaseId.PREPROD_SIZE, self.project),
            call(UsecaseId.PREPROD, self.project),
        ]
        primary.get.assert_called_once_with(object_key)
        fallback.get.assert_called_once_with(object_key)

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_session")
    def test_app_icon_missing_from_both_usecases(self, mock_get_session) -> None:
        session = MagicMock()
        session.get.return_value = None
        mock_get_session.return_value = session

        response = self.client.get(self._get_url("icn_123456789abc"))

        assert response.status_code == 404
        assert response.data == {"detail": "Image not found"}
        assert mock_get_session.call_args_list == [
            call(UsecaseId.PREPROD_SIZE, self.project),
            call(UsecaseId.PREPROD, self.project),
        ]

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_session")
    def test_app_icon_storage_error_does_not_fall_back(self, mock_get_session) -> None:
        mock_get_session.return_value.get.side_effect = RequestError("unavailable", 503, "")

        response = self.client.get(self._get_url("icn_123456789abc"))

        assert response.status_code == 500
        mock_get_session.assert_called_once_with(UsecaseId.PREPROD_SIZE, self.project)

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_successful_image_retrieval_png(self, mock_get_session):
        png_data = b"\x89PNG\r\n\x1a\n" + b"fake png content" * 100
        mock_session = self._create_mock_session(png_data, "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == png_data
        assert response["Content-Type"] == "image/png"
        mock_get_session.assert_called_once_with(self.project)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_successful_image_retrieval_jpeg(self, mock_get_session):
        jpeg_data = b"\xff\xd8\xff" + b"fake jpeg content" * 100
        mock_session = self._create_mock_session(jpeg_data, "image/jpeg")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == jpeg_data
        assert response["Content-Type"] == "image/jpeg"
        mock_get_session.assert_called_once_with(self.project)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_successful_image_retrieval_webp(self, mock_get_session):
        webp_data = b"RIFF" + b"1234" + b"WEBP" + b"fake webp content" * 100
        mock_session = self._create_mock_session(webp_data, "image/webp")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == webp_data
        assert response["Content-Type"] == "image/webp"
        mock_get_session.assert_called_once_with(self.project)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_unknown_image_format(self, mock_get_session):
        unknown_data = b"unknown binary data" * 50
        mock_session = self._create_mock_session(unknown_data, "application/octet-stream")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == unknown_data
        assert response["Content-Type"] == "application/octet-stream"
        mock_get_session.assert_called_once_with(self.project)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_content_disposition_with_filename(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url,
            data={"filename": "alert-dark-danger-no-icon.png"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        assert response["Content-Disposition"] == 'inline; filename="alert-dark-danger-no-icon.png"'

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_no_content_disposition_without_filename_param(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert not response.has_header("Content-Disposition")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_content_disposition_strips_path_traversal(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url,
            data={"filename": "static/app/components/core/alert/alert-dark-danger-no-icon.png"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        assert response["Content-Disposition"] == 'inline; filename="alert-dark-danger-no-icon.png"'

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_content_disposition_strips_parent_dir_traversal(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url,
            data={"filename": "../../etc/passwd"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        assert response["Content-Disposition"] == 'inline; filename="passwd"'

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_content_disposition_strips_header_injection(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url,
            data={"filename": "foo.png\r\nSet-Cookie: evil=1"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        cd = response["Content-Disposition"]
        assert "\r" not in cd
        assert "\n" not in cd
        assert not response.has_header("Set-Cookie")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_content_disposition_strips_quotes(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url,
            data={"filename": 'foo".png'},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        assert response["Content-Disposition"] == 'inline; filename="foo.png"'

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_no_content_disposition_when_filename_empties_out(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url,
            data={"filename": "../"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        assert not response.has_header("Content-Disposition")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_content_disposition_non_ascii_filename(self, mock_get_session):
        mock_session = self._create_mock_session(b"\x89PNG\r\n\x1a\n", "image/png")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url,
            data={"filename": "café.png"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        cd = response["Content-Disposition"]
        assert cd.startswith("inline; ")
        assert "filename*=utf-8''caf%C3%A9.png" in cd

    def test_endpoint_requires_project_access(self) -> None:
        other_user = self.create_user()
        self.login_as(user=other_user)
        self.api_token = self.create_user_auth_token(
            user=other_user, scope_list=["org:read", "project:read"]
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 403

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_objectstore_404_returns_404(self, mock_get_session):
        mock_session = MagicMock()
        mock_session.get.return_value = None
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 404
        assert response.json() == {"detail": "Image not found"}

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_snapshot_storage")
    def test_error_handling_returns_json(self, mock_get_session):
        mock_session = MagicMock()
        mock_session.get.side_effect = Exception("Storage error")
        mock_get_session.return_value = mock_session

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 500
        assert response["Content-Type"] == "application/json"
        assert response.json() == {"detail": "Internal server error"}

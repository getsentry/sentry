from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class ProjectPreprodArtifactImageTest(APITestCase):
    def setUp(self):
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

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_preprod_session")
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
        mock_get_session.assert_called_once_with(self.org.id, self.project.id)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_preprod_session")
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
        mock_get_session.assert_called_once_with(self.org.id, self.project.id)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_preprod_session")
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
        mock_get_session.assert_called_once_with(self.org.id, self.project.id)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    @patch("sentry.preprod.api.endpoints.project_preprod_artifact_image.get_preprod_session")
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
        mock_get_session.assert_called_once_with(self.org.id, self.project.id)
        mock_session.get.assert_called_once_with(f"{self.org.id}/{self.project.id}/{self.image_id}")

    def test_endpoint_requires_project_access(self):
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

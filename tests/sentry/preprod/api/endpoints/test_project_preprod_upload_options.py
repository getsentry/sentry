from unittest.mock import MagicMock, patch

from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient

from sentry.testutils.cases import APITestCase


class ProjectPreprodUploadOptionsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            "sentry-api-0-project-preprod-snapshots-upload-options",
            args=[self.org.slug, self.project.slug],
        )

    @patch("sentry.preprod.api.endpoints.project_preprod_upload_options.get_preprod_session")
    def test_returns_upload_options(self, mock_get_session) -> None:
        mock_session = MagicMock()
        mock_session.mint_token.return_value = "fake-token"
        mock_get_session.return_value = mock_session

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        data = response.data["objectstore"]

        assert data["url"].endswith(f"/api/0/organizations/{self.org.id}/objectstore")

        assert data["scopes"] == [("org", str(self.org.id)), ("project", str(self.project.id))]

        assert data["authToken"] == "fake-token"

        assert data["expirationPolicy"] == "ttl:30 days"

        mock_get_session.assert_called_once_with(org=self.org.id, project=self.project.id)

    @patch("sentry.preprod.api.endpoints.project_preprod_upload_options.get_preprod_session")
    def test_objectstore_url_uses_region_endpoint(self, mock_get_session) -> None:
        mock_session = MagicMock()
        mock_session.mint_token.return_value = "fake-token"
        mock_get_session.return_value = mock_session

        with (
            self.feature("organizations:preprod-snapshots"),
            self.options({"system.region-api-url-template": "https://{region}.testserver"}),
        ):
            response = self.client.get(self.url)

        assert response.status_code == 200
        url = response.data["objectstore"]["url"]
        region = settings.SENTRY_LOCAL_CELL
        assert url.startswith(f"https://{region}.testserver/")
        assert url.endswith(f"/api/0/organizations/{self.org.id}/objectstore")

    def test_without_feature_flag(self) -> None:
        response = self.client.get(self.url)

        assert response.status_code == 403
        assert response.data["detail"] == "Feature not enabled"

    def test_requires_authentication(self) -> None:
        unauthenticated_client = APIClient()

        with self.feature("organizations:preprod-snapshots"):
            response = unauthenticated_client.get(self.url)

        assert response.status_code == 401

    def test_requires_project_access(self) -> None:
        other_user = self.create_user()
        self.login_as(user=other_user)

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self.url)

        assert response.status_code == 403

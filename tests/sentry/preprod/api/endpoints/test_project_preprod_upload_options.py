from unittest.mock import MagicMock, patch

import jwt
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from sentry.objectstore import UsecaseId
from sentry.testutils.cases import APITestCase
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ProjectPreprodUploadOptionsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.url = reverse(
            "sentry-api-0-project-preprod-snapshots-upload-options",
            args=[self.org.slug, self.project.slug],
        )

    @patch("sentry.preprod.api.endpoints.project_preprod_upload_options.get_session")
    def test_returns_upload_options(self, mock_get_session: MagicMock) -> None:
        mock_session = MagicMock()
        mock_session.mint_token.return_value = "fake-token"
        mock_get_session.return_value = mock_session

        response = self.client.get(self.url)

        assert response.status_code == 200
        data = response.data["objectstore"]

        assert data["url"].endswith(f"/api/0/organizations/{self.org.id}/objectstore")

        assert data["scopes"] == [("org", str(self.org.id)), ("project", str(self.project.id))]

        assert data["authToken"] == "fake-token"

        assert data["expirationPolicy"] == "tti:30d"

        assert data["usecase"] == "preprod"

        mock_get_session.assert_called_once_with(UsecaseId.PREPROD, self.project)

    @patch("sentry.objectstore._CLIENT", None)
    def test_token_grants_read_and_write_only(self) -> None:
        unrestricted_generator = {
            k: v
            for k, v in settings.SENTRY_OBJECTSTORE_CONFIG["token_generator"].items()
            if k != "permissions"
        }
        with override_settings(
            SENTRY_OBJECTSTORE_CONFIG={
                **settings.SENTRY_OBJECTSTORE_CONFIG,
                "token_generator": unrestricted_generator,
            }
        ):
            response = self.client.get(self.url)

        assert response.status_code == 200
        claims = jwt.decode(
            response.data["objectstore"]["authToken"], options={"verify_signature": False}
        )
        assert claims["permissions"] == ["object.read", "object.write"]

    @patch("sentry.preprod.api.endpoints.project_preprod_upload_options.get_session")
    def test_auto_returns_preprod_snapshots(self, mock_get_session: MagicMock) -> None:
        mock_session = MagicMock()
        mock_session.mint_token.return_value = "fake-token"
        mock_get_session.return_value = mock_session

        response = self.client.get(self.url, {"usecase": "auto"})

        assert response.status_code == 200
        assert response.data["objectstore"]["usecase"] == "preprod_snapshots"
        mock_get_session.assert_called_once_with(UsecaseId.PREPROD_SNAPSHOTS, self.project)

    def test_rejects_explicit_usecase(self) -> None:
        response = self.client.get(self.url, {"usecase": "preprod_snapshots"})

        assert response.status_code == 400

    @patch("sentry.preprod.api.endpoints.project_preprod_upload_options.get_session")
    def test_objectstore_url_uses_region_endpoint(self, mock_get_session: MagicMock) -> None:
        mock_session = MagicMock()
        mock_session.mint_token.return_value = "fake-token"
        mock_get_session.return_value = mock_session

        with override_settings(SENTRY_REGION_API_URL_TEMPLATE="https://{region}.testserver"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        url = response.data["objectstore"]["url"]
        region = settings.SENTRY_LOCAL_CELL
        assert url.startswith(f"https://{region}.testserver/")
        assert url.endswith(f"/api/0/organizations/{self.org.id}/objectstore")

    def test_requires_authentication(self) -> None:
        unauthenticated_client = APIClient()

        response = unauthenticated_client.get(self.url)

        assert response.status_code == 401

    def test_requires_project_access(self) -> None:
        other_user = self.create_user()
        self.login_as(user=other_user)

        response = self.client.get(self.url)

        assert response.status_code == 403

    @patch("objectstore_client.Session.mint_token", return_value="fake-token")
    def test_read_only_token_cannot_mint_upload_token(self, mock_mint_token: MagicMock) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])

        response = APIClient().get(self.url, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        assert response.status_code == 403
        mock_mint_token.assert_not_called()

    def test_project_member_with_releases_token_can_upload(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        token = self.create_user_auth_token(user=user, scope_list=["project:releases"])

        response = APIClient().get(self.url, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        assert response.status_code == 200
        assert response.data["objectstore"]["authToken"]

    def test_org_ci_token_can_upload(self) -> None:
        token = generate_token(self.org.slug, "")
        self.create_org_auth_token(
            organization_id=self.org.id,
            name="CI",
            token_hashed=hash_token(token),
            scope_list=["org:ci"],
        )

        response = APIClient().get(self.url, HTTP_AUTHORIZATION=f"Bearer {token}")

        assert response.status_code == 200
        assert response.data["objectstore"]["authToken"]

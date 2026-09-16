from __future__ import annotations

from base64 import b64encode
from datetime import timedelta
from typing import Any
from unittest import mock

import responses
from django.utils import timezone

from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.github.multi_platform_detection import PlatformDetectionClient
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiConflictError, ApiError
from sentry.testutils.cases import APITestCase

ENDPOINT_MODULE = "sentry.integrations.api.endpoints.organization_repository_platforms"


class StubDetectionClient:
    """A client implementing only the PlatformDetectionClient surface."""

    def __init__(
        self,
        languages: dict[str, int],
        tree: list[dict[str, Any]],
        has_languages_endpoint: bool = True,
    ) -> None:
        self.languages = languages
        self.tree = tree
        self.has_languages_endpoint = has_languages_endpoint
        self.languages_called_with_tree: list[dict[str, Any]] | None = None

    def get_languages(
        self, repo_slug: str, tree: list[dict[str, Any]] | None = None
    ) -> dict[str, int]:
        self.languages_called_with_tree = tree
        return self.languages

    def get(self, url: str, **kwargs: Any) -> Any:
        return {"tree": self.tree, "truncated": False}

    def get_contents(self, repo_slug: str, file_path: str, revision: str | None = None) -> Any:
        return {"content": ""}


class OrganizationRepositoryPlatformsGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-repository-platforms"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        ten_days = timezone.now() + timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id="123",
            integration_id=self.integration.id,
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_detects_framework_and_language(self, get_jwt: mock.MagicMock) -> None:
        # manage.py is a pure existence rule for python-django — no content read needed.
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"Python": 50000},
            status=200,
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/git/trees/HEAD",
            json={
                "tree": [{"path": "manage.py", "type": "blob", "size": 100}],
                "truncated": False,
            },
            status=200,
        )

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        platforms = {p["platform"]: p for p in response.data["platforms"]}
        assert "python-django" in platforms
        assert platforms["python-django"]["confidence"] == "high"
        assert "python" in platforms
        assert platforms["python"]["confidence"] == "medium"

    @mock.patch(f"{ENDPOINT_MODULE}.sentry_sdk")
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_empty_repo_returns_empty_list(
        self, get_jwt: mock.MagicMock, mock_sentry_sdk: mock.MagicMock
    ) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"Python": 50000},
            status=200,
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/git/trees/HEAD",
            json={"message": "Git Repository is empty."},
            status=409,
        )

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert response.data == {"platforms": []}
        assert mock_sentry_sdk.capture_exception.called
        scope = mock_sentry_sdk.new_scope.return_value.__enter__.return_value
        scope.set_tag.assert_any_call("scm_platform_detection", "empty_repo")
        scope.set_tag.assert_any_call("repo_id", self.repo.id)
        scope.set_tag.assert_any_call("repo_name", self.repo.name)

    @mock.patch(f"{ENDPOINT_MODULE}.sentry_sdk")
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_github_api_error_returns_502(
        self, get_jwt: mock.MagicMock, mock_sentry_sdk: mock.MagicMock
    ) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"message": "Server Error"},
            status=500,
        )

        response = self.get_response(self.organization.slug, self.repo.id)

        assert response.status_code == 502
        assert "Failed to detect" in response.data["detail"]
        assert mock_sentry_sdk.capture_exception.called
        scope = mock_sentry_sdk.new_scope.return_value.__enter__.return_value
        scope.set_tag.assert_any_call("repo_id", self.repo.id)
        scope.set_tag.assert_any_call("repo_name", self.repo.name)

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_detects_platforms(self, get_jwt: mock.MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"Python": 50000},
            status=200,
        )
        # Recursive git tree with no manifest files -> language only, no framework detection
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/git/trees/HEAD",
            json={
                "sha": "abc",
                "truncated": False,
                "tree": [
                    {"path": "src/app.py", "type": "blob", "size": 1234},
                    {"path": "src", "type": "tree"},
                ],
            },
            status=200,
        )

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert response.data == {
            "platforms": [
                {
                    "platform": "python",
                    "language": "Python",
                    "bytes": 50000,
                    "confidence": "medium",
                    "priority": 1,
                },
            ]
        }

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_detects_framework(self, get_jwt: mock.MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"Python": 50000},
            status=200,
        )
        # Recursive git tree containing requirements.txt so a content read fires
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/git/trees/HEAD",
            json={
                "sha": "abc",
                "truncated": False,
                "tree": [
                    {"path": "requirements.txt", "type": "blob", "size": 42},
                ],
            },
            status=200,
        )

        requirements_content = b64encode(b"Django==4.2\ncelery>=5.0\n").decode()
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents/requirements.txt",
            json={"content": requirements_content},
            status=200,
        )

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert response.data == {
            "platforms": [
                {
                    "platform": "python-django",
                    "language": "Python",
                    "bytes": 50000,
                    "confidence": "high",
                    "priority": 90,
                },
                {
                    "platform": "python-celery",
                    "language": "Python",
                    "bytes": 50000,
                    "confidence": "high",
                    "priority": 40,
                },
                {
                    "platform": "python",
                    "language": "Python",
                    "bytes": 50000,
                    "confidence": "medium",
                    "priority": 1,
                },
            ]
        }

    @mock.patch("sentry.integrations.github.integration.GitHubIntegration.get_client")
    def test_resolves_client_from_integration_installation(
        self, mock_get_client: mock.MagicMock
    ) -> None:
        client: PlatformDetectionClient = StubDetectionClient(
            languages={"Python": 50000},
            tree=[{"path": "manage.py", "type": "blob", "size": 100}],
        )
        mock_get_client.return_value = client

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert mock_get_client.called
        platforms = {p["platform"] for p in response.data["platforms"]}
        assert platforms == {"python-django", "python"}

    @mock.patch("sentry.integrations.models.integration.Integration.get_installation")
    def test_cursor_origin_is_supported(self, mock_get_installation: mock.MagicMock) -> None:
        self.integration.provider = IntegrationProviderSlug.CURSOR_ORIGIN.value
        self.integration.save(update_fields=["provider"])
        self.repo.provider = f"integrations:{IntegrationProviderSlug.CURSOR_ORIGIN.value}"
        self.repo.save(update_fields=["provider"])
        mock_get_installation.return_value = StubDetectionClient(
            languages={"C#": 50000},
            tree=[{"path": "src/app.cs", "type": "blob", "size": 100}],
        )

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert response.data["platforms"] == [
            {
                "platform": "dotnet",
                "language": "C#",
                "bytes": 50000,
                "confidence": "medium",
                "priority": 1,
            }
        ]

    @mock.patch(f"{ENDPOINT_MODULE}.detect_platforms_multi")
    @mock.patch("sentry.integrations.models.integration.Integration.get_installation")
    def test_second_request_is_served_from_cache(
        self, mock_get_installation: mock.MagicMock, mock_detect: mock.MagicMock
    ) -> None:
        mock_detect.return_value = {"platforms": [{"platform": "python"}]}

        first = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)
        second = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert first.data == second.data
        assert mock_detect.call_count == 1

    @mock.patch(f"{ENDPOINT_MODULE}.detect_platforms_multi")
    @mock.patch("sentry.integrations.models.integration.Integration.get_installation")
    def test_a_failed_detection_is_not_cached(
        self, mock_get_installation: mock.MagicMock, mock_detect: mock.MagicMock
    ) -> None:
        mock_detect.side_effect = ApiError("boom")
        assert self.get_response(self.organization.slug, self.repo.id).status_code == 502

        mock_detect.side_effect = None
        mock_detect.return_value = {"platforms": [{"platform": "python"}]}
        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert response.data["platforms"] == [{"platform": "python"}]
        assert mock_detect.call_count == 2

    @mock.patch(f"{ENDPOINT_MODULE}.detect_platforms_multi")
    @mock.patch("sentry.integrations.models.integration.Integration.get_installation")
    def test_an_empty_repo_is_cached(
        self, mock_get_installation: mock.MagicMock, mock_detect: mock.MagicMock
    ) -> None:
        mock_detect.side_effect = ApiConflictError("empty")

        first = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)
        second = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert first.data == {"platforms": []}
        assert second.data == {"platforms": []}
        assert mock_detect.call_count == 1

    @mock.patch("sentry.integrations.github.integration.GitHubIntegration.get_client")
    def test_a_client_without_a_languages_endpoint_derives_them_from_the_tree(
        self, mock_get_client: mock.MagicMock
    ) -> None:
        """Avoids a second tree fetch for providers with no languages endpoint."""
        tree = [{"path": "manage.py", "type": "blob", "size": 100}]
        client = StubDetectionClient(
            languages={"Python": 50000}, tree=tree, has_languages_endpoint=False
        )
        mock_get_client.return_value = client

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert client.languages_called_with_tree == tree
        platforms = {p["platform"] for p in response.data["platforms"]}
        assert platforms == {"python-django", "python"}

    @mock.patch("sentry.integrations.github.integration.GitHubIntegration.get_client")
    def test_a_client_with_a_languages_endpoint_is_not_given_the_tree(
        self, mock_get_client: mock.MagicMock
    ) -> None:
        client = StubDetectionClient(
            languages={"Python": 50000},
            tree=[{"path": "manage.py", "type": "blob", "size": 100}],
            has_languages_endpoint=True,
        )
        mock_get_client.return_value = client

        self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert client.languages_called_with_tree is None

    @mock.patch(f"{ENDPOINT_MODULE}.detect_platforms_multi")
    @mock.patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    def test_org_integration_is_fetched_once(
        self, mock_get_org_integration: mock.MagicMock, mock_detect: mock.MagicMock
    ) -> None:
        """get_client() would re-fetch it over RPC if the cached property were unseeded."""
        mock_detect.return_value = {"platforms": []}

        self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        assert mock_get_org_integration.call_count == 1

    @mock.patch("sentry.integrations.github.integration.GitHubIntegration.get_client")
    def test_a_missing_org_integration_is_a_400_not_a_500(
        self, mock_get_client: mock.MagicMock
    ) -> None:
        mock_get_client.side_effect = OrganizationIntegrationNotFound("gone")

        response = self.get_response(self.organization.slug, self.repo.id)

        assert response.status_code == 400

    def test_repo_not_found(self) -> None:
        response = self.get_response(self.organization.slug, 99999)
        assert response.status_code == 404

    def test_unsupported_provider_repo(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="unsupported-provider-repo",
            provider="integrations:bitbucket",
            external_id="456",
        )

        response = self.get_response(self.organization.slug, repo.id)
        assert response.status_code == 400
        assert "not supported for this repository" in response.data["detail"]

    def test_github_enterprise_repo_rejected(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="enterprise-repo",
            provider="integrations:github_enterprise",
            external_id="999",
            integration_id=self.integration.id,
        )

        response = self.get_response(self.organization.slug, repo.id)
        assert response.status_code == 400
        assert "not supported for this repository" in response.data["detail"]

    def test_repo_without_integration(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="orphan-repo",
            provider="integrations:github",
            external_id="789",
            integration_id=None,
        )

        response = self.get_response(self.organization.slug, repo.id)
        assert response.status_code == 400

    def test_other_orgs_repo_not_accessible(self) -> None:
        other_org = self.create_organization(name="other-org")
        other_repo = Repository.objects.create(
            organization_id=other_org.id,
            name="Test-Organization/secret",
            provider="integrations:github",
            external_id="secret",
            integration_id=self.integration.id,
        )

        response = self.get_response(self.organization.slug, other_repo.id)
        assert response.status_code == 404

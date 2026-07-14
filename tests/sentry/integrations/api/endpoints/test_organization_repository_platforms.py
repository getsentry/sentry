from __future__ import annotations

from base64 import b64encode
from datetime import timedelta
from unittest import mock

import responses
from django.utils import timezone

from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase

FEATURE_FLAG = "organizations:integrations-github-platform-detection"
MULTI_FLAG = "organizations:integrations-github-multi-platform-detection"
ENDPOINT_MODULE = "sentry.integrations.api.endpoints.organization_repository_platforms"


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

    def test_feature_flag_required(self) -> None:
        response = self.get_response(self.organization.slug, self.repo.id)
        assert response.status_code == 404

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_detects_platforms(self, get_jwt: mock.MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"Python": 50000, "JavaScript": 30000},
            status=200,
        )
        # Root directory listing (no manifest files -> no framework detection)
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents",
            json=[],
            status=200,
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug, self.repo.id, status_code=200
            )

        # Only the top language by bytes is returned
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
        # Root directory listing with requirements.txt so framework detection can find it
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents",
            json=[{"name": "requirements.txt", "type": "file"}],
            status=200,
        )

        requirements_content = b64encode(b"Django==4.2\ncelery>=5.0\n").decode()
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents/requirements.txt",
            json={"content": requirements_content},
            status=200,
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug, self.repo.id, status_code=200
            )

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

    def test_repo_not_found(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, 99999)
        assert response.status_code == 404

    def test_non_github_repo(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="non-github-repo",
            provider="integrations:bitbucket",
            external_id="456",
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, repo.id)
        assert response.status_code == 400
        assert "only supported for GitHub" in response.data["detail"]

    def test_github_enterprise_repo_rejected(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="enterprise-repo",
            provider="integrations:github_enterprise",
            external_id="999",
            integration_id=self.integration.id,
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, repo.id)
        assert response.status_code == 400
        assert "only supported for GitHub" in response.data["detail"]

    def test_repo_without_integration(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="orphan-repo",
            provider="integrations:github",
            external_id="789",
            integration_id=None,
        )

        with self.feature(FEATURE_FLAG):
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

        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, other_repo.id)
        assert response.status_code == 404

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

        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, self.repo.id)
        assert response.status_code == 502
        assert "Failed to detect" in response.data["detail"]
        assert mock_sentry_sdk.capture_exception.called
        scope = mock_sentry_sdk.new_scope.return_value.__enter__.return_value
        scope.set_tag.assert_any_call("is_multi", False)
        scope.set_tag.assert_any_call("repo_id", self.repo.id)
        scope.set_tag.assert_any_call("repo_name", self.repo.name)


class OrganizationRepositoryPlatformsMultiGetTest(APITestCase):
    """Tests for the multi-platform detector path (both flags enabled)."""

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
    def test_multi_detects_framework_and_language(self, get_jwt: mock.MagicMock) -> None:
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

        with self.feature({FEATURE_FLAG: True, MULTI_FLAG: True}):
            response = self.get_success_response(
                self.organization.slug, self.repo.id, status_code=200
            )

        platforms = {p["platform"]: p for p in response.data["platforms"]}
        assert "python-django" in platforms
        assert platforms["python-django"]["confidence"] == "high"
        assert "python" in platforms
        assert platforms["python"]["confidence"] == "medium"

    @mock.patch(f"{ENDPOINT_MODULE}.sentry_sdk")
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_multi_empty_repo_returns_empty_list(
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

        with self.feature({FEATURE_FLAG: True, MULTI_FLAG: True}):
            response = self.get_success_response(
                self.organization.slug, self.repo.id, status_code=200
            )

        assert response.data == {"platforms": []}
        assert mock_sentry_sdk.capture_exception.called
        scope = mock_sentry_sdk.new_scope.return_value.__enter__.return_value
        scope.set_tag.assert_any_call("scm_platform_detection", "empty_repo")
        scope.set_tag.assert_any_call("is_multi", True)
        scope.set_tag.assert_any_call("repo_id", self.repo.id)
        scope.set_tag.assert_any_call("repo_name", self.repo.name)

    @mock.patch(f"{ENDPOINT_MODULE}.sentry_sdk")
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_multi_github_api_error_returns_502(
        self, get_jwt: mock.MagicMock, mock_sentry_sdk: mock.MagicMock
    ) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"message": "Server Error"},
            status=500,
        )

        with self.feature({FEATURE_FLAG: True, MULTI_FLAG: True}):
            response = self.get_response(self.organization.slug, self.repo.id)

        assert response.status_code == 502
        assert "Failed to detect" in response.data["detail"]
        assert mock_sentry_sdk.capture_exception.called
        scope = mock_sentry_sdk.new_scope.return_value.__enter__.return_value
        scope.set_tag.assert_any_call("is_multi", True)
        scope.set_tag.assert_any_call("repo_id", self.repo.id)
        scope.set_tag.assert_any_call("repo_name", self.repo.name)

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_detects_multi_platforms(self, get_jwt: mock.MagicMock) -> None:
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

        with self.feature({FEATURE_FLAG: True, MULTI_FLAG: True}):
            response = self.get_success_response(
                self.organization.slug, self.repo.id, status_code=200
            )

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
    def test_detects_multi_framework(self, get_jwt: mock.MagicMock) -> None:
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

        with self.feature({FEATURE_FLAG: True, MULTI_FLAG: True}):
            response = self.get_success_response(
                self.organization.slug, self.repo.id, status_code=200
            )

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

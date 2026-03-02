from __future__ import annotations

from datetime import timedelta
from unittest import mock

import responses
from django.utils import timezone

from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase


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
    def test_detects_platforms(self, get_jwt: mock.MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"Python": 50000, "JavaScript": 30000},
            status=200,
        )
        # Mock 404s for manifest file lookups (no framework detection)
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents/requirements.txt",
            json={"message": "Not Found"},
            status=404,
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents/pyproject.toml",
            json={"message": "Not Found"},
            status=404,
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents/Pipfile",
            json={"message": "Not Found"},
            status=404,
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents/package.json",
            json={"message": "Not Found"},
            status=404,
        )

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        platforms = response.data["platforms"]
        platform_ids = [p["platform"] for p in platforms]
        assert "python" in platform_ids
        assert "javascript" in platform_ids

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_detects_framework(self, get_jwt: mock.MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"Python": 50000},
            status=200,
        )

        from base64 import b64encode

        requirements_content = b64encode(b"Django==4.2\ncelery>=5.0\n").decode()
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/contents/requirements.txt",
            json={"content": requirements_content},
            status=200,
        )

        response = self.get_success_response(self.organization.slug, self.repo.id, status_code=200)

        platforms = response.data["platforms"]
        platform_ids = [p["platform"] for p in platforms]
        assert "python-django" in platform_ids
        assert "python-celery" in platform_ids

        django = next(p for p in platforms if p["platform"] == "python-django")
        assert django["confidence"] == "high"

    def test_repo_not_found(self) -> None:
        response = self.get_response(self.organization.slug, 99999)
        assert response.status_code == 404

    def test_non_github_repo(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="non-github-repo",
            provider="integrations:bitbucket",
            external_id="456",
        )

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

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_github_api_error_returns_502(self, get_jwt: mock.MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/languages",
            json={"message": "Server Error"},
            status=500,
        )

        response = self.get_response(self.organization.slug, self.repo.id)
        assert response.status_code == 502
        assert "Failed to detect" in response.data["detail"]

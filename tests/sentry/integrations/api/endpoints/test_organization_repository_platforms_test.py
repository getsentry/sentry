from __future__ import annotations

from datetime import timedelta
from unittest import mock

import responses
from django.utils import timezone

from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase

FEATURE_FLAG = "organizations:integrations-github-platform-detection"


class OrganizationRepositoryPlatformsTestGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-repository-platforms-test"

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

    def test_repo_not_found(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, 99999)
        assert response.status_code == 404

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_returns_no_content(self, get_jwt: mock.MagicMock) -> None:
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

        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, self.repo.id)

        assert response.status_code == 204

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_returns_no_content_on_github_error(self, get_jwt: mock.MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/repos/Test-Organization/foo/git/trees/HEAD",
            json={"message": "Git Repository is empty."},
            status=409,
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_response(self.organization.slug, self.repo.id)

        assert response.status_code == 204

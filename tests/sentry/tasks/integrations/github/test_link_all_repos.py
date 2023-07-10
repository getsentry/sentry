from datetime import timedelta
from unittest.mock import patch

import pytest
import responses
from django.db import IntegrityError
from django.utils import timezone

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.snuba.sessions_v2 import isoformat_z
from sentry.tasks.integrations.github.link_all_repos import link_all_repos
from sentry.testutils.cases import IntegrationTestCase


class GithubCommentTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    def setUp(self):
        super().setUp()
        self.installation_id = "github:1"
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = isoformat_z(timezone.now() + timedelta(days=365))

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_link_all_repos(self, get_jwt):
        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={
                "total_count": 2,
                "repositories": [
                    {
                        "id": 1,
                        "full_name": "getsentry/sentry",
                    },
                    {
                        "id": 2,
                        "full_name": "getsentry/snuba",
                    },
                ],
            },
        )

        link_all_repos(integration_id=self.integration.id, organization_id=self.organization.id)

        repos = Repository.objects.all()
        assert len(repos) == 2

        for repo in repos:
            assert repo.organization_id == self.organization.id
            assert repo.provider == "github"

        assert repos[0].name == "getsentry/sentry"
        assert repos[1].name == "getsentry/snuba"

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_link_all_repos_api_response_keyerror(self, get_jwt):
        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={
                "total_count": 2,
                "repositories": [
                    {
                        "full_name": "getsentry/sentry",
                    },
                    {
                        "id": 2,
                        "full_name": "getsentry/snuba",
                    },
                ],
            },
        )

        link_all_repos(integration_id=self.integration.id, organization_id=self.organization.id)

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].organization_id == self.organization.id
        assert repos[0].provider == "github"

        assert repos[0].name == "getsentry/snuba"

    @patch("sentry.tasks.integrations.github.link_all_repos.metrics")
    def test_link_all_repos_missing_integration(self, mock_metrics):
        link_all_repos(integration_id=0, organization_id=self.organization.id)
        mock_metrics.incr.assert_called_with(
            "github.link_all_repos.error", tags={"type": "missing_integration"}
        )

    @patch("sentry.tasks.integrations.github.link_all_repos.metrics")
    def test_link_all_repos_missing_organization(self, mock_metrics):
        link_all_repos(integration_id=self.integration.id, organization_id=0)
        mock_metrics.incr.assert_called_with(
            "github.link_all_repos.error", tags={"type": "missing_organization"}
        )

    @patch("sentry.tasks.integrations.github.link_all_repos.metrics")
    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_link_all_repos_api_error(self, get_jwt, mock_metrics):
        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=400,
        )

        with pytest.raises(ApiError):
            link_all_repos(integration_id=self.integration.id, organization_id=self.organization.id)
            mock_metrics.incr.assert_called_with("github.link_all_repos.api_error")

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @patch("sentry.tasks.integrations.github.link_all_repos.metrics")
    @responses.activate
    def test_link_all_repos_api_error_rate_limited(self, mock_metrics, get_jwt):
        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=400,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        link_all_repos(integration_id=self.integration.id, organization_id=self.organization.id)
        mock_metrics.incr.assert_called_with("github.link_all_repos.rate_limited_error")

    @patch("sentry_sdk.capture_exception")
    @patch("sentry.models.Repository.objects.create")
    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_link_all_repos_repo_creation_error(self, get_jwt, mock_repo, mock_capture_exception):
        mock_repo.side_effect = IntegrityError

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={
                "total_count": 2,
                "repositories": [
                    {
                        "id": 1,
                        "full_name": "getsentry/sentry",
                    },
                    {
                        "id": 2,
                        "full_name": "getsentry/snuba",
                    },
                ],
            },
        )

        link_all_repos(integration_id=self.integration.id, organization_id=self.organization.id)

        assert mock_capture_exception.called

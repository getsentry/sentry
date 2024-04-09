from unittest.mock import patch

import pytest
import responses
from django.db import IntegrityError

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo import SiloMode
from sentry.tasks.integrations.link_all_repos import link_all_repos
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
@patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
class LinkAllReposTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"
    key = "github"

    def _add_responses(self):
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

    @responses.activate
    def test_link_all_repos(self, _):
        self._add_responses()

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            repos = Repository.objects.all()
        assert len(repos) == 2

        for repo in repos:
            assert repo.organization_id == self.organization.id
            assert repo.provider == "integrations:github"

        assert repos[0].name == "getsentry/sentry"
        assert repos[1].name == "getsentry/snuba"

    @responses.activate
    def test_link_all_repos_api_response_keyerror(self, _):

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

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].organization_id == self.organization.id
        assert repos[0].provider == "integrations:github"

        assert repos[0].name == "getsentry/snuba"

    @patch("sentry.tasks.integrations.link_all_repos.metrics")
    def test_link_all_repos_missing_integration(self, mock_metrics, _):
        link_all_repos(
            integration_key=self.key,
            integration_id=0,
            organization_id=self.organization.id,
        )
        mock_metrics.incr.assert_called_with(
            "github.link_all_repos.error", tags={"type": "missing_integration"}
        )

    @patch("sentry.tasks.integrations.link_all_repos.metrics")
    def test_link_all_repos_missing_organization(self, mock_metrics, _):
        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=0,
        )
        mock_metrics.incr.assert_called_with(
            "github.link_all_repos.error", tags={"type": "missing_organization"}
        )

    @patch("sentry.tasks.integrations.link_all_repos.metrics")
    @responses.activate
    def test_link_all_repos_api_error(self, mock_metrics, _):

        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=400,
        )

        with pytest.raises(ApiError):
            link_all_repos(
                integration_key=self.key,
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )
            mock_metrics.incr.assert_called_with("github.link_all_repos.api_error")

    @patch("sentry.integrations.github.integration.metrics")
    @responses.activate
    def test_link_all_repos_api_error_rate_limited(self, mock_metrics, _):

        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=400,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        mock_metrics.incr.assert_called_with("github.link_all_repos.rate_limited_error")

    @patch("sentry.models.Repository.objects.create")
    @patch("sentry.tasks.integrations.link_all_repos.metrics")
    @responses.activate
    def test_link_all_repos_repo_creation_error(self, mock_metrics, mock_repo, _):
        mock_repo.side_effect = IntegrityError

        self._add_responses()

        link_all_repos(
            integration_key=self.key,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        mock_metrics.incr.assert_called_with("sentry.integration_repo_provider.repo_exists")

    @patch("sentry.services.hybrid_cloud.repository.repository_service.create_repository")
    @patch("sentry.plugins.providers.IntegrationRepositoryProvider.on_delete_repository")
    @responses.activate
    def test_link_all_repos_repo_creation_exception(
        self, mock_delete_repo, mock_create_repository, _
    ):
        mock_create_repository.return_value = None
        mock_delete_repo.side_effect = Exception

        self._add_responses()

        with pytest.raises(Exception):
            link_all_repos(
                integration_key=self.key,
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )

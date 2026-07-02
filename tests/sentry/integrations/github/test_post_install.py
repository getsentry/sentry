from unittest.mock import MagicMock, call, patch

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GitHubIntegrationPostInstallTest(IntegrationTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="123456",
            metadata={"account_id": "789"},
        )

    @patch("sentry.integrations.services.repository.repository_service.get_repositories")
    @patch("sentry.integrations.tasks.migrate_repo.migrate_repo.apply_async")
    @patch("sentry.integrations.github.tasks.link_all_repos.link_all_repos.apply_async")
    def test_post_install_migrates_existing_repos(
        self,
        mock_link_repos,
        mock_migrate_repo,
        mock_get_repositories,
    ):
        mock_repo1 = MagicMock()
        mock_repo1.id = 1
        mock_repo2 = MagicMock()
        mock_repo2.id = 2
        mock_get_repositories.return_value = [mock_repo1, mock_repo2]

        provider = GitHubIntegrationProvider()
        provider.post_install(
            integration=self.integration, organization=self.organization, extra={"app_id": "app_1"}
        )

        assert mock_migrate_repo.call_count == 2

        expected_calls = [
            call(
                kwargs={
                    "repo_id": 1,
                    "integration_id": self.integration.id,
                    "organization_id": self.organization.id,
                }
            ),
            call(
                kwargs={
                    "repo_id": 2,
                    "integration_id": self.integration.id,
                    "organization_id": self.organization.id,
                }
            ),
        ]
        mock_migrate_repo.assert_has_calls(expected_calls, any_order=True)

        mock_link_repos.assert_called_once_with(
            kwargs={
                "integration_key": "github",
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
            }
        )

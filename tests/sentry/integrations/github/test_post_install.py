from unittest.mock import MagicMock, patch

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GitHubIntegrationPostInstallTest(IntegrationTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
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
    @patch("sentry.integrations.github.tasks.codecov_account_link.codecov_account_link.apply_async")
    @patch("sentry.options.get")
    def test_post_install_triggers_codecov_when_app_ids_match(
        self,
        mock_options_get,
        mock_codecov_task,
        mock_link_repos,
        mock_migrate_repo,
        mock_get_repositories,
    ):
        # Set up options to return the matching app ID
        mock_options_get.return_value = "app_1"

        provider = GitHubIntegrationProvider()
        provider.post_install(
            integration=self.integration, organization=self.organization, extra={"app_id": "app_1"}
        )

        mock_codecov_task.assert_called_once_with(
            kwargs={
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
            }
        )

    @patch("sentry.integrations.services.repository.repository_service.get_repositories")
    @patch("sentry.integrations.tasks.migrate_repo.migrate_repo.apply_async")
    @patch("sentry.integrations.github.tasks.link_all_repos.link_all_repos.apply_async")
    @patch("sentry.integrations.github.tasks.codecov_account_link.codecov_account_link.apply_async")
    @patch("sentry.options.get")
    def test_post_install_skips_codecov_when_app_ids_dont_match(
        self,
        mock_options_get,
        mock_codecov_task,
        mock_link_repos,
        mock_migrate_repo,
        mock_get_repositories,
    ):
        # Set up options to return a different app ID
        mock_options_get.return_value = "different_app_id"

        provider = GitHubIntegrationProvider()
        provider.post_install(
            integration=self.integration, organization=self.organization, extra={"app_id": "app_1"}
        )

        mock_codecov_task.assert_not_called()

    @patch(
        "sentry.integrations.models.organization_integration.OrganizationIntegration.objects.filter"
    )
    @patch("sentry.integrations.services.repository.repository_service.get_repositories")
    @patch("sentry.integrations.tasks.migrate_repo.migrate_repo.apply_async")
    @patch("sentry.integrations.github.tasks.link_all_repos.link_all_repos.apply_async")
    @patch("sentry.integrations.github.tasks.codecov_account_link.codecov_account_link.apply_async")
    @patch("sentry.options.get")
    def test_post_install_skips_codecov_when_org_integration_missing(
        self,
        mock_options_get,
        mock_codecov_task,
        mock_link_repos,
        mock_migrate_repo,
        mock_get_repositories,
        mock_org_integration_filter,
    ):
        mock_options_get.return_value = "app_1"

        mock_queryset = MagicMock()
        mock_queryset.first.return_value = None
        mock_org_integration_filter.return_value = mock_queryset

        provider = GitHubIntegrationProvider()
        provider.post_install(
            integration=self.integration, organization=self.organization, extra={"app_id": "app_1"}
        )

        mock_codecov_task.assert_not_called()

        mock_org_integration_filter.assert_called_once_with(
            integration=self.integration, organization_id=self.organization.id
        )

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.has_repo_access",
        return_value=True,
    )
    @patch("sentry.integrations.github.tasks.link_all_repos.link_all_repos.apply_async")
    @patch("sentry.integrations.github.tasks.codecov_account_link.codecov_account_link.apply_async")
    @patch("sentry.options.get")
    def test_post_install_migrates_existing_repos(
        self,
        mock_options_get,
        mock_codecov_task,
        mock_has_repo_access,
        mock_link_all_repos,
    ):
        # TODO: This currently migrates any orphaned repo to the newest installed GH integration
        repo1 = self.create_repo(project=self.project, provider="github", external_id="1")
        repo2 = self.create_repo(project=self.project, provider="github", external_id="2")

        mock_options_get.return_value = "app_1"

        provider = GitHubIntegrationProvider()

        with self.tasks():
            provider.post_install(
                integration=self.integration,
                organization=self.organization,
                extra={"app_id": "app_1"},
            )

        mock_codecov_task.assert_called_once()

        repo1.refresh_from_db()
        repo2.refresh_from_db()

        assert repo1.integration_id == self.integration.id
        assert repo2.integration_id == self.integration.id

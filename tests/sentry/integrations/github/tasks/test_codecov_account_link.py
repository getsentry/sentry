from typing import int
from unittest.mock import MagicMock, patch

from sentry.codecov.client import ConfigurationError
from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.github.tasks.codecov_account_link import (
    account_link_endpoint,
    codecov_account_link,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class CodecovAccountLinkTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB.value,
            name="test-org",
            external_id="123456",
            metadata={"account_id": "789"},
        )

    @patch("sentry.integrations.github.tasks.codecov_account_link.CodecovApiClient")
    def test_codecov_account_link_success(self, mock_codecov_client_class):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_client.post.return_value = mock_response
        mock_codecov_client_class.return_value = mock_client

        codecov_account_link(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        mock_codecov_client_class.assert_called_once_with(
            git_provider_org="test-org", git_provider=IntegrationProviderSlug.GITHUB.value
        )

        expected_request_data = {
            "sentry_org_id": str(self.organization.id),
            "sentry_org_name": self.organization.name,
            "organizations": [
                {
                    "installation_id": "123456",
                    "service_id": "789",
                    "slug": "test-org",
                    "provider": IntegrationProviderSlug.GITHUB.value,
                }
            ],
        }
        mock_client.post.assert_called_once_with(
            endpoint=account_link_endpoint,
            json=expected_request_data,
        )
        mock_response.raise_for_status.assert_called_once()

    def test_codecov_account_link_missing_integration(self):
        with patch("sentry.integrations.github.tasks.codecov_account_link.logger") as mock_logger:
            codecov_account_link(
                integration_id=99999,  # Non-existent integration
                organization_id=self.organization.id,
            )

            mock_logger.warning.assert_called_once_with(
                "codecov.account_link.missing_integration", extra={"integration_id": 99999}
            )

    def test_codecov_account_link_missing_organization(self):
        with patch("sentry.integrations.github.tasks.codecov_account_link.logger") as mock_logger:
            codecov_account_link(
                integration_id=self.integration.id,
                organization_id=99999,  # Non-existent organization
            )

            mock_logger.warning.assert_called_once_with(
                "codecov.account_link.missing_organization", extra={"organization_id": 99999}
            )

    @patch("sentry.integrations.github.tasks.codecov_account_link.CodecovApiClient")
    def test_codecov_account_link_missing_service_id(self, mock_codecov_client_class):
        integration_no_service_id = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB.value,
            name="test-org-no-service",
            external_id="456789",
            metadata={},  # No account_id
        )

        mock_client = MagicMock()
        mock_codecov_client_class.return_value = mock_client

        with patch("sentry.integrations.github.tasks.codecov_account_link.logger") as mock_logger:
            codecov_account_link(
                integration_id=integration_no_service_id.id,
                organization_id=self.organization.id,
            )

            mock_logger.warning.assert_called_once_with(
                "codecov.account_link.missing_service_id",
                extra={
                    "integration_id": integration_no_service_id.id,
                    "github_org": "test-org-no-service",
                },
            )

    @patch("sentry.integrations.github.tasks.codecov_account_link.CodecovApiClient")
    def test_codecov_account_link_configuration_error(self, mock_codecov_client_class):
        mock_codecov_client_class.side_effect = ConfigurationError("Bad config")

        with patch("sentry.integrations.github.tasks.codecov_account_link.logger") as mock_logger:
            codecov_account_link(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )

            mock_logger.exception.assert_called_once_with(
                "codecov.account_link.configuration_error",
                extra={
                    "github_org": "test-org",
                    "integration_id": self.integration.id,
                },
            )

    @patch("sentry.integrations.github.tasks.codecov_account_link.CodecovApiClient")
    def test_codecov_account_link_api_error(self, mock_codecov_client_class):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("API Error")
        mock_client.post.return_value = mock_response
        mock_codecov_client_class.return_value = mock_client

        with patch("sentry.integrations.github.tasks.codecov_account_link.logger") as mock_logger:
            codecov_account_link(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )

            mock_logger.exception.assert_called_once_with(
                "codecov.account_link.unexpected_error",
                extra={
                    "github_org": "test-org",
                    "integration_id": self.integration.id,
                    "error": "API Error",
                    "error_type": "Exception",
                },
            )

    def test_codecov_account_link_inactive_integration(self):
        self.integration.update(status=ObjectStatus.DISABLED)

        with patch("sentry.integrations.github.tasks.codecov_account_link.logger") as mock_logger:
            codecov_account_link(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )

            mock_logger.warning.assert_called_once_with(
                "codecov.account_link.missing_integration",
                extra={"integration_id": self.integration.id},
            )

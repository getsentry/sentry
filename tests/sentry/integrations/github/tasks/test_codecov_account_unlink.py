from typing import int
from unittest.mock import MagicMock, patch

from sentry.codecov.client import ConfigurationError
from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.github.tasks.codecov_account_unlink import (
    account_unlink_endpoint,
    codecov_account_unlink,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class CodecovAccountUnlinkTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB.value,
            name="test-org",
            external_id="123456",
            metadata={"account_id": "789"},
            status=ObjectStatus.DISABLED,
        )

    @patch("sentry.integrations.github.tasks.codecov_account_unlink.CodecovApiClient")
    def test_codecov_account_unlink_success(self, mock_codecov_client_class):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_client.post.return_value = mock_response
        mock_codecov_client_class.return_value = mock_client

        codecov_account_unlink(
            integration_id=self.integration.id,
            organization_ids=[self.organization.id],
        )

        mock_codecov_client_class.assert_called_once_with(
            git_provider_org="test-org", git_provider=IntegrationProviderSlug.GITHUB.value
        )

        expected_request_data = {
            "sentry_org_ids": [str(self.organization.id)],
        }
        mock_client.post.assert_called_once_with(
            endpoint=account_unlink_endpoint,
            json=expected_request_data,
        )
        mock_response.raise_for_status.assert_called_once()

    def test_codecov_account_unlink_missing_integration(self):
        with patch("sentry.integrations.github.tasks.codecov_account_unlink.logger") as mock_logger:
            codecov_account_unlink(
                integration_id=99999,  # Non-existent integration
                organization_ids=[self.organization.id],
            )

            mock_logger.warning.assert_called_once_with(
                "codecov.account_unlink.missing_integration", extra={"integration_id": 99999}
            )

    @patch("sentry.integrations.github.tasks.codecov_account_unlink.CodecovApiClient")
    def test_codecov_account_unlink_configuration_error(self, mock_codecov_client_class):
        mock_codecov_client_class.side_effect = ConfigurationError("Bad config")

        with patch("sentry.integrations.github.tasks.codecov_account_unlink.logger") as mock_logger:
            codecov_account_unlink(
                integration_id=self.integration.id,
                organization_ids=[self.organization.id],
            )

            mock_logger.exception.assert_called_once_with(
                "codecov.account_unlink.configuration_error",
                extra={
                    "github_org": "test-org",
                    "integration_id": self.integration.id,
                },
            )

    @patch("sentry.integrations.github.tasks.codecov_account_unlink.CodecovApiClient")
    def test_codecov_account_unlink_api_error(self, mock_codecov_client_class):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("API Error")
        mock_client.post.return_value = mock_response
        mock_codecov_client_class.return_value = mock_client

        with patch("sentry.integrations.github.tasks.codecov_account_unlink.logger") as mock_logger:
            codecov_account_unlink(
                integration_id=self.integration.id,
                organization_ids=[self.organization.id],
            )

            mock_logger.exception.assert_called_once_with(
                "codecov.account_unlink.unexpected_error",
                extra={
                    "github_org": "test-org",
                    "integration_id": self.integration.id,
                    "error": "API Error",
                    "error_type": "Exception",
                },
            )

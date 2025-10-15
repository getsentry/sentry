import datetime
from unittest.mock import Mock, patch

import pytest
import responses
from cryptography.fernet import Fernet
from django.test import override_settings

from sentry.integrations.credentials_service.service import (
    LeasedCredentials,
    ResourceType,
    ScmIntegrationCredentialsService,
)
from sentry.integrations.credentials_service.types import CredentialLeasable, CredentialLease
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test()
class TestCredentialsService(TestCase):
    encryption_key = Fernet.generate_key().decode("utf-8")

    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.create_user())
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test Integration",
            external_id="123",
        )
        self.mock_installation = Mock(spec=CredentialLeasable)
        self.mock_installation.get_maximum_lease_duration_seconds.return_value = 100

    def decrypt_credentials(
        self, encrypted_credentials: str, encryption_key: str
    ) -> LeasedCredentials:
        f = Fernet(encryption_key.encode("utf-8"))
        decrypted = f.decrypt(encrypted_credentials.encode("utf-8"))
        decrypted_str = decrypted.decode("utf-8")
        decrypted_dict = json.loads(decrypted_str)

        return LeasedCredentials(**decrypted_dict)

    # Responses isn't strictly required, but it prevents us from accidentally
    # making external API calls if we miss a mock.
    @responses.activate
    @patch.object(Integration, "get_installation")
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    def test_get_credentials_by_resource__organization(
        self, mock_encrypt_credentials, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation

        expected_credential_lease = CredentialLease(
            access_token="access_token",
            expires_at=datetime.datetime.fromisoformat("3030-01-01T12:00:00Z"),
            permissions=None,
        )

        self.mock_installation.get_active_access_token.return_value = expected_credential_lease
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"

        service = ScmIntegrationCredentialsService()
        credentials = service.get_credentials_by_resource(
            sentry_organization_id=self.organization.id,
            integration_provider="github",
            token_minimum_validity_seconds=10,
            resource_type=ResourceType.ORGANIZATION,
            resource_identifier="Test Integration",
        )

        assert credentials == "<fake_encrypted_data>"

    @patch.object(Integration, "get_installation")
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    def test_get_credentials_by_resource__sentry_installation(
        self, mock_encrypt_credentials, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"
        service = ScmIntegrationCredentialsService()
        credentials = service.get_credentials_by_resource(
            sentry_organization_id=self.organization.id,
            integration_provider="github",
            token_minimum_validity_seconds=10,
            resource_type=ResourceType.SENTRY_INSTALLATION,
            resource_identifier=self.integration.id,
        )
        assert credentials == "<fake_encrypted_data>"

    @patch.object(Integration, "get_installation")
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    def test_get_credentials_by_resource__sentry_installation_not_found(
        self, mock_encrypt_credentials, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"
        service = ScmIntegrationCredentialsService()
        with pytest.raises(OrganizationIntegration.DoesNotExist):
            service.get_credentials_by_resource(
                sentry_organization_id=self.organization.id,
                integration_provider="github",
                token_minimum_validity_seconds=10,
                resource_type=ResourceType.SENTRY_INSTALLATION,
                resource_identifier="123",
            )

    @responses.activate
    @patch.object(Integration, "get_installation")
    def test_get_credentials_by_resource__get_active_access_token_raises_exception(
        self, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation
        self.mock_installation.get_active_access_token.side_effect = Exception("API Error")
        self.mock_installation.does_access_token_expire_within.return_value = False

        service = ScmIntegrationCredentialsService()
        with pytest.raises(Exception, match="API Error"):
            service.get_credentials_by_resource(
                sentry_organization_id=self.organization.id,
                integration_provider="github",
                token_minimum_validity_seconds=10,
                resource_type=ResourceType.ORGANIZATION,
                resource_identifier="Test Integration",
            )

    @responses.activate
    @patch.object(Integration, "get_installation")
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    def test_get_credentials_by_resource__returns_active_credential_lease(
        self, mock_encrypt_credentials, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation

        expected_credential_lease = CredentialLease(
            access_token="active_token",
            expires_at=datetime.datetime.fromisoformat("3030-01-01T12:00:00Z"),
            permissions={"repo": "read"},
        )

        self.mock_installation.get_active_access_token.return_value = expected_credential_lease
        self.mock_installation.does_access_token_expire_within.return_value = False
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"

        service = ScmIntegrationCredentialsService()
        credentials = service.get_credentials_by_resource(
            sentry_organization_id=self.organization.id,
            integration_provider="github",
            token_minimum_validity_seconds=10,
            resource_type=ResourceType.ORGANIZATION,
            resource_identifier="Test Integration",
        )

        assert credentials == "<fake_encrypted_data>"
        self.mock_installation.get_active_access_token.assert_called_once()

    @responses.activate
    @patch.object(Integration, "get_installation")
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    def test_get_credentials_by_resource__expires_below_threshold_refreshes(
        self, mock_encrypt_credentials, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation

        refreshed_credential_lease = CredentialLease(
            access_token="refreshed_token",
            expires_at=datetime.datetime.fromisoformat("3030-01-02T12:00:00Z"),
            permissions={"repo": "write"},
        )

        self.mock_installation.does_access_token_expire_within.return_value = True
        self.mock_installation.refresh_access_token_with_minimum_validity_time.return_value = (
            refreshed_credential_lease
        )
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"

        service = ScmIntegrationCredentialsService()
        credentials = service.get_credentials_by_resource(
            sentry_organization_id=self.organization.id,
            integration_provider="github",
            token_minimum_validity_seconds=10,
            resource_type=ResourceType.ORGANIZATION,
            resource_identifier="Test Integration",
        )

        assert credentials == "<fake_encrypted_data>"
        self.mock_installation.refresh_access_token_with_minimum_validity_time.assert_called_once()
        self.mock_installation.get_active_access_token.assert_not_called()

    @responses.activate
    @patch.object(Integration, "get_installation")
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    def test_get_credentials_by_resource__expires_above_threshold_returns_active(
        self, mock_encrypt_credentials, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation

        active_credential_lease = CredentialLease(
            access_token="active_token",
            expires_at=datetime.datetime.fromisoformat("3030-01-05T12:00:00Z"),
            permissions=None,
        )

        self.mock_installation.does_access_token_expire_within.return_value = False
        self.mock_installation.get_active_access_token.return_value = active_credential_lease
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"

        service = ScmIntegrationCredentialsService()
        credentials = service.get_credentials_by_resource(
            sentry_organization_id=self.organization.id,
            integration_provider="github",
            token_minimum_validity_seconds=10,
            resource_type=ResourceType.ORGANIZATION,
            resource_identifier="Test Integration",
        )

        assert credentials == "<fake_encrypted_data>"
        self.mock_installation.get_active_access_token.assert_called_once()
        self.mock_installation.refresh_access_token_with_minimum_validity_time.assert_not_called()

    @responses.activate
    @patch.object(Integration, "get_installation")
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    def test_rotate_credentials_by_resource__force_refreshes_token(
        self, mock_encrypt_credentials, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation

        force_refreshed_credential_lease = CredentialLease(
            access_token="force_refreshed_token",
            expires_at=datetime.datetime.fromisoformat("3030-01-03T12:00:00Z"),
            permissions={"repo": "admin"},
        )

        self.mock_installation.force_refresh_access_token.return_value = (
            force_refreshed_credential_lease
        )
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"

        service = ScmIntegrationCredentialsService()
        credentials = service.rotate_credentials_by_resource(
            sentry_organization_id=self.organization.id,
            integration_provider="github",
            resource_type=ResourceType.ORGANIZATION,
            resource_identifier="Test Integration",
        )

        assert credentials == "<fake_encrypted_data>"
        self.mock_installation.force_refresh_access_token.assert_called_once()
        self.mock_installation.get_active_access_token.assert_not_called()
        self.mock_installation.refresh_access_token_with_minimum_validity_time.assert_not_called()

    @responses.activate
    @patch.object(ScmIntegrationCredentialsService, "_encrypt_credentials")
    @patch.object(Integration, "get_installation")
    def test_get_credentials_by_resource__expiration_none_triggers_refresh(
        self, mock_get_installation, mock_encrypt_credentials
    ) -> None:
        mock_get_installation.return_value = self.mock_installation

        refreshed_credential_lease = CredentialLease(
            access_token="refreshed_token",
            expires_at=datetime.datetime.fromisoformat("3030-01-04T12:00:00Z"),
            permissions=None,
        )

        self.mock_installation.get_current_access_token_expiration.return_value = None
        self.mock_installation.does_access_token_expire_within.return_value = True
        self.mock_installation.refresh_access_token_with_minimum_validity_time.return_value = (
            refreshed_credential_lease
        )
        mock_encrypt_credentials.return_value = "<fake_encrypted_data>"

        service = ScmIntegrationCredentialsService()
        credentials = service.get_credentials_by_resource(
            sentry_organization_id=self.organization.id,
            integration_provider="github",
            token_minimum_validity_seconds=10,
            resource_type=ResourceType.ORGANIZATION,
            resource_identifier="Test Integration",
        )

        self.mock_installation.refresh_access_token_with_minimum_validity_time.assert_called_once()
        assert credentials == "<fake_encrypted_data>"

    @responses.activate
    @patch.object(Integration, "get_installation")
    def test_get_credentials_by_resource__properly_encrypts_credentials(
        self, mock_get_installation
    ) -> None:
        mock_get_installation.return_value = self.mock_installation

        refreshed_credential_lease = CredentialLease(
            access_token="refreshed_token",
            expires_at=datetime.datetime.fromisoformat("3030-01-04T12:00:00Z"),
            permissions=None,
        )

        self.mock_installation.get_current_access_token_expiration.return_value = None
        self.mock_installation.does_access_token_expire_within.return_value = True
        self.mock_installation.refresh_access_token_with_minimum_validity_time.return_value = (
            refreshed_credential_lease
        )

        with override_settings(INTEGRATION_CREDENTIALS_LEASE_ENCRYPTION_KEY=self.encryption_key):
            service = ScmIntegrationCredentialsService()
            credentials = service.get_credentials_by_resource(
                sentry_organization_id=self.organization.id,
                integration_provider="github",
                token_minimum_validity_seconds=10,
                resource_type=ResourceType.ORGANIZATION,
                resource_identifier="Test Integration",
            )

        self.mock_installation.refresh_access_token_with_minimum_validity_time.assert_called_once()
        decrypted_credentials = self.decrypt_credentials(credentials, self.encryption_key)

        assert decrypted_credentials == LeasedCredentials(
            access_token=refreshed_credential_lease.access_token,
            permissions=refreshed_credential_lease.permissions,
            expires_at=(
                refreshed_credential_lease.expires_at.isoformat()
                if refreshed_credential_lease.expires_at
                else None
            ),
            lease_duration_seconds=10,
            sentry_organization_id=str(self.organization.id),
            external_installation_id="123",
            resource_identifier="Test Integration",
            resource_type=ResourceType.ORGANIZATION.value,
            integration_provider=IntegrationProviderSlug.GITHUB.value,
        )

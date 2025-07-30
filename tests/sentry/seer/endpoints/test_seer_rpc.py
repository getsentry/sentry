import logging
from typing import Any
from unittest.mock import patch

import orjson
import pytest
import responses
from cryptography.fernet import Fernet
from django.test import override_settings
from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.models.options.organization_option import OrganizationOption
from sentry.seer.endpoints.seer_rpc import (
    generate_request_signature,
    get_github_enterprise_integration_config,
    get_organization_seer_consent_by_org_name,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode

# Fernet key must be a base64 encoded string, exactly 32 bytes long
TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")


@override_settings(SEER_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class TestSeerRpc(APITestCase):
    @staticmethod
    def _get_path(method_name: str) -> str:
        return reverse(
            "sentry-api-0-seer-rpc-service",
            kwargs={"method_name": method_name},
        )

    def auth_header(self, path: str, data: dict | str) -> str:
        if isinstance(data, dict):
            data = orjson.dumps(data).decode()
        signature = generate_request_signature(path, data.encode())

        return f"rpcsignature {signature}"

    def test_invalid_endpoint(self) -> None:
        path = self._get_path("not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    def test_404(self) -> None:
        path = self._get_path("get_organization_slug")
        data: dict[str, Any] = {"args": {"org_id": 1}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 404


class TestSeerRpcMethods(APITestCase):
    """Test individual RPC methods"""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)

    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    def test_get_organization_seer_consent_by_org_name_no_integrations(self) -> None:
        """Test when no organization integrations are found"""
        # Test with a non-existent organization name
        result = get_organization_seer_consent_by_org_name(org_name="non-existent-org")
        assert result == {"consent": False}

    def test_get_organization_seer_consent_by_org_name_no_consent(self):
        """Test when organization exists but has no consent"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        # Disable PR review test generation
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", False
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}

    def test_get_organization_seer_consent_by_org_name_with_default_pr_review_enabled(self):
        """Test when organization has seer acknowledgement"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return True since PR review is enabled by default
        assert result == {"consent": True}

    def test_get_organization_seer_consent_by_org_name_multiple_orgs_one_with_consent(self):
        """Test when multiple organizations exist, one with consent"""
        org_without_consent = self.create_organization(owner=self.user)
        org_with_consent = self.create_organization(owner=self.user)

        # Create integrations for both organizations with the same name
        self.create_integration(
            organization=org_without_consent,
            provider="github",
            name="test-org",
            external_id="github:test-org-1",
        )
        self.create_integration(
            organization=org_with_consent,
            provider="github",
            name="test-org",
            external_id="github:test-org-2",
        )

        # Disable PR review for first org, enable for second (or leave default)
        OrganizationOption.objects.set_value(
            org_without_consent, "sentry:enable_pr_review_test_generation", False
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}

    def test_get_organization_seer_consent_by_org_name_with_hide_ai_features_enabled(
        self,
    ):
        """Test that when hide_ai_features is True, that org doesn't contribute consent"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        # Enable hide_ai_features
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", True)

        # Set up PR review to be enabled (but won't matter since hide_ai_features=True)
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return False because hide_ai_features=True makes this org not contribute consent
        assert result == {"consent": False}

    def test_get_organization_seer_consent_by_org_name_with_hide_ai_features_disabled(
        self,
    ):
        """Test that when hide_ai_features is False, PR review setting determines consent"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        # Explicitly disable hide_ai_features
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", False)

        # PR review is enabled by default, so (NOT hide_ai_features AND pr_review_enabled) = True
        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return True because hide_ai_features=False and PR review is enabled by default
        assert result == {"consent": True}

    def test_get_organization_seer_consent_by_org_name_multiple_orgs_with_hide_ai_features(
        self,
    ):
        """Test multiple orgs where first has hide_ai_features=True but second has hide_ai_features=False"""
        org_with_hidden_ai = self.create_organization(owner=self.user)
        org_with_visible_ai = self.create_organization(owner=self.user)

        # Create integrations for both organizations with the same name
        self.create_integration(
            organization=org_with_hidden_ai,
            provider="github",
            name="test-org",
            external_id="github:test-org-1",
        )
        self.create_integration(
            organization=org_with_visible_ai,
            provider="github",
            name="test-org",
            external_id="github:test-org-2",
        )

        # First org has hide_ai_features enabled (so it won't contribute consent)
        OrganizationOption.objects.set_value(org_with_hidden_ai, "sentry:hide_ai_features", True)

        # Second org has hide_ai_features disabled and PR review enabled by default
        OrganizationOption.objects.set_value(org_with_visible_ai, "sentry:hide_ai_features", False)

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return True because second org has (NOT hide_ai_features AND pr_review_enabled) = True
        assert result == {"consent": True}

    def test_get_organization_seer_consent_by_org_name_multiple_orgs_all_hide_ai_features(
        self,
    ):
        """Test multiple orgs where all have hide_ai_features=True"""
        org1 = self.create_organization(owner=self.user)
        org2 = self.create_organization(owner=self.user)

        # Create integrations for both organizations with the same name
        self.create_integration(
            organization=org1,
            provider="github",
            name="test-org",
            external_id="github:test-org-1",
        )
        self.create_integration(
            organization=org2,
            provider="github",
            name="test-org",
            external_id="github:test-org-2",
        )

        # Both orgs have hide_ai_features enabled
        OrganizationOption.objects.set_value(org1, "sentry:hide_ai_features", True)
        OrganizationOption.objects.set_value(org2, "sentry:hide_ai_features", True)

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return False because no org can contribute consent (all have hide_ai_features=True)
        assert result == {"consent": False}

    def test_get_organization_seer_consent_by_org_name_hide_ai_false_pr_review_false(
        self,
    ):
        """Test that both conditions must be met: hide_ai_features=False AND pr_review_enabled=True"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        # Disable hide_ai_features but also disable PR review
        OrganizationOption.objects.set_value(self.organization, "sentry:hide_ai_features", False)
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", False
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return False because even though hide_ai_features=False, pr_review_enabled=False
        assert result == {"consent": False}

    @responses.activate
    @override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
    @assume_test_silo_mode(SiloMode.CONTROL)
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_github_enterprise_integration_config(self, mock_get_jwt):
        """Test when organization has github enterprise integration"""

        installation_id = 1234
        private_key = "private_key_1"
        access_token = "access_token_1"
        responses.add(
            responses.POST,
            f"https://github.example.org/api/v3/app/installations/{installation_id}/access_tokens",
            json={
                "token": access_token,
                "expires_at": "3000-01-01T00:00:00Z",
                "permissions": {
                    "administration": "read",
                    "contents": "read",
                    "issues": "write",
                    "metadata": "read",
                    "pull_requests": "read",
                },
            },
        )

        # Create a GitHub Enterprise integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            external_id="github_external_id",
            metadata={
                "domain_name": "github.example.org",
                "installation": {
                    "private_key": private_key,
                    "id": 1,
                    "verify_ssl": True,
                },
                "installation_id": installation_id,
            },
        )

        result = get_github_enterprise_integration_config(
            organization_id=self.organization.id,
            integration_id=integration.id,
        )

        assert result["success"]
        assert result["base_url"] == "https://github.example.org/api/v3"
        assert result["verify_ssl"]
        assert result["encrypted_access_token"]
        assert result["permissions"] == {
            "administration": "read",
            "contents": "read",
            "issues": "write",
            "metadata": "read",
            "pull_requests": "read",
        }

        # Test that the access token is encrypted correctly
        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        decrypted_access_token = fernet.decrypt(
            result["encrypted_access_token"].encode("utf-8")
        ).decode("utf-8")

        assert decrypted_access_token == access_token

        mock_get_jwt.assert_called_once_with(github_id=1, github_private_key=private_key)

    @override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_get_github_enterprise_integration_config_invalid_integration_id(self) -> None:
        # Test with invalid integration_id
        with self._caplog.at_level(logging.ERROR):
            result = get_github_enterprise_integration_config(
                organization_id=self.organization.id,
                integration_id=-1,
            )

        assert not result["success"]
        assert "Integration -1 does not exist" in self._caplog.text

    @override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_get_github_enterprise_integration_config_invalid_organization_id(self) -> None:
        installation_id = 1234
        private_key = "private_key_1"

        # Create a GitHub Enterprise integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            external_id="github_external_id",
            metadata={
                "domain_name": "github.example.org",
                "installation": {
                    "private_key": private_key,
                    "id": 1,
                    "verify_ssl": True,
                },
                "installation_id": installation_id,
            },
        )

        # Test with invalid organization_id
        with self._caplog.at_level(logging.ERROR):
            result = get_github_enterprise_integration_config(
                organization_id=-1,
                integration_id=integration.id,
            )

        assert not result["success"]
        assert f"Integration {integration.id} does not exist" in self._caplog.text

    @override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_get_github_enterprise_integration_config_disabled_integration(self) -> None:
        installation_id = 1234
        private_key = "private_key_1"

        # Create a GitHub Enterprise integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            external_id="github_external_id",
            metadata={
                "domain_name": "github.example.org",
                "installation": {
                    "private_key": private_key,
                    "id": 1,
                    "verify_ssl": True,
                },
                "installation_id": installation_id,
            },
        )

        # Test with disabled integration
        integration.status = ObjectStatus.DISABLED
        integration.save()

        with self._caplog.at_level(logging.ERROR):
            result = get_github_enterprise_integration_config(
                organization_id=self.organization.id,
                integration_id=integration.id,
            )

        assert not result["success"]
        assert f"Integration {integration.id} does not exist" in self._caplog.text

    @responses.activate
    @override_settings(SEER_GHE_ENCRYPT_KEY="invalid")
    @assume_test_silo_mode(SiloMode.CONTROL)
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_github_enterprise_integration_config_invalid_encrypt_key(self, mock_get_jwt):
        installation_id = 1234
        private_key = "private_key_1"
        access_token = "access_token_1"
        responses.add(
            responses.POST,
            f"https://github.example.org/api/v3/app/installations/{installation_id}/access_tokens",
            json={"token": access_token, "expires_at": "3000-01-01T00:00:00Z"},
        )

        # Create a GitHub Enterprise integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            external_id="github_external_id",
            metadata={
                "domain_name": "github.example.org",
                "installation": {
                    "private_key": private_key,
                    "id": 1,
                    "verify_ssl": True,
                },
                "installation_id": installation_id,
            },
        )

        with self._caplog.at_level(logging.ERROR):
            result = get_github_enterprise_integration_config(
                organization_id=self.organization.id,
                integration_id=integration.id,
            )

        assert not result["success"]
        assert "Failed to encrypt access token" in self._caplog.text

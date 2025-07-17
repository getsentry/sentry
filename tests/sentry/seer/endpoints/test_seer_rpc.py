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
from sentry.testutils.helpers.options import override_options
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

    def test_invalid_endpoint(self):
        path = self._get_path("not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    def test_404(self):
        path = self._get_path("get_organization_slug")
        data: dict[str, Any] = {"args": {"org_id": 1}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 404


class TestSeerRpcMethods(APITestCase):
    """Test individual RPC methods"""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)

    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    def test_get_organization_seer_consent_by_org_name_no_integrations(self):
        """Test when no organization integrations are found"""
        # Test with a non-existent organization name
        result = get_organization_seer_consent_by_org_name(org_name="non-existent-org")
        assert result == {"consent": False}

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_no_consent(self, mock_get_acknowledgement):
        """Test when organization exists but has no consent"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_seer_acknowledgement(
        self, mock_get_acknowledgement
    ):
        """Test when organization has seer acknowledgement"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_github_extension(
        self, mock_get_acknowledgement
    ):
        """Test when organization has github extension enabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_both_consents(
        self, mock_get_acknowledgement
    ):
        """Test when organization has both seer acknowledgement and github extension enabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_multiple_orgs_one_with_consent(
        self, mock_get_acknowledgement
    ):
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

        # First org has no consent, second org has seer acknowledgement
        mock_get_acknowledgement.side_effect = [False, True]

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        # Should stop after finding first org with consent
        assert mock_get_acknowledgement.call_count == 2

    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_mixed_scenarios(
        self, mock_get_acknowledgement
    ):
        """Test mixed scenario with org without consent and org with consent"""
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

        # First org has no consent, second org has github extension enabled
        mock_get_acknowledgement.side_effect = [False, False]

        with override_options({"github-extension.enabled-orgs": [org_with_consent.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        # Should be called twice (checks both existing orgs)
        assert mock_get_acknowledgement.call_count == 2

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_explicit_pr_review_enabled(
        self, mock_get_acknowledgement
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True

        # Explicitly enable PR review test generation for this organization
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_default_pr_review_behavior(
        self, mock_get_acknowledgement
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True

        # Don't set any organization option - should use default (True)
        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_seer_acknowledgement_but_pr_review_disabled(
        self, mock_get_acknowledgement
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True

        # Disable PR review test generation for this organization
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", False
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_github_extension_but_pr_review_disabled(
        self, mock_get_acknowledgement
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False

        # Disable PR review test generation for this organization
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", False
        )

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_no_seer_acknowledgement_with_pr_review_enabled(
        self, mock_get_acknowledgement
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False

        # Explicitly enable PR review test generation for this organization (though it's default)
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.seer.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_multiple_orgs_pr_review_mixed(
        self, mock_get_acknowledgement
    ):
        org_with_seer_no_pr_review = self.create_organization(owner=self.user)
        org_with_github_and_pr_review = self.create_organization(owner=self.user)

        # Create integrations for both organizations with the same name
        self.create_integration(
            organization=org_with_seer_no_pr_review,
            provider="github",
            name="test-org",
            external_id="github:test-org-1",
        )
        self.create_integration(
            organization=org_with_github_and_pr_review,
            provider="github",
            name="test-org",
            external_id="github:test-org-2",
        )

        # First org has seer acknowledgement but PR review disabled
        # Second org has github extension enabled and PR review enabled (default)
        mock_get_acknowledgement.side_effect = [True, False]

        # Disable PR review test generation for the first organization
        OrganizationOption.objects.set_value(
            org_with_seer_no_pr_review, "sentry:enable_pr_review_test_generation", False
        )

        with override_options(
            {"github-extension.enabled-orgs": [org_with_github_and_pr_review.id]}
        ):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        # Should be called twice (checks both existing orgs)
        assert mock_get_acknowledgement.call_count == 2

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

        result = get_github_enterprise_integration_config(
            organization_id=self.organization.id,
            integration_id=integration.id,
        )

        assert result["success"]
        assert result["base_url"] == "https://github.example.org/api/v3"
        assert result["verify_ssl"]
        assert result["encrypted_access_token"]

        # Test that the access token is encrypted correctly
        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        decrypted_access_token = fernet.decrypt(
            result["encrypted_access_token"].encode("utf-8")
        ).decode("utf-8")

        assert decrypted_access_token == access_token

        mock_get_jwt.assert_called_once_with(github_id=1, github_private_key=private_key)

    @override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_get_github_enterprise_integration_config_invalid_integration_id(self):
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
    def test_get_github_enterprise_integration_config_invalid_organization_id(self):
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
    def test_get_github_enterprise_integration_config_disabled_integration(self):
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

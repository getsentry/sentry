from typing import Any
from unittest.mock import patch

import orjson
from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.seer_rpc import (
    generate_request_signature,
    get_organization_seer_consent_by_org_name,
)
from sentry.testutils.cases import APITestCase


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
        self.organization = self.create_organization()

    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_no_integrations(self, mock_get_integrations):
        """Test when no organization integrations are found"""
        mock_get_integrations.return_value = []

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}
        mock_get_integrations.assert_called_once_with(provider="github", name="test-org")

    @patch("sentry.api.endpoints.seer_rpc.options.get")
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_no_consent(
        self, mock_get_integrations, mock_get_acknowledgement, mock_options_get
    ):
        """Test when organization exists but has no consent"""
        from unittest.mock import Mock

        mock_integration = Mock()
        mock_integration.organization_id = self.organization.id
        mock_get_integrations.return_value = [mock_integration]
        mock_get_acknowledgement.return_value = False
        mock_options_get.return_value = []  # No orgs in github-extension.enabled-orgs

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}
        mock_get_integrations.assert_called_once_with(provider="github", name="test-org")
        mock_get_acknowledgement.assert_called_once_with(org_id=self.organization.id)
        mock_options_get.assert_called_once_with("github-extension.enabled-orgs")

    @patch("sentry.api.endpoints.seer_rpc.options.get")
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_with_seer_acknowledgement(
        self, mock_get_integrations, mock_get_acknowledgement, mock_options_get
    ):
        """Test when organization has seer acknowledgement"""
        from unittest.mock import Mock

        mock_integration = Mock()
        mock_integration.organization_id = self.organization.id
        mock_get_integrations.return_value = [mock_integration]
        mock_get_acknowledgement.return_value = True
        mock_options_get.return_value = []  # No orgs in github-extension.enabled-orgs

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_integrations.assert_called_once_with(provider="github", name="test-org")
        mock_get_acknowledgement.assert_called_once_with(org_id=self.organization.id)
        mock_options_get.assert_called_once_with("github-extension.enabled-orgs")

    @patch("sentry.api.endpoints.seer_rpc.options.get")
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_with_github_extension(
        self, mock_get_integrations, mock_get_acknowledgement, mock_options_get
    ):
        """Test when organization has github extension enabled"""
        from unittest.mock import Mock

        mock_integration = Mock()
        mock_integration.organization_id = self.organization.id
        mock_get_integrations.return_value = [mock_integration]
        mock_get_acknowledgement.return_value = False
        mock_options_get.return_value = [
            self.organization.id
        ]  # Org in github-extension.enabled-orgs

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_integrations.assert_called_once_with(provider="github", name="test-org")
        mock_get_acknowledgement.assert_called_once_with(org_id=self.organization.id)
        mock_options_get.assert_called_once_with("github-extension.enabled-orgs")

    @patch("sentry.api.endpoints.seer_rpc.options.get")
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_with_both_consents(
        self, mock_get_integrations, mock_get_acknowledgement, mock_options_get
    ):
        """Test when organization has both seer acknowledgement and github extension enabled"""
        from unittest.mock import Mock

        mock_integration = Mock()
        mock_integration.organization_id = self.organization.id
        mock_get_integrations.return_value = [mock_integration]
        mock_get_acknowledgement.return_value = True
        mock_options_get.return_value = [
            self.organization.id
        ]  # Org in github-extension.enabled-orgs

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_integrations.assert_called_once_with(provider="github", name="test-org")
        mock_get_acknowledgement.assert_called_once_with(org_id=self.organization.id)
        mock_options_get.assert_called_once_with("github-extension.enabled-orgs")

    @patch("sentry.api.endpoints.seer_rpc.options.get")
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_multiple_orgs_one_with_consent(
        self, mock_get_integrations, mock_get_acknowledgement, mock_options_get
    ):
        """Test when multiple organizations exist, one with consent"""
        from unittest.mock import Mock

        org_without_consent = self.create_organization()
        org_with_consent = self.create_organization()

        mock_integration_1 = Mock()
        mock_integration_1.organization_id = org_without_consent.id
        mock_integration_2 = Mock()
        mock_integration_2.organization_id = org_with_consent.id

        mock_get_integrations.return_value = [mock_integration_1, mock_integration_2]

        # First org has no consent, second org has seer acknowledgement
        mock_get_acknowledgement.side_effect = [False, True]
        mock_options_get.return_value = []  # No orgs in github-extension.enabled-orgs

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_integrations.assert_called_once_with(provider="github", name="test-org")
        # Should stop after finding first org with consent
        assert mock_get_acknowledgement.call_count == 2

    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_custom_provider(self, mock_get_integrations):
        """Test with custom provider"""
        mock_get_integrations.return_value = []

        result = get_organization_seer_consent_by_org_name(org_name="test-org", provider="gitlab")

        assert result == {"consent": False}
        mock_get_integrations.assert_called_once_with(provider="gitlab", name="test-org")

    @patch("sentry.api.endpoints.seer_rpc.options.get")
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    @patch("sentry.api.endpoints.seer_rpc.integration_service.get_organization_integrations")
    def test_get_organization_seer_consent_by_org_name_mixed_scenarios(
        self, mock_get_integrations, mock_get_acknowledgement, mock_options_get
    ):
        """Test mixed scenario with non-existent org, org without consent, and org with consent"""
        from unittest.mock import Mock

        org_without_consent = self.create_organization()
        org_with_consent = self.create_organization()

        mock_integration_1 = Mock()
        mock_integration_1.organization_id = 99999  # Non-existent org
        mock_integration_2 = Mock()
        mock_integration_2.organization_id = org_without_consent.id
        mock_integration_3 = Mock()
        mock_integration_3.organization_id = org_with_consent.id

        mock_get_integrations.return_value = [
            mock_integration_1,
            mock_integration_2,
            mock_integration_3,
        ]

        # Second org has no consent, third org has github extension enabled
        mock_get_acknowledgement.side_effect = [False, False]
        mock_options_get.return_value = [org_with_consent.id]

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_integrations.assert_called_once_with(provider="github", name="test-org")
        # Should be called twice (skips non-existent org, checks two existing orgs)
        assert mock_get_acknowledgement.call_count == 2

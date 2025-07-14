from typing import Any
from unittest.mock import patch

import orjson
from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.seer_rpc import (
    generate_request_signature,
    get_organization_autofix_consent,
    get_organization_seer_consent_by_org_name,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


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

    def test_get_organization_seer_consent_by_org_name_no_integrations(self):
        """Test when no organization integrations are found"""
        # Test with a non-existent organization name
        result = get_organization_seer_consent_by_org_name(org_name="non-existent-org")
        assert result == {"consent": False}

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
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
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_seer_acknowledgement_only(
        self, mock_get_acknowledgement
    ):
        """Test when organization has seer acknowledgement but PR review disabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True
        self.organization.update_option("sentry:enable_pr_review_test_generation", False)

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}  # Should be False because PR review is disabled
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_github_extension_only(
        self, mock_get_acknowledgement
    ):
        """Test when organization has github extension enabled but PR review disabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False
        self.organization.update_option("sentry:enable_pr_review_test_generation", False)

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}  # Should be False because PR review is disabled
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
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
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_multiple_orgs_one_with_consent(
        self, mock_get_acknowledgement
    ):
        """Test when multiple organizations exist, one with both seer acknowledgement and PR review"""
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

        # First org has no consent, second org has seer acknowledgement AND PR review enabled
        mock_get_acknowledgement.side_effect = [False, True]
        org_with_consent.update_option("sentry:enable_pr_review_test_generation", True)

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        # Should stop after finding first org with consent
        assert mock_get_acknowledgement.call_count == 2

    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_mixed_scenarios(
        self, mock_get_acknowledgement
    ):
        """Test mixed scenario with org without consent and org with both github extension and PR review"""
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

        # First org has no consent, second org has github extension enabled AND PR review enabled
        mock_get_acknowledgement.side_effect = [False, False]
        org_with_consent.update_option("sentry:enable_pr_review_test_generation", True)

        with override_options({"github-extension.enabled-orgs": [org_with_consent.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        # Should be called twice (checks both existing orgs)
        assert mock_get_acknowledgement.call_count == 2

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_pr_review_enabled_only(
        self, mock_get_acknowledgement
    ):
        """Test when organization has PR review test generation enabled but no seer/github consent"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False
        # Enable PR review test generation setting
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}  # Should be False because no seer/github consent
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_pr_review_disabled(
        self, mock_get_acknowledgement
    ):
        """Test when organization has PR review test generation disabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False
        # Explicitly disable PR review test generation setting
        self.organization.update_option("sentry:enable_pr_review_test_generation", False)

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_pr_review_default_true_no_seer_consent(
        self, mock_get_acknowledgement
    ):
        """Test that PR review test generation defaults to True but still requires seer/github consent"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False
        # Don't set any value - should default to True

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": False}  # Should be False because no seer/github consent
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_seer_and_pr_review(
        self, mock_get_acknowledgement
    ):
        """Test when organization has both seer acknowledgement and PR review enabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}  # Should be True because both conditions met
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_github_and_pr_review(
        self, mock_get_acknowledgement
    ):
        """Test when organization has both github extension and PR review enabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = False
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}  # Should be True because both conditions met
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_with_pr_review_default_and_seer(
        self, mock_get_acknowledgement
    ):
        """Test that PR review test generation defaults to True and grants consent when combined with seer"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True
        # Don't set any value - should default to True

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {
            "consent": True
        }  # Should be True because both conditions met (default PR review + seer)
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_seer_consent_by_org_name_all_consent_methods(
        self, mock_get_acknowledgement
    ):
        """Test when organization has all three consent methods enabled"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        mock_get_acknowledgement.return_value = True
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_seer_consent_by_org_name(org_name="test-org")

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_autofix_consent_no_consent(self, mock_get_acknowledgement):
        """Test when organization has no consent methods enabled"""
        mock_get_acknowledgement.return_value = False

        result = get_organization_autofix_consent(org_id=self.organization.id)

        assert result == {"consent": False}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_autofix_consent_with_seer_acknowledgement(
        self, mock_get_acknowledgement
    ):
        """Test when organization has seer acknowledgement"""
        mock_get_acknowledgement.return_value = True

        result = get_organization_autofix_consent(org_id=self.organization.id)

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @override_options({"github-extension.enabled-orgs": []})
    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_autofix_consent_with_github_extension(self, mock_get_acknowledgement):
        """Test when organization has github extension enabled"""
        mock_get_acknowledgement.return_value = False

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_autofix_consent(org_id=self.organization.id)

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

    @patch("sentry.api.endpoints.seer_rpc.get_seer_org_acknowledgement")
    def test_get_organization_autofix_consent_both_methods_enabled(self, mock_get_acknowledgement):
        """Test when organization has both seer acknowledgement and github extension enabled"""
        mock_get_acknowledgement.return_value = True

        with override_options({"github-extension.enabled-orgs": [self.organization.id]}):
            result = get_organization_autofix_consent(org_id=self.organization.id)

        assert result == {"consent": True}
        mock_get_acknowledgement.assert_called_with(org_id=self.organization.id)

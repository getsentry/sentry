import logging
from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import orjson
import pytest
import responses
from cryptography.fernet import Fernet
from django.test import override_settings
from django.urls import reverse
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsResponse

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.repository import Repository
from sentry.seer.endpoints.seer_rpc import (
    check_repository_integrations_status,
    generate_request_signature,
    get_attributes_for_span,
    get_github_enterprise_integration_config,
    get_organization_seer_consent_by_org_name,
    get_sentry_organization_ids,
)
from sentry.seer.explorer.tools import get_trace_item_attributes
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of

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
    def inject_fixtures(self, caplog: pytest.LogCaptureFixture):
        self._caplog = caplog

    def test_get_organization_seer_consent_by_org_name_no_integrations(self) -> None:
        """Test when no organization integrations are found"""
        # Test with a non-existent organization name
        result = get_organization_seer_consent_by_org_name(org_name="non-existent-org")
        assert result == {"consent": False, "consent_url": None}

    def test_get_organization_seer_consent_by_org_name_no_consent(self) -> None:
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

        assert result == {
            "consent": False,
            "consent_url": self.organization.absolute_url("/settings/organization/"),
        }

    def test_get_organization_seer_consent_by_org_name_with_default_pr_review_enabled(self) -> None:
        """Test when organization has seer acknowledgement"""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="github:test-org",
        )

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return True since PR review is enabled by default
        assert result == {
            "consent": False,
            "consent_url": self.organization.absolute_url("/settings/organization/"),
        }

    def test_get_organization_seer_consent_by_org_name_multiple_orgs_one_with_consent(self) -> None:
        """Test when multiple organizations exist, one with consent"""
        from sentry.testutils.helpers.features import with_feature

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

        # Disable PR review for first org, enable for second (default is False)
        OrganizationOption.objects.set_value(
            org_without_consent, "sentry:enable_pr_review_test_generation", False
        )
        OrganizationOption.objects.set_value(
            org_with_consent, "sentry:enable_pr_review_test_generation", True
        )

        with with_feature("organizations:gen-ai-features"):
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
        assert result == {
            "consent": False,
            "consent_url": self.organization.absolute_url("/settings/organization/"),
        }

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

        result = get_organization_seer_consent_by_org_name(org_name="test-org")

        # Should return False because hide_ai_features=False and PR review is disabled by default
        assert result == {
            "consent": False,
            "consent_url": self.organization.absolute_url("/settings/organization/"),
        }

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

        # Should return False because second org has (NOT hide_ai_features AND pr_review_enabled) = False
        assert result == {
            "consent": False,
            "consent_url": org_with_visible_ai.absolute_url("/settings/organization/"),
        }

    def test_get_organization_seer_consent_by_org_name_multiple_orgs_all_hide_ai_features(
        self,
    ):
        """Test multiple orgs where all have hide_ai_features=True"""
        org1 = self.create_organization(owner=self.user, slug="test-org-1")
        org2 = self.create_organization(owner=self.user, slug="test-org-2")

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
        assert result == {
            "consent": False,
            "consent_url": org2.absolute_url("/settings/organization/"),
        }

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
        assert result == {
            "consent": False,
            "consent_url": self.organization.absolute_url("/settings/organization/"),
        }

    def test_get_attributes_for_span(self) -> None:
        project = self.create_project(organization=self.organization)

        response = TraceItemDetailsResponse()
        response.item_id = "deadbeefdeadbeef"
        response.timestamp.FromDatetime(datetime(2024, 1, 1, tzinfo=timezone.utc))
        attribute = response.attributes.add()
        attribute.name = "span.description"
        attribute.value.val_str = "example"

        with patch(
            "sentry.seer.endpoints.seer_rpc.snuba_rpc.trace_item_details_rpc",
            return_value=response,
        ) as mock_rpc:
            result = get_attributes_for_span(
                org_id=self.organization.id,
                project_id=project.id,
                trace_id="5fa0d282b446407cb279202490ee2e8a",
                span_id="deadbeefdeadbeef",
            )

        assert len(result["attributes"]) == 1
        attribute = result["attributes"][0]
        assert attribute["type"] == "str"
        assert attribute["value"] == "example"
        assert attribute["name"] in {"span.description", "tags[span.description,string]"}
        mock_rpc.assert_called_once()

    def test_get_trace_item_attributes_metric(self) -> None:
        """Test get_trace_item_attributes with metric item_type"""
        project = self.create_project(organization=self.organization)

        mock_response_data = {
            "itemId": "b582741a4a35039b",
            "timestamp": "2025-11-16T19:14:12Z",
            "attributes": [
                {"name": "metric.name", "type": "str", "value": "http.request.duration"},
                {"name": "value", "type": "float", "value": 123.45},
            ],
        }

        with patch("sentry.seer.explorer.tools.client.get") as mock_get:
            mock_get.return_value.data = mock_response_data
            result = get_trace_item_attributes(
                org_id=self.organization.id,
                project_id=project.id,
                trace_id="23eef78c77a94766ac941cce6510c057",
                item_id="b582741a4a35039b",
                item_type="tracemetrics",
            )

        assert len(result["attributes"]) == 2
        # Check that we have both types (order may vary)
        types = {attr["type"] for attr in result["attributes"]}
        assert types == {"str", "float"}
        mock_get.assert_called_once()

        # Verify the correct parameters were passed
        call_kwargs = mock_get.call_args[1]
        assert call_kwargs["params"]["item_type"] == "tracemetrics"
        assert call_kwargs["params"]["trace_id"] == "23eef78c77a94766ac941cce6510c057"

    @responses.activate
    @override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_github_enterprise_integration_config(self, mock_get_jwt) -> None:
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

        with assume_test_silo_mode_of(Integration):
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
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_github_enterprise_integration_config_invalid_encrypt_key(
        self, mock_get_jwt
    ) -> None:
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

    def test_get_sentry_organization_ids_repository_found(self) -> None:
        """Test when repository exists and is active"""
        from sentry.testutils.helpers.features import with_feature

        # Create a project
        project = self.create_project(organization=self.organization)

        # Create an integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )
        org_integration = integration.organizationintegration_set.first()
        assert org_integration is not None

        # Create a repository
        repo = Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )

        # Create a RepositoryProjectPathConfig
        RepositoryProjectPathConfig.objects.create(
            repository=repo,
            project=project,
            organization_integration_id=org_integration.id,
            integration_id=org_integration.integration_id,
            organization_id=self.organization.id,
            stack_root="/",
            source_root="/",
        )

        # By default the organization has pr_review turned off
        result = get_sentry_organization_ids(external_id="1234567890")
        assert result == {"org_ids": [], "org_slugs": []}

        # Turn on pr_review
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )
        with with_feature("organizations:gen-ai-features"):
            result = get_sentry_organization_ids(external_id="1234567890")
        assert result == {
            "org_ids": [self.organization.id],
            "org_slugs": [self.organization.slug],
        }

    def test_get_sentry_organization_ids_repository_not_found(self) -> None:
        """Test when repository does not exist"""
        result = get_sentry_organization_ids(external_id="1234567890")

        assert result == {"org_ids": [], "org_slugs": []}

    def test_get_sentry_organization_ids_repository_inactive(self) -> None:
        """Test when repository exists but is not active"""

        # Create a repository with inactive status
        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            external_id="1234567890",
            provider="integrations:github",
            status=ObjectStatus.DISABLED,
        )

        result = get_sentry_organization_ids(external_id="1234567890")

        # Should not find the repository because it's not active
        assert result == {"org_ids": [], "org_slugs": []}

    def test_get_sentry_organization_ids_different_provider(self) -> None:
        """Test when repository exists but with different provider"""

        # Create a repository with different provider
        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:gitlab",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )

        # Search with default provider (integrations:github)
        result = get_sentry_organization_ids(external_id="1234567890")

        # Should not find the repository because provider doesn't match
        assert result == {"org_ids": [], "org_slugs": []}

    def test_get_sentry_organization_ids_multiple_repos_same_name_different_providers(self) -> None:
        """Test when multiple repositories exist with same name but different providers"""
        org2 = self.create_organization(owner=self.user)

        # Create projects
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=org2)

        # Create integrations
        integration1 = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )
        org_integration1 = integration1.organizationintegration_set.first()
        assert org_integration1 is not None

        integration2 = self.create_integration(
            organization=org2,
            provider="gitlab",
            external_id="gitlab:1",
        )
        org_integration2 = integration2.organizationintegration_set.first()
        assert org_integration2 is not None

        # Create repositories with same name but different providers
        repo1 = Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )
        repo2 = Repository.objects.create(
            name="getsentry/sentry",
            organization_id=org2.id,
            provider="integrations:gitlab",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )

        # Create RepositoryProjectPathConfigs
        RepositoryProjectPathConfig.objects.create(
            repository=repo1,
            project=project1,
            organization_integration_id=org_integration1.id,
            integration_id=org_integration1.integration_id,
            organization_id=self.organization.id,
            stack_root="/",
            source_root="/",
        )
        RepositoryProjectPathConfig.objects.create(
            repository=repo2,
            project=project2,
            organization_integration_id=org_integration2.id,
            integration_id=org_integration2.integration_id,
            organization_id=org2.id,
            stack_root="/",
            source_root="/",
        )

        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )
        OrganizationOption.objects.set_value(org2, "sentry:enable_pr_review_test_generation", True)

        from sentry.testutils.helpers.features import with_feature

        # Search for GitHub provider
        with with_feature("organizations:gen-ai-features"):
            result = get_sentry_organization_ids(external_id="1234567890")

        assert result == {
            "org_ids": [self.organization.id],
            "org_slugs": [self.organization.slug],
        }

        # Search for GitLab provider
        with with_feature("organizations:gen-ai-features"):
            result = get_sentry_organization_ids(
                provider="integrations:gitlab",
                external_id="1234567890",
            )

        assert result == {"org_ids": [org2.id], "org_slugs": [org2.slug]}

    def test_get_sentry_organization_ids_multiple_orgs_same_repo(self) -> None:
        """Test when multiple repositories exist with same name but different providers and provider is provided"""
        org2 = self.create_organization(owner=self.user)
        org3 = self.create_organization(owner=self.user)
        # org3 did not give us consent for AI features
        # so it should be excluded from the results
        OrganizationOption.objects.set_value(org3, "sentry:hide_ai_features", True)
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )
        OrganizationOption.objects.set_value(org2, "sentry:enable_pr_review_test_generation", True)
        OrganizationOption.objects.set_value(org3, "sentry:enable_pr_review_test_generation", True)

        # Create projects
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=org2)
        project3 = self.create_project(organization=org3)

        # Create integrations
        integration1 = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )
        org_integration1 = integration1.organizationintegration_set.first()
        assert org_integration1 is not None

        integration2 = self.create_integration(
            organization=org2,
            provider="github",
            external_id="github:2",
        )
        org_integration2 = integration2.organizationintegration_set.first()
        assert org_integration2 is not None

        integration3 = self.create_integration(
            organization=org3,
            provider="github",
            external_id="github:3",
        )
        org_integration3 = integration3.organizationintegration_set.first()
        assert org_integration3 is not None

        # repo in org 1
        repo1 = Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )

        # repo in org 2
        repo2 = Repository.objects.create(
            name="getsentry/sentry",
            organization_id=org2.id,
            provider="integrations:github",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )

        # repo in org 3
        repo3 = Repository.objects.create(
            name="getsentry/sentry",
            organization_id=org3.id,
            provider="integrations:github",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )

        # Create RepositoryProjectPathConfigs
        RepositoryProjectPathConfig.objects.create(
            repository=repo1,
            project=project1,
            organization_integration_id=org_integration1.id,
            integration_id=org_integration1.integration_id,
            organization_id=self.organization.id,
            stack_root="/",
            source_root="/",
        )
        RepositoryProjectPathConfig.objects.create(
            repository=repo2,
            project=project2,
            organization_integration_id=org_integration2.id,
            integration_id=org_integration2.integration_id,
            organization_id=org2.id,
            stack_root="/",
            source_root="/",
        )
        RepositoryProjectPathConfig.objects.create(
            repository=repo3,
            project=project3,
            organization_integration_id=org_integration3.id,
            integration_id=org_integration3.integration_id,
            organization_id=org3.id,
            stack_root="/",
            source_root="/",
        )

        # Search for GitHub provider
        from sentry.testutils.helpers.features import with_feature

        with with_feature("organizations:gen-ai-features"):
            result = get_sentry_organization_ids(external_id="1234567890")

        assert set(result["org_ids"]) == {self.organization.id, org2.id}
        assert set(result["org_slugs"]) == {self.organization.slug, org2.slug}

    def test_get_sentry_organization_ids_no_repo_project_path_config(self) -> None:
        """Test when repository exists but has no RepositoryProjectPathConfig"""
        # Create a repository without any RepositoryProjectPathConfig
        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1234567890",
            status=ObjectStatus.ACTIVE,
        )

        # Turn on pr_review
        OrganizationOption.objects.set_value(
            self.organization, "sentry:enable_pr_review_test_generation", True
        )

        # Should not find the organization because there's no RepositoryProjectPathConfig
        result = get_sentry_organization_ids(external_id="1234567890")

        assert result == {"org_ids": [], "org_slugs": []}

    def test_send_seer_webhook_invalid_event_name(self) -> None:
        """Test that send_seer_webhook returns error for invalid event names"""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        # Test with an invalid event name
        result = send_seer_webhook(
            event_name="invalid_event_name",
            organization_id=self.organization.id,
            payload={"test": "data"},
        )

        assert result == {
            "success": False,
            "error": "Invalid event type: seer.invalid_event_name",
        }

    def test_send_seer_webhook_organization_does_not_exist(self) -> None:
        """Test that send_seer_webhook returns error for non-existent organization"""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        # Test with a non-existent organization ID
        result = send_seer_webhook(
            event_name="root_cause_started",
            organization_id=99999,
            payload={"test": "data"},
        )

        assert result == {
            "success": False,
            "error": "Organization not found or not active",
        }

    def test_send_seer_webhook_organization_inactive(self) -> None:
        """Test that send_seer_webhook returns error for inactive organization"""
        from sentry.models.organization import OrganizationStatus
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        # Create an inactive organization
        inactive_org = self.create_organization(status=OrganizationStatus.PENDING_DELETION)

        result = send_seer_webhook(
            event_name="root_cause_started",
            organization_id=inactive_org.id,
            payload={"test": "data"},
        )

        assert result == {
            "success": False,
            "error": "Organization not found or not active",
        }

    @patch("sentry.features.has")
    def test_send_seer_webhook_feature_disabled(self, mock_features_has) -> None:
        """Test that send_seer_webhook returns error when feature is disabled"""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        mock_features_has.return_value = False

        result = send_seer_webhook(
            event_name="root_cause_started",
            organization_id=self.organization.id,
            payload={"test": "data"},
        )

        assert result == {
            "success": False,
            "error": "Seer webhooks are not enabled for this organization",
        }
        mock_features_has.assert_called_with("organizations:seer-webhooks", self.organization)

    @patch("sentry.features.has")
    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_success(self, mock_delay, mock_features_has) -> None:
        """Test that send_seer_webhook successfully enqueues webhook when all conditions are met"""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        mock_features_has.return_value = True

        result = send_seer_webhook(
            event_name="root_cause_started",
            organization_id=self.organization.id,
            payload={"test": "data"},
        )

        assert result == {"success": True}
        mock_features_has.assert_called_with("organizations:seer-webhooks", self.organization)
        mock_delay.assert_called_once_with(
            resource_name="seer",
            event_name="root_cause_started",
            organization_id=self.organization.id,
            payload={"test": "data"},
        )

    @patch("sentry.features.has")
    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_all_valid_event_names(self, mock_delay, mock_features_has) -> None:
        """Test that send_seer_webhook works with all valid seer event names"""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook
        from sentry.sentry_apps.metrics import SentryAppEventType

        mock_features_has.return_value = True

        # Get all seer event types
        seer_events = [
            event_type.value.split(".", 1)[1]  # Remove "seer." prefix
            for event_type in SentryAppEventType
            if event_type.value.startswith("seer.")
        ]

        for event_name in seer_events:
            result = send_seer_webhook(
                event_name=event_name,
                organization_id=self.organization.id,
                payload={"test": "data"},
            )
            assert result == {"success": True}

        # Verify that the task was called for each valid event
        assert mock_delay.call_count == len(seer_events)

    @patch("sentry.seer.endpoints.seer_rpc.process_autofix_updates")
    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_operator_no_feature_flag(
        self, mock_broadcast, mock_process_autofix_updates
    ) -> None:
        """Slack workflows flag should not affect broadcasting the webhooks."""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        with self.feature("organizations:seer-webhooks"):
            result = send_seer_webhook(
                event_name="root_cause_completed",
                organization_id=self.organization.id,
                payload={"run_id": 123},
            )

        assert result["success"]
        mock_process_autofix_updates.assert_not_called()
        mock_broadcast.assert_called_once()

    @patch("sentry.seer.endpoints.seer_rpc.process_autofix_updates")
    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_operator(self, mock_broadcast, mock_process_autofix_updates) -> None:
        """Slack workflows flag should not affect broadcasting the webhooks."""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        event_payload = {"run_id": 123}
        event_name = "root_cause_completed"

        with (
            self.feature("organizations:seer-webhooks"),
            self.feature("organizations:seer-slack-workflows"),
        ):
            result = send_seer_webhook(
                event_name=event_name,
                organization_id=self.organization.id,
                payload=event_payload,
            )

        assert result["success"]
        mock_process_autofix_updates.apply_async.assert_called_once_with(
            kwargs={
                "run_id": event_payload["run_id"],
                "event_type": SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
                "event_payload": event_payload,
            },
        )
        mock_broadcast.assert_called_once()

    def test_check_repository_integrations_status_empty_list(self) -> None:
        """Test with empty input list"""
        result = check_repository_integrations_status(repository_integrations=[])
        assert result == {"integration_ids": []}

    def test_check_repository_integrations_status_single_existing_repo(self) -> None:
        """Test when a single repository exists and is active"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "123",
                    "provider": "github",
                }
            ]
        )

        assert result == {"integration_ids": [integration.id]}

    def test_check_repository_integrations_status_single_non_existing_repo(self) -> None:
        """Test when repository does not exist"""
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": 999,
                    "external_id": "nonexistent",
                    "provider": "github",
                }
            ]
        )

        assert result == {"integration_ids": [None]}

    def test_check_repository_integrations_status_mixed_existing_and_non_existing(self) -> None:
        """Test with a mix of existing and non-existing repositories (integration_id ignored)"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create two repositories
        Repository.objects.create(
            name="test/repo1",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )
        Repository.objects.create(
            name="test/repo2",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        # Check 3 repos: 2 exist, 1 doesn't
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "123",
                    "provider": "github",
                },  # exists
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "999",
                    "provider": "github",
                },  # doesn't exist
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "456",
                    "provider": "github",
                },  # exists
            ]
        )

        assert result == {
            "integration_ids": [integration.id, None, integration.id],
        }

    def test_check_repository_integrations_status_inactive_repo(self) -> None:
        """Test that inactive repositories are not matched"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create a repository with DISABLED status
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.DISABLED,
            integration_id=integration.id,
        )

        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "123",
                    "provider": "github",
                }
            ]
        )

        assert result == {"integration_ids": [None]}

    def test_check_repository_integrations_status_wrong_organization_id(self) -> None:
        """Test that repositories from different organizations are not matched"""
        org2 = self.create_organization(owner=self.user)
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create repository in org1
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        # Try to find it with org2's ID
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": org2.id,
                    "integration_id": integration.id,
                    "external_id": "123",
                    "provider": "github",
                }
            ]
        )

        assert result == {"integration_ids": [None]}

    def test_check_repository_integrations_status_wrong_integration_id(self) -> None:
        """Test that integration_id in request is ignored - only (org, provider, external_id) matter"""
        integration1 = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )
        integration2 = self.create_integration(
            organization=self.organization, provider="github", external_id="github:2"
        )

        # Create repository with integration1
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration1.id,
        )

        # Query with integration2's ID - should still find the repo and return integration1's ID
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration2.id,  # Different from DB, but ignored
                    "external_id": "123",
                    "provider": "github",
                }
            ]
        )

        # Should find the repo and return the ACTUAL integration_id from the database
        assert result == {"integration_ids": [integration1.id]}

    def test_check_repository_integrations_status_wrong_external_id(self) -> None:
        """Test that repositories with different external_id are not matched"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create repository with external_id="123"
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        # Try to find it with external_id="456"
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "456",
                    "provider": "github",
                }
            ]
        )

        assert result == {"integration_ids": [None]}

    def test_check_repository_integrations_status_multiple_all_exist(self) -> None:
        """Test when all queried repositories exist"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create 3 repositories
        Repository.objects.create(
            name="test/repo1",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="111",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )
        Repository.objects.create(
            name="test/repo2",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="222",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )
        Repository.objects.create(
            name="test/repo3",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="333",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "111",
                    "provider": "github",
                },
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "222",
                    "provider": "github",
                },
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "333",
                    "provider": "github",
                },
            ]
        )

        assert result == {
            "integration_ids": [integration.id, integration.id, integration.id],
        }

    def test_check_repository_integrations_status_multiple_orgs(self) -> None:
        """Test with repositories from multiple organizations"""
        org2 = self.create_organization(owner=self.user)
        integration1 = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )
        integration2 = self.create_integration(
            organization=org2, provider="github", external_id="github:2"
        )

        # Create repository in org1
        Repository.objects.create(
            name="test/repo1",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration1.id,
        )

        # Create repository in org2
        Repository.objects.create(
            name="test/repo2",
            organization_id=org2.id,
            provider="integrations:github",
            external_id="456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration2.id,
        )

        # Check both repositories
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration1.id,
                    "external_id": "123",
                    "provider": "github",
                },
                {
                    "organization_id": org2.id,
                    "integration_id": integration2.id,
                    "external_id": "456",
                    "provider": "github",
                },
            ]
        )

        assert result == {
            "integration_ids": [integration1.id, integration2.id],
        }

    def test_check_repository_integrations_status_unsupported_provider(self) -> None:
        """Test that repositories with unsupported providers are not matched"""
        integration = self.create_integration(
            organization=self.organization, provider="gitlab", external_id="gitlab:1"
        )

        # Create repository with unsupported provider (GitLab)
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:gitlab",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        # Try to find it - should return False because GitLab is not in SEER_SUPPORTED_SCM_PROVIDERS
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": integration.id,
                    "external_id": "123",
                    "provider": "gitlab",
                }
            ]
        )

        assert result == {"integration_ids": [None]}

    def test_check_repository_integrations_status_mixed_supported_and_unsupported_providers(
        self,
    ) -> None:
        """Test with a mix of supported and unsupported provider repositories"""
        github_integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )
        gitlab_integration = self.create_integration(
            organization=self.organization, provider="gitlab", external_id="gitlab:1"
        )

        # Create GitHub repository (supported)
        Repository.objects.create(
            name="test/repo-github",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="111",
            status=ObjectStatus.ACTIVE,
            integration_id=github_integration.id,
        )

        # Create GitLab repository (unsupported)
        Repository.objects.create(
            name="test/repo-gitlab",
            organization_id=self.organization.id,
            provider="integrations:gitlab",
            external_id="222",
            status=ObjectStatus.ACTIVE,
            integration_id=gitlab_integration.id,
        )

        # Check both - GitHub should be found, GitLab should not
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": github_integration.id,
                    "external_id": "111",
                    "provider": "github",
                },  # GitHub - supported
                {
                    "organization_id": self.organization.id,
                    "integration_id": gitlab_integration.id,
                    "external_id": "222",
                    "provider": "gitlab",
                },  # GitLab - unsupported
            ]
        )

        assert result == {
            "integration_ids": [github_integration.id, None],
        }

    def test_check_repository_integrations_status_integration_id_as_string(self) -> None:
        """Test that integration_id as string is properly handled (type mismatch)"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create repository with integration_id as integer
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        # Query with integration_id as string (like from Seer)
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": str(integration.id),  # String instead of int
                    "external_id": "123",
                    "provider": "github",
                }
            ]
        )

        assert result == {"integration_ids": [integration.id]}

    def test_check_repository_integrations_status_integration_id_none(self) -> None:
        """Test that integration_id=None is ignored in matching"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create repository with an integration_id
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        # Query with integration_id=None should still match by org_id, provider, external_id
        # and return the actual integration_id from the database
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "integration_id": None,
                    "external_id": "456",
                    "provider": "github",
                }
            ]
        )

        assert result == {"integration_ids": [integration.id]}

    def test_check_repository_integrations_status_no_integration_id_in_request(self) -> None:
        """Test that integration_id is completely optional - Seer doesn't need to send it"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        # Create repository with an integration_id
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="789",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        # Query WITHOUT integration_id field at all - should still match and return it
        result = check_repository_integrations_status(
            repository_integrations=[
                {
                    "organization_id": self.organization.id,
                    "external_id": "789",
                    "provider": "github",
                    # No integration_id field at all
                }
            ]
        )

        assert result == {"integration_ids": [integration.id]}

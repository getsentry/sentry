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
from sentry.models.repository import Repository
from sentry.seer.endpoints.seer_rpc import (
    check_repository_integrations_status,
    generate_request_signature,
    get_attributes_for_span,
    get_github_enterprise_integration_config,
    validate_repo,
)
from sentry.seer.explorer.tools import get_trace_item_attributes
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded

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

    def test_snuba_rate_limit_returns_429(self) -> None:
        """Test that SnubaRPCRateLimitExceeded returns 429 to Seer for retry."""
        path = self._get_path("get_trace_waterfall")
        data: dict[str, Any] = {
            "args": {"trace_id": "abc123", "organization_id": 1},
            "meta": {},
        }

        with patch(
            "sentry.seer.endpoints.seer_rpc.SeerRpcServiceEndpoint._dispatch_to_local_method"
        ) as mock_dispatch:
            mock_dispatch.side_effect = SnubaRPCRateLimitExceeded("Rate limit exceeded")

            response = self.client.post(
                path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
            )

        assert response.status_code == 429
        assert "Rate limit exceeded" in response.data["detail"]


class TestSeerRpcMethods(APITestCase):
    """Test individual RPC methods"""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)

    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog: pytest.LogCaptureFixture):
        self._caplog = caplog

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

        with (
            self.feature("organizations:seer-webhooks"),
            patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=True),
        ):
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
            patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=True),
        ):
            result = send_seer_webhook(
                event_name=event_name,
                organization_id=self.organization.id,
                payload=event_payload,
            )

        assert result["success"]
        mock_process_autofix_updates.apply_async.assert_called_once_with(
            kwargs={
                "event_type": SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
                "event_payload": event_payload,
                "organization_id": self.organization.id,
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

    def test_validate_repo_valid(self) -> None:
        """Test when repository exists and matches all fields"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": True, "integration_id": integration.id}

    def test_validate_repo_valid_with_integrations_prefix(self) -> None:
        """Test when provider is passed with integrations: prefix"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": True, "integration_id": integration.id}

    def test_validate_repo_not_found(self) -> None:
        """Test when repository does not exist"""
        result = validate_repo(
            organization_id=self.organization.id,
            provider="github",
            external_id="nonexistent",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": False, "reason": "repository_not_found"}

    def test_validate_repo_wrong_org_id(self) -> None:
        """Test that wrong organization_id returns not found (IDOR prevention)"""
        org2 = self.create_organization(owner=self.user)
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=org2.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": False, "reason": "repository_not_found"}

    def test_validate_repo_wrong_owner(self) -> None:
        """Test that wrong owner returns not found"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="wrong-owner",
            name="sentry",
        )

        assert result == {"valid": False, "reason": "repository_not_found"}

    def test_validate_repo_wrong_name(self) -> None:
        """Test that wrong name returns not found"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="wrong-name",
        )

        assert result == {"valid": False, "reason": "repository_not_found"}

    def test_validate_repo_wrong_external_id(self) -> None:
        """Test that wrong external_id returns not found"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="github",
            external_id="wrong-external-id",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": False, "reason": "repository_not_found"}

    def test_validate_repo_inactive(self) -> None:
        """Test that inactive repository returns not found"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.DISABLED,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": False, "reason": "repository_not_found"}

    def test_validate_repo_unsupported_provider(self) -> None:
        """Test that unsupported provider returns appropriate error"""
        integration = self.create_integration(
            organization=self.organization, provider="gitlab", external_id="gitlab:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:gitlab",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="gitlab",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": False, "reason": "unsupported_provider"}

    def test_validate_repo_no_integration_id(self) -> None:
        """Test when repository has no integration_id set"""
        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=None,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result == {"valid": True, "integration_id": None}

    def test_validate_repo_github_enterprise(self) -> None:
        """Test that github_enterprise provider works correctly"""
        integration = self.create_integration(
            organization=self.organization, provider="github_enterprise", external_id="ghe:1"
        )

        Repository.objects.create(
            name="mycompany/internal-repo",
            organization_id=self.organization.id,
            provider="integrations:github_enterprise",
            external_id="789",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = validate_repo(
            organization_id=self.organization.id,
            provider="github_enterprise",
            external_id="789",
            owner="mycompany",
            name="internal-repo",
        )

        assert result == {"valid": True, "integration_id": integration.id}

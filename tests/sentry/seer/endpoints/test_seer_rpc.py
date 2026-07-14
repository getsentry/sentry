import logging
from datetime import datetime, timezone
from time import time
from typing import Any
from unittest.mock import patch

import orjson
import pytest
import requests.exceptions
import responses
from cryptography.fernet import Fernet
from django.test import override_settings
from django.urls import reverse
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsResponse

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.pullrequest import PullRequestAttribution, PullRequestAttributionSignalType
from sentry.models.repository import Repository
from sentry.seer.endpoints.seer_rpc import (
    generate_request_signature,
    get_attributes_for_span,
    get_github_enterprise_integration_config,
    get_monitoring_provider_connections,
    get_organization_features,
    get_project_preferences,
    get_repo_installation_id,
    has_repo_code_mappings,
    record_pr_attribution,
    refresh_monitoring_provider_token,
)
from sentry.seer.sentry_data_models import (
    GitHubEnterpriseConfigErrorResponse,
    GitHubEnterpriseConfigSuccessResponse,
    PrAttributionResponse,
    SendSeerWebhookSuccessResponse,
)
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode_of, cell_silo_test
from sentry.users.models.identity import Identity
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

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

    def test_get_organization_features_registered_on_internal_rpc(self) -> None:
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 200
        assert "features" in response.data
        assert isinstance(response.data["features"], list)

    def test_get_organization_projects_registered_on_internal_rpc(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        path = self._get_path("get_organization_projects")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 200
        assert "projects" in response.data
        assert project.id in [p["id"] for p in response.data["projects"]]

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

    def test_rest_framework_exceptions_are_reraised(self) -> None:
        """Test that REST framework exceptions preserve their status codes."""
        from rest_framework.exceptions import APIException

        class CustomAPIException(APIException):
            status_code = 503
            default_detail = "Service temporarily unavailable"

        path = self._get_path("get_organization_slug")
        data: dict[str, Any] = {"args": {"org_id": 1}, "meta": {}}

        with patch(
            "sentry.seer.endpoints.seer_rpc.SeerRpcServiceEndpoint._dispatch_to_local_method"
        ) as mock_dispatch:
            mock_dispatch.side_effect = CustomAPIException()

            response = self.client.post(
                path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
            )

        assert response.status_code == 503
        assert "Service temporarily unavailable" in response.data["detail"]

    def test_generic_exceptions_return_500(self) -> None:
        """Test that generic exceptions return 500 instead of 400."""
        path = self._get_path("get_organization_slug")
        data: dict[str, Any] = {"args": {"org_id": 1}, "meta": {}}

        for is_test_environment in [True, False]:
            with patch(
                "sentry.seer.endpoints.seer_rpc.in_test_environment",
                return_value=is_test_environment,
            ):
                with patch(
                    "sentry.seer.endpoints.seer_rpc.SeerRpcServiceEndpoint._dispatch_to_local_method"
                ) as mock_dispatch:
                    mock_dispatch.side_effect = RuntimeError("Unexpected internal error")

                    response = self.client.post(
                        path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
                    )

                assert response.status_code == 500


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

        assert len(result.attributes) == 1
        span_attribute = result.attributes[0]
        assert span_attribute.type == "str"
        assert span_attribute.value == "example"
        assert span_attribute.name in {"span.description", "tags[span.description,string]"}
        mock_rpc.assert_called_once()

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

        assert isinstance(result, GitHubEnterpriseConfigSuccessResponse)
        assert result.base_url == "https://github.example.org/api/v3"
        assert result.verify_ssl
        assert result.encrypted_access_token
        assert result.permissions == {
            "administration": "read",
            "contents": "read",
            "issues": "write",
            "metadata": "read",
            "pull_requests": "read",
        }

        # Test that the access token is encrypted correctly
        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        decrypted_access_token = fernet.decrypt(
            result.encrypted_access_token.encode("utf-8")
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

        assert isinstance(result, GitHubEnterpriseConfigErrorResponse)
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

        assert isinstance(result, GitHubEnterpriseConfigErrorResponse)
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

        assert isinstance(result, GitHubEnterpriseConfigErrorResponse)
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

        assert isinstance(result, GitHubEnterpriseConfigErrorResponse)
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

        assert result.dict() == {
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

        assert result.dict() == {
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

        assert result.dict() == {
            "success": False,
            "error": "Organization not found or not active",
        }

    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_success(self, mock_delay) -> None:
        """Test that send_seer_webhook successfully enqueues webhook when all conditions are met"""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        result = send_seer_webhook(
            event_name="root_cause_started",
            organization_id=self.organization.id,
            payload={"test": "data"},
        )

        assert result.dict() == {"success": True}
        mock_delay.assert_called_once_with(
            resource_name="seer",
            event_name="root_cause_started",
            organization_id=self.organization.id,
            payload={"test": "data"},
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_all_valid_event_names(self, mock_delay) -> None:
        """Test that send_seer_webhook works with all valid seer event names"""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook
        from sentry.sentry_apps.event_types import SentryAppEventType

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
            assert result.dict() == {"success": True}

        # Verify that the task was called for each valid event
        assert mock_delay.call_count == len(seer_events)

    @patch("sentry.seer.endpoints.seer_rpc.process_autofix_updates")
    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_operator_no_feature_flag(
        self, mock_broadcast, mock_process_autofix_updates
    ) -> None:
        """Slack workflows flag should not affect broadcasting the webhooks."""
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        with patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=True):
            result = send_seer_webhook(
                event_name="root_cause_completed",
                organization_id=self.organization.id,
                payload={"run_id": 123},
            )

        assert isinstance(result, SendSeerWebhookSuccessResponse)
        mock_process_autofix_updates.assert_not_called()
        mock_broadcast.assert_called_once()

    @patch("sentry.seer.endpoints.seer_rpc.process_autofix_updates")
    @patch("sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization.delay")
    def test_send_seer_webhook_operator(self, mock_broadcast, mock_process_autofix_updates) -> None:
        from sentry.seer.endpoints.seer_rpc import send_seer_webhook

        event_payload = {"run_id": 123}
        event_name = "root_cause_completed"

        with patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=True):
            result = send_seer_webhook(
                event_name=event_name,
                organization_id=self.organization.id,
                payload=event_payload,
            )

        assert isinstance(result, SendSeerWebhookSuccessResponse)
        mock_process_autofix_updates.apply_async.assert_called_once_with(
            kwargs={
                "event_type": SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
                "event_payload": event_payload,
                "organization_id": self.organization.id,
            },
        )
        mock_broadcast.assert_called_once()

    def test_has_repo_code_mappings_repo_not_found(self) -> None:
        """Test when repository does not exist"""
        result = has_repo_code_mappings(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="nonexistent",
            owner="nonexistent",
            name="nonexistent",
        )
        assert result.dict() == {"has_code_mappings": False, "project_slug_to_id": {}}

    def test_has_repo_code_mappings_no_mappings(self) -> None:
        """Test when repository exists but has no code mappings"""
        Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            status=ObjectStatus.ACTIVE,
        )

        result = has_repo_code_mappings(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
            owner="test",
            name="repo",
        )
        assert result.dict() == {"has_code_mappings": False, "project_slug_to_id": {}}

    def test_has_repo_code_mappings_with_mappings(self) -> None:
        """Test when repository exists and has code mappings"""
        project = self.create_project(organization=self.organization)
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )
        org_integration = integration.organizationintegration_set.first()
        assert org_integration is not None

        repo = Repository.objects.create(
            name="test/repo",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="456",
            status=ObjectStatus.ACTIVE,
        )

        project_repo, _ = ProjectRepository.objects.get_or_create(
            project=project,
            repository=repo,
            defaults={"source": ProjectRepositorySource.MANUAL},
        )
        RepositoryProjectPathConfig.objects.create(
            organization_integration_id=org_integration.id,
            integration_id=org_integration.integration_id,
            organization_id=self.organization.id,
            stack_root="/",
            source_root="/",
            project_repository=project_repo,
        )

        result = has_repo_code_mappings(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="456",
            owner="test",
            name="repo",
        )
        assert result.dict() == {
            "has_code_mappings": True,
            "project_slug_to_id": {project.slug: project.id},
        }

    def test_get_repo_installation_id_github(self) -> None:
        """Test returns external_id as installation_id for GitHub repos"""
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="12345"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = get_repo_installation_id(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result.dict() == {"installation_id": "12345", "permissions": None}

    def test_get_repo_installation_id_github_with_permissions(self) -> None:
        """Test returns permissions from integration metadata"""
        permissions = {"contents": "read", "issues": "write", "pull_requests": "read"}
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="12345",
            metadata={"permissions": permissions},
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = get_repo_installation_id(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result.dict() == {"installation_id": "12345", "permissions": permissions}

    def test_get_repo_installation_id_github_enterprise(self) -> None:
        """Test returns metadata installation_id for GitHub Enterprise repos"""
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            external_id="ghe:1",
            metadata={"installation_id": "99999"},
        )

        Repository.objects.create(
            name="mycompany/internal-repo",
            organization_id=self.organization.id,
            provider="integrations:github_enterprise",
            external_id="789",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = get_repo_installation_id(
            organization_id=self.organization.id,
            provider="github_enterprise",
            external_id="789",
            owner="mycompany",
            name="internal-repo",
        )

        assert result.dict() == {"installation_id": "99999", "permissions": None}

    def test_get_repo_installation_id_not_found(self) -> None:
        """Test returns error when repository does not exist"""
        result = get_repo_installation_id(
            organization_id=self.organization.id,
            provider="github",
            external_id="nonexistent",
            owner="getsentry",
            name="sentry",
        )

        assert result.dict() == {"error": "repository_not_found"}

    def test_get_repo_installation_id_unsupported_provider(self) -> None:
        """Test returns error for unsupported provider"""
        integration = self.create_integration(
            organization=self.organization, provider="gitlab", external_id="gitlab:1"
        )

        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="gitlab",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = get_repo_installation_id(
            organization_id=self.organization.id,
            provider="gitlab",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result.dict() == {"error": "unsupported_provider"}

    def test_get_repo_installation_id_no_integration(self) -> None:
        """Test returns error when repo has no integration_id"""
        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=None,
        )

        result = get_repo_installation_id(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result.dict() == {"error": "no_integration"}

    def test_get_repo_installation_id_integration_not_found(self) -> None:
        """Test returns error when integration record doesn't exist"""
        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123456",
            status=ObjectStatus.ACTIVE,
            integration_id=999999,
        )

        result = get_repo_installation_id(
            organization_id=self.organization.id,
            provider="github",
            external_id="123456",
            owner="getsentry",
            name="sentry",
        )

        assert result.dict() == {"error": "integration_not_found"}

    def test_get_project_preferences_returns_preference(self) -> None:
        project = self.create_project(organization=self.organization)
        repo = self.create_repo(
            project=project,
            provider="integrations:github",
            external_id="123",
            name="getsentry/sentry",
        )
        self.create_seer_project_repository(project=project, repository=repo)

        result = get_project_preferences(
            organization_id=self.organization.id,
            project_id=project.id,
        )

        assert result.project_id == project.id
        assert result.organization_id == self.organization.id
        assert len(result.repositories) == 1
        assert result.repositories[0].external_id == "123"
        assert result.repositories[0].name == "sentry"

    def test_get_project_preferences_returns_default_when_no_preference(self) -> None:
        project = self.create_project(organization=self.organization)
        result = get_project_preferences(
            organization_id=self.organization.id, project_id=project.id
        )
        assert result.project_id == project.id
        assert result.organization_id == self.organization.id
        assert result.repositories == []
        assert result.automated_run_stopping_point == "code_changes"
        assert result.automation_handoff is None

    def test_get_project_preferences_raises_for_nonexistent_project(self) -> None:
        with pytest.raises(Project.DoesNotExist):
            get_project_preferences(
                organization_id=self.organization.id,
                project_id=999999,
            )

    def test_get_project_preferences_raises_for_wrong_org(self) -> None:
        project = self.create_project(organization=self.organization)
        other_org = self.create_organization(owner=self.user)
        with pytest.raises(Project.DoesNotExist):
            get_project_preferences(
                organization_id=other_org.id,
                project_id=project.id,
            )


# Two real api_expose=True flags used as a controlled feature set for
# get_organization_features tests. Mocking features.all to this subset keeps
# each test deterministic instead of iterating all 100+ registered flags.
_ORG_FEATURES_TEST_SET = {
    "organizations:seer-agent-source-code-search": object(),
    "organizations:seer-explorer-chat-coding": object(),
}


class TestGetOrganizationFeatures(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.endpoints.seer_rpc.features.all", return_value=_ORG_FEATURES_TEST_SET)
    def test_returns_active_flags_without_prefix(self, _mock_all: object) -> None:
        with self.feature("organizations:seer-agent-source-code-search"):
            result = get_organization_features(org_id=self.organization.id)
        assert result.dict() == {"features": ["seer-agent-source-code-search"]}

    @patch("sentry.seer.endpoints.seer_rpc.features.all", return_value=_ORG_FEATURES_TEST_SET)
    def test_excludes_inactive_flags(self, _mock_all: object) -> None:
        result = get_organization_features(org_id=self.organization.id)
        assert result.dict() == {"features": []}

    @patch("sentry.seer.endpoints.seer_rpc.features.all", return_value=_ORG_FEATURES_TEST_SET)
    def test_returns_sorted_list(self, _mock_all: object) -> None:
        with self.feature(
            {
                "organizations:seer-agent-source-code-search": True,
                "organizations:seer-explorer-chat-coding": True,
            }
        ):
            result = get_organization_features(org_id=self.organization.id)
        # "seer-agent-..." < "seer-explorer-..." alphabetically
        assert result.dict() == {
            "features": ["seer-agent-source-code-search", "seer-explorer-chat-coding"]
        }

    def test_org_not_found_returns_empty(self) -> None:
        result = get_organization_features(org_id=0)
        assert result.dict() == {"features": []}

    @patch("sentry.seer.endpoints.seer_rpc.features.all", return_value=_ORG_FEATURES_TEST_SET)
    def test_uses_user_as_actor_when_provided(self, _mock_all: object) -> None:
        with self.feature("organizations:seer-agent-source-code-search"):
            result = get_organization_features(org_id=self.organization.id, user_id=self.user.id)
        assert result.dict() == {"features": ["seer-agent-source-code-search"]}

    @patch("sentry.seer.endpoints.seer_rpc.features.all", return_value=_ORG_FEATURES_TEST_SET)
    def test_unknown_user_id_falls_back_to_no_actor(self, _mock_all: object) -> None:
        with self.feature("organizations:seer-agent-source-code-search"):
            result = get_organization_features(org_id=self.organization.id, user_id=0)
        assert result.dict() == {"features": ["seer-agent-source-code-search"]}


@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
@with_feature("organizations:seer-infra-telemetry")
@cell_silo_test
class TestGetMonitoringProviderConnections(APITestCase):
    def test_returns_connections(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-uuid-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result = get_monitoring_provider_connections(
            organization_id=self.organization.id, user_id=self.user.id
        )

        assert len(result.connections) == 1
        connection = result.connections[0]
        assert connection.provider_key == "datadog"
        assert connection.url == "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"
        assert connection.identity_id == identity.id
        assert connection.auth_method == "oauth"
        decrypted = Fernet(TEST_FERNET_KEY.encode("utf-8")).decrypt(
            connection.encrypted_access_token.encode("utf-8")
        )
        assert decrypted.decode("utf-8") == "access-token"

    def test_unknown_organization_returns_empty(self) -> None:
        result = get_monitoring_provider_connections(organization_id=999999, user_id=self.user.id)

        assert result.connections == []

    def test_non_member_returns_empty(self) -> None:
        other_org = self.create_organization()
        idp = self.create_identity_provider(type="datadog", external_id="org-uuid-2")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-2",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )

        result = get_monitoring_provider_connections(
            organization_id=other_org.id, user_id=self.user.id
        )

        assert result.connections == []


@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
@cell_silo_test
class TestRefreshMonitoringProviderToken(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.idp = self.create_identity_provider(type="datadog", external_id="datadog-ext-r")
        self.identity = self.create_identity(
            user=self.user,
            identity_provider=self.idp,
            external_id="dd-user-uuid",
            data={
                "access_token": "old-tok",
                "refresh_token": "ref-456",
                "client_id": "dcr-cid",
                "client_secret": "dcr-csec",
                "site": "datadoghq.com",
                "expires": int(time()) + 3600,
            },
        )

    def _save_identity(self) -> None:
        with assume_test_silo_mode_of(Identity):
            self.identity.save()

    @responses.activate
    def test_success(self) -> None:
        responses.add(
            responses.POST,
            "https://mcp.datadoghq.com/api/unstable/mcp-server/token",
            json={
                "access_token": "new-access-token",
                "refresh_token": "refresh-token",
                "expires_in": 3600,
            },
        )

        result = refresh_monitoring_provider_token(identity_id=self.identity.id)

        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        decrypted_access_token = fernet.decrypt(
            result["encrypted_access_token"].encode("utf-8")
        ).decode("utf-8")

        assert decrypted_access_token == "new-access-token"
        assert result["expires"] is not None
        assert len(responses.calls) == 1

    @responses.activate
    @override_settings(SEER_GHE_ENCRYPT_KEY=None)
    def test_missing_encrypt_key(self) -> None:
        responses.add(
            responses.POST,
            "https://mcp.datadoghq.com/api/unstable/mcp-server/token",
            json={
                "access_token": "new-access-token",
                "refresh_token": "refresh-token",
                "expires_in": 3600,
            },
        )

        result = refresh_monitoring_provider_token(identity_id=self.identity.id)

        assert result == {"error": "encryption_failed"}
        assert len(responses.calls) == 0

    def test_identity_not_found(self) -> None:
        result = refresh_monitoring_provider_token(identity_id=999999)

        assert result == {"error": "identity_not_found"}

    def test_missing_refresh_token(self) -> None:
        self.identity.data.pop("refresh_token", None)
        self._save_identity()

        result = refresh_monitoring_provider_token(identity_id=self.identity.id)

        assert result == {"error": "identity_not_valid"}

    @responses.activate
    def test_api_error(self) -> None:
        responses.add(
            responses.POST,
            "https://mcp.datadoghq.com/api/unstable/mcp-server/token",
            json={"error": "server_error"},
            status=500,
        )

        result = refresh_monitoring_provider_token(identity_id=self.identity.id)

        assert result == {"error": "refresh_failed"}

    @responses.activate
    def test_malformed_response(self) -> None:
        responses.add(
            responses.POST,
            "https://mcp.datadoghq.com/api/unstable/mcp-server/token",
            json={"not_access_token": "oops"},
        )

        result = refresh_monitoring_provider_token(identity_id=self.identity.id)

        assert result == {"error": "refresh_failed"}

    @responses.activate
    def test_connection_error(self) -> None:
        responses.add(
            responses.POST,
            "https://mcp.datadoghq.com/api/unstable/mcp-server/token",
            body=requests.exceptions.ConnectionError("Connection refused"),
        )

        result = refresh_monitoring_provider_token(identity_id=self.identity.id)

        assert result == {"error": "refresh_failed"}

    @responses.activate
    def test_missing_access_token_after_refresh(self) -> None:
        responses.add(
            responses.POST,
            "https://mcp.datadoghq.com/api/unstable/mcp-server/token",
            json={"refresh_token": "ref-456", "expires_in": 3600},
        )

        result = refresh_monitoring_provider_token(identity_id=self.identity.id)

        # Not "identity_not_valid" due to KeyError from get_oauth_data before reaching the .get() guard
        assert result == {"error": "refresh_failed"}

    def test_pat_provider_not_refreshable(self) -> None:
        # Static-token providers (Datadog PAT) have no refresh flow.
        pat_idp = self.create_identity_provider(type="datadog_pat", external_id="dd-org-pat")
        pat_identity = self.create_identity(
            user=self.user,
            identity_provider=pat_idp,
            external_id="dd-user-pat",
            data={"access_token": "pat-tok", "site": "datadoghq.com"},
        )

        result = refresh_monitoring_provider_token(identity_id=pat_identity.id)

        assert result == {"error": "refresh_not_supported"}


@with_feature("organizations:pr-metrics-attribution")
@cell_silo_test
class TestRecordPrAttribution(APITestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="1")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="10",
        )

    _DEFAULT_PR_URL = "https://github.com/getsentry/sentry/pull/99"

    def _call(self, **overrides: Any) -> PrAttributionResponse:
        kwargs: dict[str, Any] = {
            "organization_id": self.organization.id,
            "pull_request_id": self.pr.id,
            "signal_type": PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
            "signal_details": {"pr_url": self._DEFAULT_PR_URL},
        }
        kwargs.update(overrides)
        return record_pr_attribution(**kwargs)

    def test_creates_attribution(self) -> None:
        result = self._call()

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_type == PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE
        assert attr.is_valid is True
        assert result.attribution_id == attr.id

    def test_stores_typed_signal_details_for_delegated_signals(self) -> None:
        self._call(
            signal_details={
                "agent_id": "agent-abc-123",
                "pr_url": self._DEFAULT_PR_URL,
                "run_id": 42,
            }
        )

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_details == {
            "agent_id": "agent-abc-123",
            "pr_url": self._DEFAULT_PR_URL,
            "run_id": 42,
        }

    def test_delegated_signal_details_defaults_nullable_fields(self) -> None:
        self._call(signal_details={"pr_url": self._DEFAULT_PR_URL})

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_details == {
            "agent_id": None,
            "pr_url": self._DEFAULT_PR_URL,
            "run_id": None,
        }

    def test_invalid_delegated_signal_details_raises(self) -> None:
        from rest_framework.exceptions import ParseError

        with pytest.raises(ParseError):
            self._call(signal_details={"agent_id": "x"})  # missing required pr_url

    def test_no_signal_details_for_non_delegated_type_leaves_null(self) -> None:
        self._call(
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            signal_details=None,
        )

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_details is None

    def test_idempotent_on_repeat_call(self) -> None:
        result1 = self._call()
        result2 = self._call()

        assert result1 == result2
        assert PullRequestAttribution.objects.filter(pull_request=self.pr).count() == 1

    def test_invalid_signal_type_raises(self) -> None:
        from rest_framework.exceptions import ParseError

        with pytest.raises(ParseError):
            self._call(signal_type="not_a_real_signal")

    def test_org_not_found_raises(self) -> None:
        from django.core.exceptions import ObjectDoesNotExist

        with pytest.raises(ObjectDoesNotExist):
            self._call(organization_id=999999)

    def test_pr_not_found_raises(self) -> None:
        from django.core.exceptions import ObjectDoesNotExist

        with pytest.raises(ObjectDoesNotExist):
            self._call(pull_request_id=999999)

    def test_pr_from_different_org_raises(self) -> None:
        from django.core.exceptions import ObjectDoesNotExist

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(
            other_project, provider="integrations:github", external_id="2"
        )
        other_pr = self.create_pull_request(
            repository_id=other_repo.id,
            organization_id=other_org.id,
            key="20",
        )

        with pytest.raises(ObjectDoesNotExist):
            self._call(pull_request_id=other_pr.id)

    def test_feature_disabled_returns_null_attribution_id(self) -> None:
        with self.feature({"organizations:pr-metrics-attribution": False}):
            result = self._call()

        assert result == {"attribution_id": None}
        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()


@override_settings(SEER_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
@override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
class TestSeerRpcViewerContextAuth(APITestCase):
    """The Seer RPC endpoint accepts a signed X-Viewer-Context JWT as a co-equal
    credential to the HMAC Rpcsignature."""

    @staticmethod
    def _get_path(method_name: str) -> str:
        return reverse(
            "sentry-api-0-seer-rpc-service",
            kwargs={"method_name": method_name},
        )

    def _hmac_header(self, path: str, data: dict[str, Any]) -> str:
        body = orjson.dumps(data).decode()
        return f"rpcsignature {generate_request_signature(path, body.encode())}"

    def _vc_header(self, *, organization_id: int | None, user_id: int | None = None) -> str:
        vc = ViewerContext(
            organization_id=organization_id,
            user_id=user_id,
            actor_type=ActorType.USER,
        )
        return encode_viewer_context(vc)

    def test_org_only_viewer_context_authenticates(self) -> None:
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=org.id),
        )
        assert response.status_code == 200
        assert "features" in response.data

    def test_org_less_viewer_context_is_rejected(self) -> None:
        # A validly-signed but org-less viewer context carries no org to enforce
        # against, so it must not authenticate on signature alone. Every seer RPC
        # call acts on behalf of an organization.
        org = self.create_organization(owner=self.user)
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=None, user_id=self.user.id),
        )
        assert response.status_code == 403

    def test_org_only_viewer_context_scopes_to_the_arg_org(self) -> None:
        # An org-only viewer context (no user_id — e.g. an org background job or,
        # later, a service-account viewer) must dispatch and return data scoped to
        # the org passed in args. org_id reaches the method via request args, not
        # auth, so filtering is unchanged; the org-binding guard only requires the
        # arg org to equal the signed context's org.
        org = self.create_organization()
        project = self.create_project(organization=org)
        other_org = self.create_organization()
        self.create_project(organization=other_org)

        path = self._get_path("get_organization_projects")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=org.id),
        )
        assert response.status_code == 200
        returned_ids = {p["id"] for p in response.data["projects"]}
        assert returned_ids == {project.id}

    def test_user_scoped_viewer_context_authenticates(self) -> None:
        org = self.create_organization(owner=self.user)
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=org.id, user_id=self.user.id),
        )
        assert response.status_code == 200

    def test_invalid_viewer_context_signature_denied(self) -> None:
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT="invalid.jwt.token",
        )
        assert response.status_code == 403

    def test_no_credentials_denied(self) -> None:
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(path, data=data)
        assert response.status_code == 403

    def test_malformed_org_id_arg_is_bad_request_not_server_error(self) -> None:
        # A non-numeric org_id on the viewer-context path must 400, not 500 —
        # the org-binding guard coerces caller-supplied input defensively.
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": "not-a-number"}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=org.id),
        )
        assert response.status_code == 400

    def test_hmac_only_still_authenticates(self) -> None:
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_AUTHORIZATION=self._hmac_header(path, data),
        )
        assert response.status_code == 200

    def test_hmac_takes_precedence_and_is_not_org_bound(self) -> None:
        # Valid HMAC + a viewer context scoped to a DIFFERENT org. If the viewer
        # context authenticator had won, the org-binding guard would reject the
        # mismatch (403). A 200 proves HMAC won and skipped the binding check.
        org = self.create_organization()
        other_org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_AUTHORIZATION=self._hmac_header(path, data),
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=other_org.id),
        )
        assert response.status_code == 200

    def test_hmac_works_with_empty_viewer_context_header(self) -> None:
        # Invariant: an HMAC-authenticated request behaves as it does today no
        # matter the X-Viewer-Context header. An empty header is inert — once
        # HMAC succeeds the VC authenticator is never consulted.
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_AUTHORIZATION=self._hmac_header(path, data),
            HTTP_X_VIEWER_CONTEXT="",
        )
        assert response.status_code == 200

    def test_hmac_works_with_malformed_viewer_context_header(self) -> None:
        # Same invariant: a malformed/garbage VC header does not affect an
        # HMAC-authenticated request.
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_AUTHORIZATION=self._hmac_header(path, data),
            HTTP_X_VIEWER_CONTEXT="not-a-valid-jwt",
        )
        assert response.status_code == 200

    def test_viewer_context_org_binding_matches(self) -> None:
        org = self.create_organization()
        path = self._get_path("get_organization_features")
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=org.id),
        )
        assert response.status_code == 200

    def test_viewer_context_org_binding_mismatch_denied(self) -> None:
        org = self.create_organization()
        other_org = self.create_organization()
        path = self._get_path("get_organization_features")
        # Argument targets `org`, but the signed viewer context is for `other_org`.
        data: dict[str, Any] = {"args": {"org_id": org.id}, "meta": {}}
        response = self.client.post(
            path,
            data=data,
            HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=other_org.id),
        )
        assert response.status_code == 403

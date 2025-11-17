from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from sentry.integrations.base import IntegrationError
from sentry.integrations.cursor.integration import (
    CURSOR_INTEGRATION_SECRET_FIELD,
    CursorAgentIntegration,
    CursorAgentIntegrationProvider,
)
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode_of


@pytest.fixture
def provider():
    return CursorAgentIntegrationProvider()


def test_build_integration_encrypts_metadata(provider):
    fake_uuid = UUID("11111111-2222-3333-4444-555555555555")
    with (
        patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
        patch("sentry.integrations.cursor.integration.generate_token", return_value="hook-secret"),
        override_options({"database.encryption.method": "plaintext"}),
    ):
        integration_data = provider.build_integration(state={"config": {"api_key": "cursor-api"}})

    assert integration_data["external_id"] == fake_uuid.hex
    metadata = integration_data["metadata"]
    assert "api_key" in metadata
    assert "webhook_secret" in metadata
    assert metadata["domain_name"] == "cursor.sh"
    assert metadata["api_key"] != "cursor-api"
    assert metadata["webhook_secret"] != "hook-secret"
    assert integration_data["external_id"] == fake_uuid.hex
    assert (
        CURSOR_INTEGRATION_SECRET_FIELD.to_python(metadata["api_key"]).decode("utf-8")
        == "cursor-api"
    )
    assert (
        CURSOR_INTEGRATION_SECRET_FIELD.to_python(metadata["webhook_secret"]).decode("utf-8")
        == "hook-secret"
    )


def test_build_integration_encrypts_api_key_and_webhook_secret(provider):
    """Test that build_integration encrypts both API key and webhook secret"""
    with override_options({"database.encryption.method": "plaintext"}):
        integration_data = provider.build_integration(state={"config": {"api_key": "new-api"}})

    metadata_arg = integration_data["metadata"]

    # Verify values are encrypted (not stored as plaintext)
    assert metadata_arg["api_key"] != "new-api"
    assert isinstance(metadata_arg["webhook_secret"], (str, bytes))

    # Verify encrypted values can be decrypted correctly
    assert (
        CURSOR_INTEGRATION_SECRET_FIELD.to_python(metadata_arg["api_key"]).decode("utf-8")
        == "new-api"
    )

    # Verify webhook secret was generated and encrypted
    decrypted_webhook = CURSOR_INTEGRATION_SECRET_FIELD.to_python(
        metadata_arg["webhook_secret"]
    ).decode("utf-8")
    assert decrypted_webhook  # Should be a non-empty string
    assert len(decrypted_webhook) > 0  # Webhook secret should be generated


class CursorIntegrationTest(IntegrationTestCase):
    provider = CursorAgentIntegrationProvider

    def test_build_integration(self):
        state: Mapping[str, Any] = {"config": {"api_key": "test_api_key_123"}}
        fake_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

        with (
            patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
            patch(
                "sentry.integrations.cursor.integration.generate_token", return_value="secret123"
            ),
            override_options({"database.encryption.method": "plaintext"}),
        ):
            integration_dict = self.provider().build_integration(state)

        assert integration_dict["external_id"] == fake_uuid.hex
        metadata = integration_dict["metadata"]
        assert metadata["domain_name"] == "cursor.sh"
        assert "api_key" in metadata
        assert "webhook_secret" in metadata
        assert metadata["api_key"] != "test_api_key_123"
        assert metadata["webhook_secret"] != "secret123"
        assert (
            CURSOR_INTEGRATION_SECRET_FIELD.to_python(metadata["api_key"]).decode("utf-8")
            == "test_api_key_123"
        )
        assert (
            CURSOR_INTEGRATION_SECRET_FIELD.to_python(metadata["webhook_secret"]).decode("utf-8")
            == "secret123"
        )

    def test_build_integration_missing_config(self):
        """Test that build_integration raises error when config is missing"""
        state: Mapping[str, Any] = {}

        with pytest.raises(IntegrationError, match="Missing configuration data"):
            self.provider().build_integration(state)

    def test_build_integration_empty_config(self):
        """Test that build_integration raises error when config is empty"""
        state: Mapping[str, Any] = {"config": {}}

        with pytest.raises(IntegrationError, match="Missing configuration data"):
            self.provider().build_integration(state)

    def test_get_client(self):
        with override_options({"database.encryption.method": "plaintext"}):
            metadata = {
                "api_key": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("test_api_key_123"),
                "webhook_secret": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("test_secret_123"),
                "domain_name": "cursor.sh",
            }

        integration = self.create_provider_integration(
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata=metadata,
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        client = installation.get_client()
        assert client.api_key == "test_api_key_123"
        assert client.base_url == "https://api.cursor.com"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.post")
    def test_launch(self, mock_post):
        from datetime import datetime

        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentStatus
        from sentry.seer.models import SeerRepoDefinition

        mock_response = MagicMock()
        mock_response.json = {
            "id": "test_session_123",
            "name": "Test Session",
            "status": "running",
            "createdAt": datetime.now().isoformat(),
            "source": {
                "repository": "https://github.com/testorg/testrepo",
                "ref": "main",
            },
            "target": {
                "url": "https://github.com/org/repo/pull/1",
                "autoCreatePr": True,
                "branchName": "fix-bug",
            },
        }
        mock_post.return_value = mock_response

        with override_options({"database.encryption.method": "plaintext"}):
            metadata = {
                "api_key": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("test_api_key_123"),
                "webhook_secret": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("test_secret_123"),
                "domain_name": "cursor.sh",
            }

        integration = self.create_provider_integration(
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata=metadata,
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        request = CodingAgentLaunchRequest(
            prompt="Fix the bug",
            repository=SeerRepoDefinition(
                integration_id="123",
                provider="github",
                owner="testorg",
                name="testrepo",
                external_id="456",
                branch_name="main",
            ),
            branch_name="fix-bug",
        )

        result = cast(CursorAgentIntegration, installation).launch(request=request)

        assert result.id == "test_session_123"
        assert result.status == CodingAgentStatus.RUNNING
        assert result.provider == CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
        assert result.name == "Test Session"

        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == "/v0/agents"

    def test_update_organization_config_persists_api_key_and_clears_org_config(self):
        with override_options({"database.encryption.method": "plaintext"}):
            integration = self.create_integration(
                organization=self.organization,
                provider="cursor",
                name="Cursor Agent",
                external_id="cursor",
                metadata={
                    "api_key": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("old_key"),
                    "webhook_secret": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("secret123"),
                    "domain_name": "cursor.sh",
                },
            )

        installation = integration.get_installation(organization_id=self.organization.id)

        with override_options({"database.encryption.method": "plaintext"}):
            installation.update_organization_config({"api_key": "new_secret_key"})

        integration.refresh_from_db()
        assert "api_key" in integration.metadata
        assert (
            CURSOR_INTEGRATION_SECRET_FIELD.to_python(integration.metadata["api_key"]).decode(
                "utf-8"
            )
            == "new_secret_key"
        )
        assert "webhook_secret" in integration.metadata
        assert (
            CURSOR_INTEGRATION_SECRET_FIELD.to_python(
                integration.metadata["webhook_secret"]
            ).decode("utf-8")
            == "secret123"
        )

        from sentry.integrations.models.organization_integration import OrganizationIntegration

        with assume_test_silo_mode_of(OrganizationIntegration):
            org_integration = OrganizationIntegration.objects.get(
                integration_id=integration.id, organization_id=self.organization.id
            )
            assert org_integration.config == {}

    def test_update_organization_config_missing_api_key_raises(self):
        with override_options({"database.encryption.method": "plaintext"}):
            integration = self.create_integration(
                organization=self.organization,
                provider="cursor",
                name="Cursor Agent",
                external_id="cursor",
                metadata={
                    "api_key": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("present_key"),
                    "webhook_secret": CURSOR_INTEGRATION_SECRET_FIELD.get_prep_value("secret123"),
                    "domain_name": "cursor.sh",
                },
            )

        installation = integration.get_installation(organization_id=self.organization.id)

        with pytest.raises(IntegrationError, match="API key is required"):
            installation.update_organization_config({})

    def test_build_integration_creates_unique_installations(self):
        """Test that each call to build_integration creates a unique integration"""
        state: Mapping[str, Any] = {"config": {"api_key": "test_api_key_123"}}

        with override_options({"database.encryption.method": "plaintext"}):
            integration_dict_1 = self.provider().build_integration(state)
            integration_dict_2 = self.provider().build_integration(state)
            integration_dict_3 = self.provider().build_integration(state)

        # Each integration should have a unique external_id
        external_ids = {
            integration_dict_1["external_id"],
            integration_dict_2["external_id"],
            integration_dict_3["external_id"],
        }
        assert (
            len(external_ids) == 3
        ), "Each build_integration call should create a unique external_id"

        # All should have the same basic structure
        for integration_dict in [integration_dict_1, integration_dict_2, integration_dict_3]:
            assert integration_dict["name"] == "Cursor Agent"
            assert "external_id" in integration_dict
            assert "metadata" in integration_dict
            assert integration_dict["metadata"]["domain_name"] == "cursor.sh"
            assert "api_key" in integration_dict["metadata"]
            assert "webhook_secret" in integration_dict["metadata"]

        # Each should have unique webhook secrets too
        webhook_secret_1 = CURSOR_INTEGRATION_SECRET_FIELD.to_python(
            integration_dict_1["metadata"]["webhook_secret"]
        ).decode("utf-8")
        webhook_secret_2 = CURSOR_INTEGRATION_SECRET_FIELD.to_python(
            integration_dict_2["metadata"]["webhook_secret"]
        ).decode("utf-8")
        webhook_secret_3 = CURSOR_INTEGRATION_SECRET_FIELD.to_python(
            integration_dict_3["metadata"]["webhook_secret"]
        ).decode("utf-8")

        webhook_secrets = {webhook_secret_1, webhook_secret_2, webhook_secret_3}
        assert len(webhook_secrets) == 3, "Each integration should have a unique webhook secret"

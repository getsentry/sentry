from __future__ import annotations

from unittest import mock

from sentry.integrations.discord.requests.base import DiscordRequest
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class DiscordRequestTest(TestCase):
    def mock_request(self, request_data: dict | None = None) -> DiscordRequest:
        self.request = mock.Mock()
        self.request.data = (
            {
                "type": 1,
                "guild_id": "guild-id",
                "channel_id": "channel-id",
                "member": {
                    "user": {
                        "id": "user-id",
                    },
                },
            }
            if request_data is None
            else request_data
        )
        self.request.body = json.dumps(self.request.data).encode()
        self.request.META = {
            "HTTP_X_SIGNATURE_ED25519": "signature",
            "HTTP_X_SIGNATURE_TIMESTAMP": "timestamp",
        }
        return DiscordRequest(self.request)

    def test_exposes_guild_id(self):
        discord_request = self.mock_request()
        assert discord_request.guild_id == "guild-id"

    def test_collects_logging_data(self):
        discord_request = self.mock_request()
        assert discord_request.logging_data == {
            "discord_guild_id": "guild-id",
            "discord_channel_id": "channel-id",
            "discord_user_id": "user-id",
        }

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_collects_logging_data_with_integration_id(self, mock_get_integration):
        discord_request = self.mock_request()
        mock_get_integration.return_value = RpcIntegration(
            id=1,
            provider="discord",
            external_id="guild-id",
            name="Cool server",
            metadata={},
            status=1,
        )
        discord_request.validate_integration()
        assert discord_request.logging_data == {
            "discord_guild_id": "guild-id",
            "discord_channel_id": "channel-id",
            "discord_user_id": "user-id",
            "integration_id": 1,
        }

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_validate_integration(self, mock_get_integration):
        discord_request = self.mock_request()
        mock_get_integration.return_value = RpcIntegration(
            id=1,
            provider="discord",
            external_id="guild-id",
            name="Cool server",
            metadata={},
            status=1,
        )
        discord_request.validate_integration()
        assert mock_get_integration.call_count == 1
        assert discord_request.integration is not None

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_validate_integration_no_integration(self, mock_get_integration):
        discord_request = self.mock_request()
        mock_get_integration.return_value = None
        discord_request.validate_integration()
        assert mock_get_integration.call_count == 1
        assert discord_request.integration is None

    def test_get_command_name(self):
        discord_request = self.mock_request(
            {
                "type": 2,
                "guild_id": "guild-id",
                "channel_id": "channel-id",
                "data": {
                    "name": "test_command",
                },
            }
        )
        res = discord_request.get_command_name()
        assert res == "test_command"

    def test_get_command_name_not_command(self):
        discord_request = self.mock_request()
        res = discord_request.get_command_name()
        assert res == ""

    def test_validate_identity_flow(self):
        integration = self.create_integration(
            self.organization, provider="discord", external_id="guild-id"
        )
        provider = self.create_identity_provider(integration=integration)
        self.create_identity(user=self.user, identity_provider=provider, external_id="user-id")

        discord_request = self.mock_request()
        discord_request._validate_identity()
        user = discord_request.get_identity_user()
        assert user is not None
        assert user.id == self.user.id

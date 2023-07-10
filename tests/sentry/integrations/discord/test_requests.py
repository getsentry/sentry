from unittest import mock
from urllib.parse import urlencode

import pytest

from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.cache import memoize


@control_silo_test(stable=True)
class DiscordRequestTest(TestCase):
    def setUp(self):
        super().setUp()

        self.request = mock.Mock()
        self.request.data = {
            "type": 1,
            "guild_id": "guild-id",
            "channel_id": "channel-id",
        }
        self.request.body = urlencode(self.request.data).encode()
        self.request.META = {
            "HTTP_X_SIGNATURE_ED25519": "signature",
            "HTTP_X_SIGNATURE_TIMESTAMP": "timestamp",
        }

    @memoize
    def discord_request(self):
        return DiscordRequest(self.request)

    def test_exposes_data(self):
        assert self.discord_request.data["type"] == 1

    def test_exposes_guild_id(self):
        assert self.discord_request.guild_id == "guild-id"

    def test_collects_logging_data(self):
        assert self.discord_request.logging_data == {
            "discord_guild_id": "guild-id",
            "discord_channel_id": "channel-id",
        }

    def test_validate_data_returns_400(self):
        type(self.request).data = mock.PropertyMock(side_effect=ValueError())
        with pytest.raises(DiscordRequestError) as e:
            self.discord_request.validate()
            assert e.value.status == 400

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_validate_integration(self, mock_get_integration):
        mock_get_integration.return_value = RpcIntegration(
            id=1,
            provider="discord",
            external_id="guild-id",
            name="Cool server",
            metadata={},
            status=1,
        )
        self.discord_request.validate_integration()
        assert mock_get_integration.call_count == 1
        assert self.discord_request.integration is not None

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_validate_integration_no_integration(self, mock_get_integration):
        mock_get_integration.return_value = None
        self.discord_request.validate_integration()
        assert mock_get_integration.call_count == 1
        assert self.discord_request.integration is None

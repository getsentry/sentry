from unittest import mock

from django.core.exceptions import ValidationError
from pytest import raises
from requests.exceptions import Timeout

from sentry.integrations.discord.utils.auth import verify_signature
from sentry.integrations.discord.utils.channel import validate_channel_id
from sentry.shared_integrations.exceptions import ApiTimeoutError, IntegrationError
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.testutils.cases import TestCase


class AuthTest(TestCase):
    def test_verify_signature_valid(self):
        public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
        signature = "DBC99471F8DD30BA0F488912CF9BA7AC1E938047782BB72FF9A6873D452A1A75DC9F8A07182B8EB7FC67A3771C2271D568DCDC2AB2A5D927A42A4F0FC233C506"
        timestamp = "1688960024"
        body = '{"type":1}'
        message = timestamp + body

        result = verify_signature(public_key_string, signature, message)

        assert result

    def test_verify_signature_invalid(self):
        public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
        signature = "0123456789abcdef"
        timestamp = "1688960024"
        body = '{"type":1}'
        message = timestamp + body

        result = verify_signature(public_key_string, signature, message)

        assert not result


class ValidateChannelTest(TestCase):
    guild_id = "guild-id"
    channel_id = "channel-id"
    integration_id = 1234
    guild_name = "server name"

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_happy_path(self, mock_get_channel):
        mock_get_channel.return_value = {"guild_id": self.guild_id}
        validate_channel_id(self.channel_id, self.guild_id, self.integration_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_404(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=404, text="")
        with raises(ValidationError):
            validate_channel_id(
                self.channel_id, self.guild_id, self.integration_id, self.guild_name
            )

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_403(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=403, text="")
        with raises(ValidationError):
            validate_channel_id(
                self.channel_id, self.guild_id, self.integration_id, self.guild_name
            )

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_400(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=400, text="")
        with raises(ValidationError):
            validate_channel_id(
                self.channel_id, self.guild_id, self.integration_id, self.guild_name
            )

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_api_error(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=401, text="")
        with raises(IntegrationError):
            validate_channel_id(
                self.channel_id, self.guild_id, self.integration_id, self.guild_name
            )

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_bad_response(self, mock_get_channel):
        mock_get_channel.return_value = ""
        with raises(IntegrationError):
            validate_channel_id(
                self.channel_id, self.guild_id, self.integration_id, self.guild_name
            )

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_not_guild_member(self, mock_get_channel):
        mock_get_channel.return_value = {"guild_id": "not-my-guild"}
        with raises(ValidationError):
            validate_channel_id(
                self.channel_id, self.guild_id, self.integration_id, self.guild_name
            )

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_timeout(self, mock_get_channel):
        mock_get_channel.side_effect = Timeout("foo")
        with raises(ApiTimeoutError):
            validate_channel_id(
                self.channel_id, self.guild_id, self.integration_id, self.guild_name
            )

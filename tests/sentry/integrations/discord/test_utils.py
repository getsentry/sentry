from unittest import mock

from cryptography.exceptions import InvalidSignature
from django.core.exceptions import ValidationError
from pytest import raises
from requests.exceptions import Timeout

from sentry.integrations.discord.utils.auth import verify_signature
from sentry.integrations.discord.utils.channel import ChannelType, validate_channel_id
from sentry.integrations.discord.utils.channel_from_url import get_channel_id_from_url
from sentry.shared_integrations.exceptions import ApiError, ApiTimeoutError, IntegrationError
from sentry.testutils.cases import TestCase


class AuthTest(TestCase):
    def test_verify_signature_valid(self):
        public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
        signature = "DBC99471F8DD30BA0F488912CF9BA7AC1E938047782BB72FF9A6873D452A1A75DC9F8A07182B8EB7FC67A3771C2271D568DCDC2AB2A5D927A42A4F0FC233C506"
        timestamp = "1688960024"
        body = '{"type":1}'

        verify_signature(public_key_string, signature, timestamp, body)

    def test_verify_signature_invalid(self):
        public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
        signature = "0123456789abcdef"
        timestamp = "1688960024"
        body = '{"type":1}'

        with raises(InvalidSignature):
            verify_signature(public_key_string, signature, timestamp, body)


class ValidateChannelTest(TestCase):
    guild_id = "guild-id"
    channel_id = "channel-id"
    channel_type = 0  # text
    integration_id = 1234
    guild_name = "server name"

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_happy_path(self, mock_get_channel):
        mock_get_channel.return_value = {"guild_id": self.guild_id, "type": self.channel_type}
        validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_404(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=404, text="")
        with raises(ValidationError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_403(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=403, text="")
        with raises(ValidationError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_400(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=400, text="")
        with raises(ValidationError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_api_error(self, mock_get_channel):
        mock_get_channel.side_effect = ApiError(code=401, text="")
        with raises(IntegrationError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_bad_response(self, mock_get_channel):
        mock_get_channel.return_value = ""
        with raises(IntegrationError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_not_guild_member(self, mock_get_channel):
        mock_get_channel.return_value = {"guild_id": "not-my-guild", "type": self.channel_type}
        with raises(ValidationError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_timeout(self, mock_get_channel):
        mock_get_channel.side_effect = Timeout("foo")
        with raises(ApiTimeoutError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)

    @mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
    def test_not_supported_type(self, mock_get_channel):
        mock_get_channel.return_value = {"guild_id": self.guild_id, "type": ChannelType.DM.value}
        with raises(ValidationError):
            validate_channel_id(self.channel_id, self.guild_id, self.guild_name)


class GetChannelIdFromUrl(TestCase):
    channel_id = "12345678910"

    def test_happy_path(self):
        channel = get_channel_id_from_url(
            f"https://discord.com/channels/guild-id/{self.channel_id}"
        )
        assert channel == self.channel_id

    def test_happy_path_with_extra_slash(self):
        channel = get_channel_id_from_url(
            f"https://discord.com/channels/guild-id/{self.channel_id}"
        )
        assert channel == self.channel_id

    def test_missing_channel_id_with_slash(self):
        with raises(ValidationError):
            get_channel_id_from_url("https://discord.com/channels/guild-id/")

    def test_missing_channel_id_no_slash(self):
        with raises(ValidationError):
            get_channel_id_from_url("https://discord.com/channels/guild-id")

    def test_missing_guild_and_channel_with_slash(self):
        with raises(ValidationError):
            get_channel_id_from_url("https://discord.com/channels/")

    def test_missing_guild_and_channel_no_slash(self):
        with raises(ValidationError):
            get_channel_id_from_url("https://discord.com/channels")

    def test_different_link(self):
        with raises(ValidationError):
            get_channel_id_from_url("https://different.com")

    def test_just_channel_id(self):
        channel = get_channel_id_from_url(self.channel_id)
        assert channel == self.channel_id

    def test_no_channel_at_all(self):
        with raises(ValidationError):
            get_channel_id_from_url("")

    def test_non_integer_channel(self):
        with raises(ValidationError):
            get_channel_id_from_url("channel-id")

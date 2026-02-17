from unittest import mock

from cryptography.exceptions import InvalidSignature
from django.core.exceptions import ValidationError
from pytest import raises
from requests.exceptions import Timeout

from sentry.integrations.discord.utils.auth import verify_signature
from sentry.integrations.discord.utils.channel import ChannelType, validate_channel_id
from sentry.integrations.discord.utils.channel_from_url import get_channel_id_from_url
from sentry.shared_integrations.exceptions import ApiError, ApiTimeoutError, IntegrationError


def test_verify_signature_valid() -> None:
    public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
    signature = "DBC99471F8DD30BA0F488912CF9BA7AC1E938047782BB72FF9A6873D452A1A75DC9F8A07182B8EB7FC67A3771C2271D568DCDC2AB2A5D927A42A4F0FC233C506"
    timestamp = "1688960024"
    body = '{"type":1}'

    verify_signature(public_key_string, signature, timestamp, body)


def test_verify_signature_invalid() -> None:
    public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
    signature = "0123456789abcdef"
    timestamp = "1688960024"
    body = '{"type":1}'

    with raises(InvalidSignature):
        verify_signature(public_key_string, signature, timestamp, body)


# ValidateChannel tests
GUILD_ID = "guild-id"
CHANNEL_ID = "channel-id"
CHANNEL_TYPE = 0  # text
GUILD_NAME = "server name"


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_happy_path(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.return_value = {"guild_id": GUILD_ID, "type": CHANNEL_TYPE}
    validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_404(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.side_effect = ApiError(code=404, text="")
    with raises(ValidationError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_403(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.side_effect = ApiError(code=403, text="")
    with raises(ValidationError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_400(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.side_effect = ApiError(code=400, text="")
    with raises(ValidationError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_api_error(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.side_effect = ApiError(code=401, text="")
    with raises(IntegrationError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_bad_response(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.return_value = ""
    with raises(IntegrationError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_not_guild_member(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.return_value = {"guild_id": "not-my-guild", "type": CHANNEL_TYPE}
    with raises(ValidationError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_timeout(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.side_effect = Timeout("foo")
    with raises(ApiTimeoutError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


@mock.patch("sentry.integrations.discord.utils.channel.DiscordClient.get_channel")
def test_validate_channel_not_supported_type(mock_get_channel: mock.MagicMock) -> None:
    mock_get_channel.return_value = {"guild_id": GUILD_ID, "type": ChannelType.DM.value}
    with raises(ValidationError):
        validate_channel_id(CHANNEL_ID, GUILD_ID, GUILD_NAME)


# GetChannelIdFromUrl tests
TEST_CHANNEL_ID = "12345678910"


def test_get_channel_id_from_url_happy_path() -> None:
    channel = get_channel_id_from_url(f"https://discord.com/channels/guild-id/{TEST_CHANNEL_ID}")
    assert channel == TEST_CHANNEL_ID


def test_get_channel_id_from_url_with_extra_slash() -> None:
    channel = get_channel_id_from_url(f"https://discord.com/channels/guild-id/{TEST_CHANNEL_ID}")
    assert channel == TEST_CHANNEL_ID


def test_get_channel_id_from_url_missing_channel_id_with_slash() -> None:
    with raises(ValidationError):
        get_channel_id_from_url("https://discord.com/channels/guild-id/")


def test_get_channel_id_from_url_missing_channel_id_no_slash() -> None:
    with raises(ValidationError):
        get_channel_id_from_url("https://discord.com/channels/guild-id")


def test_get_channel_id_from_url_missing_guild_and_channel_with_slash() -> None:
    with raises(ValidationError):
        get_channel_id_from_url("https://discord.com/channels/")


def test_get_channel_id_from_url_missing_guild_and_channel_no_slash() -> None:
    with raises(ValidationError):
        get_channel_id_from_url("https://discord.com/channels")


def test_get_channel_id_from_url_different_link() -> None:
    with raises(ValidationError):
        get_channel_id_from_url("https://different.com")


def test_get_channel_id_from_url_just_channel_id() -> None:
    channel = get_channel_id_from_url(TEST_CHANNEL_ID)
    assert channel == TEST_CHANNEL_ID


def test_get_channel_id_from_url_no_channel_at_all() -> None:
    with raises(ValidationError):
        get_channel_id_from_url("")


def test_get_channel_id_from_url_non_integer_channel() -> None:
    with raises(ValidationError):
        get_channel_id_from_url("channel-id")

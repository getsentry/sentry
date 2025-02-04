import responses
from responses import matchers

from sentry import options
from sentry.integrations.discord.client import (
    APPLICATION_COMMANDS_URL,
    CHANNEL_URL,
    DISCORD_BASE_URL,
    GUILD_URL,
    MESSAGE_URL,
    USERS_GUILD_URL,
    DiscordClient,
)
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.flags import (
    EPHEMERAL_FLAG,
    DiscordMessageFlags,
)
from sentry.testutils.cases import TestCase


class DiscordClientTest(TestCase):
    def setUp(self):
        self.application_id = "application-id"
        self.bot_token = "bot-token"
        options.set("discord.application-id", self.application_id)
        options.set("discord.bot-token", self.bot_token)
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1234567890",
            name="Cool server",
            provider="discord",
        )
        self.discord_client = DiscordClient()

    def test_prepare_auth_header(self):
        expected = {"Authorization": f"Bot {self.bot_token}"}
        assert self.discord_client.prepare_auth_header() == expected

    @responses.activate
    def test_set_application_command(self):
        responses.add(
            responses.POST,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            status=204,
            match=[
                matchers.header_matcher({"Authorization": f"Bot {self.bot_token}"}),
                matchers.json_params_matcher({"command": "test"}),
            ],
        )

        self.discord_client.set_application_command(command={"command": "test"})

    @responses.activate
    def test_has_application_commands(self):
        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            status=200,
            json=[{"name": "test"}],
            match=[
                matchers.header_matcher({"Authorization": f"Bot {self.bot_token}"}),
            ],
        )

        assert self.discord_client.has_application_commands() is True

    @responses.activate
    def test_get_guild_name(self):
        guild_id = self.integration.external_id
        server_name = self.integration.name

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{GUILD_URL.format(guild_id=guild_id)}",
            json={
                "id": guild_id,
                "name": server_name,
            },
            match=[matchers.header_matcher({"Authorization": f"Bot {self.bot_token}"})],
        )

        guild_name = self.discord_client.get_guild_name(guild_id)
        assert guild_name == "Cool server"

    @responses.activate
    def test_get_access_token(self):
        responses.add(
            responses.POST,
            url=f"{DISCORD_BASE_URL}/oauth2/token",
            json={
                "access_token": "access_token",
            },
        )

        access_token = self.discord_client.get_access_token("auth_code", "url")
        assert access_token == "access_token"

    @responses.activate
    def test_get_user_id(self):
        responses.add(
            responses.GET,
            url=f"{DISCORD_BASE_URL}/users/@me",
            json={"id": "user_id"},
        )

        user_id = self.discord_client.get_user_id("access_token")
        assert user_id == "user_id"

    @responses.activate
    def test_leave_guild(self):
        guild_id = self.integration.external_id

        responses.add(
            responses.DELETE,
            url=f"{DiscordClient.base_url}{USERS_GUILD_URL.format(guild_id=guild_id)}",
            status=204,
            match=[matchers.header_matcher({"Authorization": f"Bot {self.bot_token}"})],
        )

        self.discord_client.leave_guild(guild_id)

    @responses.activate
    def test_get_channel(self):
        channel_id = "channel-id"
        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{CHANNEL_URL.format(channel_id=channel_id)}",
            status=200,
            json={"id": channel_id},
            match=[matchers.header_matcher({"Authorization": f"Bot {self.bot_token}"})],
        )

        response = self.discord_client.get_channel(channel_id=channel_id)
        assert response == {"id": "channel-id"}

    @responses.activate
    def test_send_message(self):
        channel_id = "channel-id"
        responses.add(
            responses.POST,
            url=f"{DiscordClient.base_url}{MESSAGE_URL.format(channel_id=channel_id)}",
            status=200,
            json={"id": channel_id},
            match=[
                matchers.header_matcher({"Authorization": f"Bot {self.bot_token}"}),
                matchers.json_params_matcher(
                    {
                        "components": [],
                        "content": "test",
                        "embeds": [],
                        "flags": EPHEMERAL_FLAG,
                    }
                ),
            ],
        )

        message = DiscordMessageBuilder(
            content="test",
            flags=DiscordMessageFlags().set_ephemeral(),
        )

        self.discord_client.send_message(
            channel_id=channel_id,
            message=message,
        )

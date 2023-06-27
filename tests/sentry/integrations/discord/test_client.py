import responses

from sentry.integrations.discord.client import DiscordClient
from sentry.testutils.cases import TestCase


class DiscordClientTest(TestCase):
    guild_name: DiscordClient

    def setUp(self):
        self.application_id = "application-id"
        self.bot_token = "bot-token"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1234567890",
            name="Cool server",
            provider="discord",
        )

        self.client = DiscordClient(
            application_id=self.application_id,
            bot_token=self.bot_token,
        )

    @responses.activate
    def test_get_guild_name(self):
        guild_id = self.integration.external_id
        server_name = self.integration.name

        responses.add(
            responses.GET,
            url=DiscordClient.base_url + (DiscordClient.GET_GUILD_URL % guild_id),
            json={
                "id": guild_id,
                "name": server_name,
            },
        )

        guild_name = self.client.get_guild_name(guild_id)
        assert guild_name == "Cool server"

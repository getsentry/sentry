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

    @responses.activate
    def test_request_attaches_bot_token_header(self):
        client = DiscordClient(self.application_id, self.bot_token)
        responses.add(
            responses.GET,
            url=DiscordClient.base_url + "/",
            json={},
        )
        client.get("/")
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bot " + self.bot_token

    @responses.activate
    def test_get_guild_name(self):
        client = DiscordClient(self.application_id, self.bot_token)
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

        guild_name = client.get_guild_name(guild_id)
        assert guild_name == "Cool server"

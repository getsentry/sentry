import responses

from sentry import options
from sentry.integrations.discord.client import DiscordClient
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase


class DiscordClientTest(TestCase):
    guild_name: DiscordClient

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

    @responses.activate
    def test_authorize_request(self):
        client = DiscordClient()
        responses.add(
            responses.GET,
            url=DiscordClient.base_url + "/",
            json={},
        )
        client.get("/")
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bot " + self.bot_token

    @responses.activate
    def test_manual_get_guild_name(self):
        client = DiscordClient()
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

        guild_name = client._get_guild_name(guild_id)
        assert guild_name == "Cool server"

    @responses.activate
    def test_manual_get_guild_name_response_error(self):
        client = DiscordClient()
        guild_id = self.integration.external_id

        responses.add(
            responses.GET,
            url=DiscordClient.base_url + (DiscordClient.GET_GUILD_URL % guild_id),
            status=500,
            json={"message": "aaaaaa"},
        )

        try:
            client._get_guild_name(guild_id)
        except IntegrationError as e:
            assert e.args[0] == "Could not retrieve Discord guild name"

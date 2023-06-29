import responses

from sentry import options

# from django.test import override_settings
# from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
# from sentry.silo.base import SiloMode
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
        self.client = DiscordClient(self.integration.id)

    @responses.activate
    def test_authorize_request(self):
        responses.add(
            responses.GET,
            url=DiscordClient.base_url + "/",
            json={},
        )
        self.client.get("/")
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bot " + self.bot_token

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

    @responses.activate
    def test_manual_get_guild_name(self):
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

        guild_name = self.client._get_guild_name(guild_id)
        assert guild_name == "Cool server"

    @responses.activate
    def test_manual_get_guild_name_response_error(self):
        guild_id = self.integration.external_id

        responses.add(
            responses.GET,
            url=DiscordClient.base_url + (DiscordClient.GET_GUILD_URL % guild_id),
            status=500,
            json={"message": "aaaaaa"},
        )

        try:
            self.client._get_guild_name(guild_id)
        except IntegrationError as e:
            assert e.args[0] == "Could not retrieve Discord guild name"


# control_address = "http://controlserver"
# secret = "secret-has-6-letters"
#
# @override_settings(
#    SENTRY_CONTROL_ADDRESS=control_address,
#    SENTRY_SUBNET_SECRET=secret,
# )
# class DiscordProxyClientTest(TestCase):
#    def setUp(self):
#        self.integration = self.create_integration(
#            organization=self.organization,
#            provider="discord",
#            name="Cool server",
#            external_id="1234567890",
#        )
#        self.installation = self.integration.get_installation(organization_id=self.organization.id)
#        self.client = DiscordClient()
#

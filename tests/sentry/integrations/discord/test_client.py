import responses
from django.test import override_settings

from sentry import options
from sentry.integrations.discord.client import GUILD_URL, DiscordClient
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
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
        self.discord_client = DiscordClient(self.integration.id)

    @responses.activate
    def test_authorize_request(self):
        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}/",
            json={},
        )
        self.discord_client.get("/")
        request = responses.calls[0].request
        assert request.headers["Authorization"] == f"Bot {self.bot_token}"

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
        )

        guild_name = self.discord_client.get_guild_name(guild_id)
        assert guild_name == "Cool server"


control_address = "http://controlserver"
secret = "secret-has-6-letters"


@override_settings(
    SENTRY_CONTROL_ADDRESS=control_address,
    SENTRY_SUBNET_SECRET=secret,
)
class DiscordProxyClientTest(TestCase):
    def setUp(self):
        self.integration = self.create_integration(
            organization=self.organization,
            provider="discord",
            name="Cool server",
            external_id="1234567890",
        )
        self.installation = self.integration.get_installation(organization_id=self.organization.id)
        self.discord_client = DiscordClient(self.integration.id)

    @responses.activate
    def test_integration_proxy_is_active(self):
        class DiscordProxyTestClient(DiscordClient):
            _use_proxy_url_for_tests = True

            def assert_proxy_request(self, request, is_proxy=True):
                assert (PROXY_BASE_PATH in request.url) == is_proxy
                assert (PROXY_OI_HEADER in request.headers) == is_proxy
                assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
                # The discord bot token shouldn't yet be in the request
                assert ("Authorization" in request.headers) != is_proxy
                if is_proxy:
                    assert request.headers[PROXY_OI_HEADER] is not None

        responses.add(
            method=responses.GET,
            url=f"{DiscordClient.base_url}{GUILD_URL.format(guild_id=self.integration.external_id)}",
            json={"guild_id": "1234567890", "name": "Cool server"},
            status=200,
        )

        responses.add(
            method=responses.GET,
            url=f"{control_address}{PROXY_BASE_PATH}{GUILD_URL.format(guild_id=self.integration.external_id)}",
            json={"guild_id": "1234567890", "name": "Cool server"},
            status=200,
        )

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = DiscordProxyTestClient(integration_id=self.integration.id)
            client.get_guild_name(self.integration.external_id)
            request = responses.calls[0].request

            assert GUILD_URL.format(guild_id=self.integration.external_id) in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = DiscordProxyTestClient(integration_id=self.integration.id)
            client.get_guild_name(self.integration.external_id)
            request = responses.calls[0].request

            assert GUILD_URL.format(guild_id=self.integration.external_id) in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = DiscordProxyTestClient(integration_id=self.integration.id)
            client.get_guild_name(self.integration.external_id)
            request = responses.calls[0].request

            assert GUILD_URL.format(guild_id=self.integration.external_id) in request.url
            assert client.base_url not in request.url
            client.assert_proxy_request(request, is_proxy=True)

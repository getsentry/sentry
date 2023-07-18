from unittest import mock
from urllib.parse import parse_qs, urlencode, urlparse

import responses

from sentry import audit_log, options
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.integration import DiscordIntegrationProvider
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.integrations.integration import Integration
from sentry.testutils import IntegrationTestCase


class DiscordIntegrationTest(IntegrationTestCase):
    provider = DiscordIntegrationProvider

    def setUp(self):
        super().setUp()
        self.application_id = "application-id"
        self.bot_token = "bot-token"
        options.set("discord.application-id", self.application_id)
        options.set("discord.bot-token", self.bot_token)

    def assert_setup_flow(
        self,
        guild_id="1234567890",
        server_name="Cool server",
    ):
        responses.reset()

        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "discord.com"
        assert redirect.path == "/api/oauth2/authorize"
        params = parse_qs(redirect.query)
        assert params["client_id"] == [self.application_id]
        assert params["permissions"] == [str(self.provider.bot_permissions)]
        assert params["redirect_uri"] == ["http://testserver/extensions/discord/setup/"]
        assert params["response_type"] == ["code"]
        scopes = self.provider.oauth_scopes
        assert params["scope"] == [" ".join(scopes)]

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{DiscordClient.GUILD_URL.format(guild_id=guild_id)}",
            json={
                "id": guild_id,
                "name": server_name,
            },
        )

        resp = self.client.get("{}?{}".format(self.setup_path, urlencode({"guild_id": guild_id})))

        mock_request = responses.calls[0].request
        assert mock_request.headers["Authorization"] == f"Bot {self.bot_token}"

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

    @responses.activate
    def test_bot_flow(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == "1234567890"
        assert integration.name == "Cool server"

        audit_entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("INTEGRATION_ADD"))
        audit_log_event = audit_log.get(audit_entry.event)
        assert (
            audit_log_event.render(audit_entry)
            == "installed Cool server for the discord integration"
        )

    @responses.activate
    def test_multiple_integrations(self):
        with self.tasks():
            self.assert_setup_flow()
        with self.tasks():
            self.assert_setup_flow(guild_id="0987654321", server_name="Uncool server")

        integrations = Integration.objects.filter(provider=self.provider.key).order_by(
            "external_id"
        )

        assert integrations.count() == 2
        assert integrations[0].external_id == "0987654321"
        assert integrations[0].name == "Uncool server"
        assert integrations[1].external_id == "1234567890"
        assert integrations[1].name == "Cool server"

    @responses.activate
    def test_get_guild_name(self):
        provider = self.provider()
        guild_id = "1234"
        guild_name = "asdf"

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{DiscordClient.GUILD_URL.format(guild_id=guild_id)}",
            json={
                "id": guild_id,
                "name": guild_name,
            },
        )

        resp = provider.get_guild_name(guild_id)
        assert resp == "asdf"
        mock_request = responses.calls[0].request
        assert mock_request.headers["Authorization"] == f"Bot {self.bot_token}"

    @responses.activate
    def test_get_guild_name_failure(self):
        provider = self.provider()
        guild_id = "1234"

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{DiscordClient.GUILD_URL.format(guild_id=guild_id)}",
            status=500,
        )

        resp = provider.get_guild_name(guild_id)
        assert resp == "1234"
        mock_request = responses.calls[0].request
        assert mock_request.headers["Authorization"] == f"Bot {self.bot_token}"

    @responses.activate
    def test_setup(self):
        provider = self.provider()

        url = f"{DiscordClient.base_url}{DiscordClient.APPLICATION_COMMANDS.format(application_id=self.application_id)}"
        responses.add(
            responses.PUT,
            url=url,
            status=200,
        )

        provider.setup()

        assert responses.assert_call_count(count=1, url=url)

    @responses.activate
    @mock.patch("sentry.integrations.discord.commands.logger.error")
    def test_setup_failure(self, mock_log_error):
        mock_log_error.return_value = None
        provider = self.provider()

        url = f"{DiscordClient.base_url}{DiscordClient.APPLICATION_COMMANDS.format(application_id=self.application_id)}"
        responses.add(
            responses.PUT,
            url=url,
            status=200,
        )

        provider.setup()

        assert responses.assert_call_count(count=1, url=url)
        assert mock_log_error.call_count == 1

    @responses.activate
    def test_setup_cache(self):
        provider = self.provider()

        url = f"{DiscordClient.base_url}{DiscordClient.APPLICATION_COMMANDS.format(application_id=self.application_id)}"
        responses.add(
            responses.PUT,
            url=url,
            status=200,
        )

        provider.setup()
        provider.setup()

        # Second provider.setup() should not update commands -> 1 call to API
        assert responses.assert_call_count(count=1, url=url)

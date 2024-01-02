from unittest import mock
from urllib.parse import parse_qs, urlencode, urlparse

import pytest
import responses
from responses.matchers import header_matcher, json_params_matcher

from sentry import audit_log, options
from sentry.api.client import ApiError
from sentry.integrations.discord.client import APPLICATION_COMMANDS_URL, GUILD_URL, DiscordClient
from sentry.integrations.discord.integration import COMMANDS, DiscordIntegrationProvider
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.integrations.integration import Integration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import IntegrationTestCase


class DiscordIntegrationTest(IntegrationTestCase):
    provider = DiscordIntegrationProvider

    def setUp(self):
        super().setUp()
        self.application_id = "application-id"
        self.public_key = "public-key"
        self.bot_token = "bot-token"
        self.client_secret = "client-secret"
        options.set("discord.application-id", self.application_id)
        options.set("discord.public-key", self.public_key)
        options.set("discord.bot-token", self.bot_token)
        options.set("discord.client-secret", self.client_secret)

    @mock.patch("sentry.integrations.discord.client.DiscordClient.set_application_command")
    def assert_setup_flow(
        self,
        mock_set_application_command,
        guild_id="1234567890",
        server_name="Cool server",
        auth_code="auth_code",
        command_response_empty=True,
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
            url=f"{DiscordClient.base_url}{GUILD_URL.format(guild_id=guild_id)}",
            match=[header_matcher({"Authorization": f"Bot {self.bot_token}"})],
            json={
                "id": guild_id,
                "name": server_name,
            },
        )

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            match=[header_matcher({"Authorization": f"Bot {self.bot_token}"})],
            json=[] if command_response_empty else COMMANDS,
        )

        if command_response_empty:
            for command in COMMANDS:
                responses.add(
                    responses.POST,
                    url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
                    match=[
                        header_matcher({"Authorization": f"Bot {self.bot_token}"}),
                        json_params_matcher({"data": command}),
                    ],
                )

        responses.add(
            responses.POST,
            url="https://discord.com/api/v10/oauth2/token",
            json={
                "access_token": "access_token",
            },
        )
        responses.add(
            responses.GET, url=f"{DiscordClient.base_url}/users/@me", json={"id": "user_1234"}
        )

        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode({"guild_id": guild_id, "code": auth_code}),
            )
        )

        call_list = responses.calls
        assert call_list[0].request.headers["Authorization"] == f"Bot {self.bot_token}"
        assert f"code={auth_code}" in call_list[1].request.body
        assert call_list[2].request.headers["Authorization"] == "Bearer access_token"

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

        if command_response_empty:
            assert mock_set_application_command.call_count == 3
        else:
            assert mock_set_application_command.call_count == 0

    def assert_setup_flow_from_discord(
        self,
        guild_id="1234567890",
        server_name="Cool server",
        auth_code="auth_code",
    ):
        responses.reset()

        resp = self.client.get(self.configure_path)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "discord.com"
        assert redirect.path == "/api/oauth2/authorize"
        params = parse_qs(redirect.query)
        assert params["client_id"] == [self.application_id]
        assert params["permissions"] == [str(self.provider.bot_permissions)]
        assert params["redirect_uri"] == ["http://testserver/extensions/discord/configure/"]
        assert params["response_type"] == ["code"]
        scopes = self.provider.oauth_scopes
        assert params["scope"] == [" ".join(scopes)]

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{GUILD_URL.format(guild_id=guild_id)}",
            match=[header_matcher({"Authorization": f"Bot {self.bot_token}"})],
            json={
                "id": guild_id,
                "name": server_name,
            },
        )

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            match=[header_matcher({"Authorization": f"Bot {self.bot_token}"})],
            json=COMMANDS,
        )

        responses.add(
            responses.POST,
            url="https://discord.com/api/v10/oauth2/token",
            json={
                "access_token": "access_token",
            },
        )
        responses.add(
            responses.GET, url=f"{DiscordClient.base_url}/users/@me", json={"id": "user_1234"}
        )

        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode({"guild_id": guild_id, "code": auth_code}),
            )
        )

        call_list = responses.calls
        assert call_list[0].request.headers["Authorization"] == f"Bot {self.bot_token}"
        assert f"code={auth_code}" in call_list[1].request.body
        assert call_list[2].request.headers["Authorization"] == "Bearer access_token"

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
    def test_bot_flow_from_discord(self):
        with self.tasks():
            self.assert_setup_flow_from_discord()

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
            self.assert_setup_flow(
                guild_id="0987654321",
                server_name="Uncool server",
                command_response_empty=False,
            )

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
        user_id = "user1234"
        guild_id = "guild_id"
        guild_name = "guild_name"
        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{GUILD_URL.format(guild_id=guild_id)}",
            match=[header_matcher({"Authorization": f"Bot {self.bot_token}"})],
            json={
                "id": guild_id,
                "name": guild_name,
            },
        )
        responses.add(
            responses.POST,
            url="https://discord.com/api/v10/oauth2/token",
            json={
                "access_token": "access_token",
            },
        )
        responses.add(
            responses.GET, url=f"{DiscordClient.base_url}/users/@me", json={"id": "user_1234"}
        )
        result = provider.build_integration({"guild_id": "guild_id", "code": user_id})
        assert result["name"] == guild_name

    @responses.activate
    def test_get_guild_name_failure(self):
        provider = self.provider()
        user_id = "user1234"
        guild_id = "guild_id"
        responses.add(responses.GET, "https://discord.com/api/v10/guilds/guild_name", status=500)
        responses.add(
            responses.POST,
            url="https://discord.com/api/v10/oauth2/token",
            json={
                "access_token": "access_token",
            },
        )
        responses.add(
            responses.GET, url=f"{DiscordClient.base_url}/users/@me", json={"id": user_id}
        )
        result = provider.build_integration({"guild_id": guild_id, "code": user_id})
        assert result["name"] == guild_id

    @responses.activate
    def test_get_discord_user_id(self):
        provider = self.provider()
        user_id = "user1234"

        responses.add(
            responses.POST,
            url="https://discord.com/api/v10/oauth2/token",
            json={
                "access_token": "access_token",
            },
        )
        responses.add(
            responses.GET, url=f"{DiscordClient.base_url}/users/@me", json={"id": user_id}
        )

        result = provider._get_discord_user_id("auth_code", "1")

        assert result == user_id

    @responses.activate
    def test_get_discord_user_id_oauth_failure(self):
        provider = self.provider()
        responses.add(responses.POST, url="https://discord.com/api/v10/oauth2/token", status=500)
        with pytest.raises(IntegrationError):
            provider._get_discord_user_id("auth_code", "1")

    @responses.activate
    def test_get_discord_user_id_oauth_no_token(self):
        provider = self.provider()
        responses.add(
            responses.POST,
            url="https://discord.com/api/v10/oauth2/token",
            json={},
        )
        with pytest.raises(IntegrationError):
            provider._get_discord_user_id("auth_code", "1")

    @responses.activate
    def test_get_discord_user_id_request_fail(self):
        provider = self.provider()
        responses.add(
            responses.POST,
            url="https://discord.com/api/v10/oauth2/token",
            json={
                "access_token": "access_token",
            },
        )
        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}/users/@me",
            status=401,
        )
        with pytest.raises(IntegrationError):
            provider._get_discord_user_id("auth_code", "1")

    @responses.activate
    @mock.patch("sentry.integrations.discord.client.DiscordClient.set_application_command")
    def test_post_install(self, mock_set_application_command):
        provider = self.provider()

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            match=[header_matcher({"Authorization": f"Bot {self.bot_token}"})],
            json=[],
        )
        responses.add(
            responses.POST,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            status=200,
        )

        provider.post_install(integration=self.integration, organization=self.organization)
        assert mock_set_application_command.call_count == 3  # one for each command

    @mock.patch("sentry.integrations.discord.client.DiscordClient.set_application_command")
    def test_post_install_missing_credentials(self, mock_set_application_command):
        provider = self.provider()
        provider.application_id = None
        provider.post_install(integration=self.integration, organization=self.organization)
        assert mock_set_application_command.call_count == 0

    @responses.activate
    def test_set_commands_failure(self):
        provider = self.provider()

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            match=[header_matcher({"Authorization": f"Bot {self.bot_token}"})],
            json=[],
        )
        responses.add(
            responses.POST,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            body=ApiError("something wrong", 500),
            status=500,
        )
        with pytest.raises(ApiError):
            provider.post_install(integration=self.integration, organization=self.organization)

    @responses.activate
    def test_get_commands_failure(self):
        provider = self.provider()

        responses.add(
            responses.GET,
            url=f"{DiscordClient.base_url}{APPLICATION_COMMANDS_URL.format(application_id=self.application_id)}",
            body=ApiError("something wrong", 500),
            status=500,
        )
        with pytest.raises(ApiError):
            provider.post_install(integration=self.integration, organization=self.organization)

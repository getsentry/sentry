from __future__ import annotations
from typing import int

from unittest.mock import patch

from django.core.exceptions import ValidationError

from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class BaseChannelValidateTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-channel-validate"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _get_response(self, integration_id, channel):
        return self.get_success_response(self.organization.slug, integration_id, channel=channel)


@control_silo_test
class SlackChannelValidateTest(BaseChannelValidateTest):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Slack",
            external_id="slack:1",
        )

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.get_channel_id"
    )
    def test_channel_validation(self, mock_get_channel_id):
        cases = [("#general", "C123", True), ("#missing", None, False)]

        for channel_name, channel_id, expected in cases:
            mock_obj = type("SlackChannelData", (), {"channel_id": channel_id})()
            mock_get_channel_id.return_value = mock_obj
            resp = self._get_response(self.integration.id, channel_name)
            assert resp.data["valid"] is expected


@control_silo_test
class MsTeamsChannelValidateTest(BaseChannelValidateTest):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="msteams",
            name="Teams",
            external_id="teams:1",
        )

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.msteams_find_channel_id"
    )
    def test_channel_validation(self, mock_find):
        cases = [("General", "19:abc@thread.tacv2", True), ("Missing", None, False)]

        for channel_name, channel_id, expected in cases:
            mock_find.return_value = channel_id
            resp = self._get_response(self.integration.id, channel_name)
            assert resp.data["valid"] is expected


@control_silo_test
class DiscordChannelValidateTest(BaseChannelValidateTest):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="discord",
            name="Discord Server",
            external_id="1234567890",
        )

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.discord_validate_channel_id"
    )
    def test_discord_valid_numeric_id(self, mock_validate):
        mock_validate.return_value = "123"
        resp = self._get_response(self.integration.id, "123")
        assert resp.data == {"valid": True}
        mock_validate.assert_called_once()

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.discord_validate_channel_id",
        side_effect=ValidationError("bad"),
    )
    def test_discord_invalid_plain_name(self, _mock_validate):
        resp = self._get_response(self.integration.id, "alerts")
        assert resp.data == {"valid": False}

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.discord_validate_channel_id"
    )
    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.discord_get_channel_id_from_url"
    )
    def test_discord_valid_url(self, mock_parse, mock_validate):
        mock_parse.return_value = "123"
        mock_validate.return_value = object()
        resp = self._get_response(self.integration.id, "https://discord.com/channels/123/123")
        assert resp.data == {"valid": True}
        mock_parse.assert_called_once()
        mock_validate.assert_called_once()

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.discord_get_channel_id_from_url",
        side_effect=ValidationError("bad"),
    )
    def test_discord_invalid_url_parse(self, _mock_parse):
        resp = self._get_response(self.integration.id, "https://discord.com/channels/bad")
        assert resp.data == {"valid": False}

    @patch(
        "sentry.integrations.api.endpoints.organization_integration_channel_validate.discord_validate_channel_id",
        side_effect=ApiError("rate limited", code=429),
    )
    def test_discord_validate_api_error(self, _mock_validate):
        resp = self._get_response(self.integration.id, "123")
        assert resp.data == {"valid": False}


@control_silo_test
class ChannelValidateErrorCasesTest(BaseChannelValidateTest):
    def test_missing_channel_param(self):
        integration = self.create_integration(
            organization=self.organization, provider="slack", name="Slack", external_id="slack:1"
        )
        resp = self.get_error_response(self.organization.slug, integration.id, status_code=400)
        assert "channel" in resp.data

    def test_integration_not_found(self):
        resp = self.get_error_response(self.organization.slug, 99999, status_code=404, channel="#x")
        assert resp.status_code == 404

    def test_unsupported_provider(self):
        integration = self.create_integration(
            organization=self.organization, provider="github", name="GitHub", external_id="github:1"
        )
        resp = self.get_error_response(
            self.organization.slug, integration.id, status_code=400, channel="#x"
        )
        assert resp.data["valid"] is False
        assert "Unsupported provider" in resp.data.get("detail", "")

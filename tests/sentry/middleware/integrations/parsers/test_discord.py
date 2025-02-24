from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from unittest.mock import patch

import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status

from sentry.integrations.discord.client import DISCORD_BASE_URL
from sentry.integrations.discord.requests.base import DiscordRequestError, DiscordRequestTypes
from sentry.integrations.middleware.hybrid_cloud.parser import create_async_request_payload
from sentry.middleware.integrations.parsers.discord import DiscordRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads
from sentry.testutils.silo import control_silo_test, create_test_regions
from sentry.utils import json
from sentry.utils.signing import sign


@control_silo_test(regions=create_test_regions("us"))
class DiscordRequestParserTest(TestCase):
    factory = RequestFactory()
    discord_id = "808"

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="discord:123",
            provider="discord",
        )

    def get_parser(self, path: str, data: Mapping[str, Any] | None = None):
        if not data:
            data = {}
        self.request = self.factory.post(
            path,
            data=data,
            content_type="application/json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )
        return DiscordRequestParser(self.request, self.get_response)

    @responses.activate
    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_interactions_endpoint_routing_ping(self, mock_verify_signature):
        data = {"guild_id": self.integration.external_id, "type": DiscordRequestTypes.PING}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        integration = parser.get_integration_from_request()
        assert integration == self.integration

        response = parser.get_response()
        assert response.status_code == 200
        data = json.loads(response.content)
        assert data == {"type": 1}
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @responses.activate
    @patch(
        "sentry.integrations.discord.requests.base.verify_signature",
        side_effect=DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED),
    )
    def test_interactions_endpoint_validation_failure(self, mock_verify_signature):
        data = {"type": DiscordRequestTypes.PING}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)

        response = parser.get_response()
        assert response.status_code == 401
        assert not response.content
        assert_no_webhook_payloads()
        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_interactions_endpoint_routing_ping_no_integration(self, mock_verify_signature):
        # Discord PING without an identifier linking to an integration
        data = {"type": DiscordRequestTypes.PING}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        assert parser.get_integration_from_request() is None

        response = parser.get_response()
        assert response.status_code == 200
        data = json.loads(response.content)
        assert data == {"type": 1}
        assert_no_webhook_payloads()
        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_interactions_endpoint_routing_command(self, mock_verify_signature):
        data = {
            "guild_id": self.integration.external_id,
            "data": {"name": "command_name"},
            "type": int(DiscordRequestTypes.COMMAND),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        integration = parser.get_integration_from_request()
        assert integration == self.integration

        responses.add(
            responses.POST,
            "http://us.testserver/extensions/discord/interactions/",
            status=202,
            body=b"region_response",
        )

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b"region_response"
        assert len(responses.calls) == 1
        assert_no_webhook_payloads()

    @responses.activate
    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_interactions_endpoint_routing_command_no_integration(self, mock_verify_signature):
        data = {
            "data": {"name": "command_name"},
            "type": int(DiscordRequestTypes.COMMAND),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        assert parser.get_integration_from_request() is None

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @responses.activate
    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_interactions_endpoint_routing_message_component(self, mock_verify_signature):
        data = {
            "guild_id": self.integration.external_id,
            "type": int(DiscordRequestTypes.MESSAGE_COMPONENT),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        integration = parser.get_integration_from_request()
        assert integration == self.integration

        responses.add(
            responses.POST,
            "http://us.testserver/extensions/discord/interactions/",
            status=201,
            body=b"region_response",
        )

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 201
        assert response.content == b"region_response"
        assert len(responses.calls) == 1
        assert_no_webhook_payloads()

    @responses.activate
    def test_control_classes(self):
        params = sign(integration_id=self.integration.id, discord_id=self.discord_id)
        link_path = reverse(
            "sentry-integration-discord-link-identity",
            kwargs={"signed_params": params},
        )
        unlink_path = reverse(
            "sentry-integration-discord-unlink-identity",
            kwargs={"signed_params": params},
        )
        config_path = reverse("discord-extension-configuration")
        for path in [link_path, unlink_path, config_path]:
            parser = self.get_parser(path)
            parser_integration = parser.get_integration_from_request()
            assert parser_integration is None

            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_payloads()

    @responses.activate
    @patch("sentry.middleware.integrations.parsers.discord.convert_to_async_discord_response")
    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_triggers_async_response(self, mock_verify_signature, mock_discord_task):
        response_url = f"{DISCORD_BASE_URL}/webhooks/application_id/token"
        data = {
            "application_id": "application_id",
            "token": "token",
            "guild_id": self.integration.external_id,
            "data": {"name": "command_name"},
            "type": int(DiscordRequestTypes.COMMAND),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        response = parser.get_response()
        payload = create_async_request_payload(self.request)
        mock_discord_task.apply_async.assert_called_once_with(
            kwargs={
                "region_names": ["us"],
                "payload": payload,
                "response_url": response_url,
            }
        )
        assert response.status_code == status.HTTP_200_OK
        assert json.loads(response.content) == parser.async_response_data


@control_silo_test
class End2EndTest(APITestCase):
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_validation_failure(self):
        response = self.client.post(
            reverse("sentry-integration-discord-interactions"),
            data={"type": DiscordRequestTypes.PING},
        )
        assert response.status_code == 401
        assert not response.content

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_discord_interaction_endpoint(self, mock_verify_signature):
        response = self.client.post(
            reverse("sentry-integration-discord-interactions"),
            data={"type": DiscordRequestTypes.PING},
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )
        assert response.status_code == 200
        data = json.loads(response.content)
        assert data == {"type": 1}
        assert mock_verify_signature.call_count == 1

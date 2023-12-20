from __future__ import annotations

import dataclasses
from typing import Any, Mapping
from unittest.mock import MagicMock, patch

import pytest
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status

from sentry.integrations.discord.requests.base import DiscordRequestError, DiscordRequestTypes
from sentry.middleware.integrations.parsers.discord import DiscordRequestParser
from sentry.models.outbox import ControlOutbox
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.region import Region, RegionCategory
from sentry.utils import json
from sentry.utils.signing import sign


@control_silo_test
class DiscordRequestParserTest(TestCase):
    get_response = MagicMock()
    factory = RequestFactory()
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    discord_id = "808"

    @pytest.fixture(autouse=True)
    def patch_get_region(self):
        with patch.object(
            DiscordRequestParser, "get_regions_from_organizations", return_value=[self.region]
        ):
            yield

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

    @patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_interactions_endpoint_routing_ping(self, mock_verify_signature):
        mock_verify_signature.return_value = None
        data = {"guild_id": self.integration.external_id, "type": DiscordRequestTypes.PING}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        with patch.object(
            parser, "get_response_from_first_region"
        ) as get_response_from_first_region, assume_test_silo_mode(
            SiloMode.CONTROL, can_be_monolith=False
        ):
            response = parser.get_response()
            assert response.status_code == 200
            data = json.loads(response.content)
            assert data == {"type": 1}
            assert not get_response_from_first_region.called
        integration = parser.get_integration_from_request()
        assert integration == self.integration

    @patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_interactions_endpoint_validation_failure(self, mock_verify_signature):
        mock_verify_signature.side_effect = DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)
        data = {"type": DiscordRequestTypes.PING}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        with patch.object(
            parser, "get_response_from_first_region"
        ) as get_response_from_first_region, assume_test_silo_mode(
            SiloMode.CONTROL, can_be_monolith=False
        ):
            response = parser.get_response()
            assert response.status_code == 401
            assert not response.content
            assert not get_response_from_first_region.called

    @patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_interactions_endpoint_routing_ping_no_integration(self, mock_verify_signature):
        mock_verify_signature.return_value = None
        # Discord PING without an identifier linking to an integration
        data = {"type": DiscordRequestTypes.PING}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)

        with patch.object(parser, "get_regions_from_organizations", return_value=[]), patch.object(
            parser, "get_response_from_first_region"
        ) as get_response_from_first_region, patch.object(
            parser, "get_response_from_control_silo"
        ) as mock_response_from_control, assume_test_silo_mode(
            SiloMode.CONTROL, can_be_monolith=False
        ):
            response = parser.get_response()
            assert response.status_code == 200
            data = json.loads(response.content)
            assert data == {"type": 1}
            assert not mock_response_from_control.called
            assert not get_response_from_first_region.called
            assert parser.get_integration_from_request() is None

    @patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_interactions_endpoint_routing_command(self, mock_verify_signature):
        mock_verify_signature.return_value = None
        data = {
            "guild_id": self.integration.external_id,
            "data": {"name": "command_name"},
            "type": int(DiscordRequestTypes.COMMAND),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        with patch.object(
            parser, "get_response_from_first_region"
        ) as mock_respond_from_first_region, assume_test_silo_mode(
            SiloMode.CONTROL, can_be_monolith=False
        ):
            parser.get_response()
            assert mock_respond_from_first_region.called
        integration = parser.get_integration_from_request()
        assert integration == self.integration

    @patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_interactions_endpoint_routing_command_no_integration(self, mock_verify_signature):
        mock_verify_signature.return_value = None
        data = {
            "data": {"name": "command_name"},
            "type": int(DiscordRequestTypes.COMMAND),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        with patch.object(parser, "get_regions_from_organizations", return_value=[]), patch.object(
            parser, "get_response_from_first_region"
        ) as mock_respond_from_first_region, patch.object(
            parser, "get_response_from_control_silo"
        ) as mock_response_from_control, assume_test_silo_mode(
            SiloMode.CONTROL, can_be_monolith=False
        ):
            parser.get_response()
            assert not mock_respond_from_first_region.called
            assert mock_response_from_control.called
        assert parser.get_integration_from_request() is None

    @patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_interactions_endpoint_routing_message_component(self, mock_verify_signature):
        mock_verify_signature.return_value = None
        data = {
            "guild_id": self.integration.external_id,
            "type": int(DiscordRequestTypes.MESSAGE_COMPONENT),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        with patch.object(
            parser, "get_response_from_all_regions"
        ) as mock_response_from_all, assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            parser.get_response()
            assert mock_response_from_all.called
        integration = parser.get_integration_from_request()
        assert integration == self.integration

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
        for path in [link_path, unlink_path]:
            parser = self.get_parser(path)

            # Forwards to control silo
            with patch.object(
                parser, "get_response_from_outbox_creation"
            ) as get_response_from_outbox_creation, patch.object(
                parser, "get_response_from_control_silo"
            ) as mock_response_from_control, assume_test_silo_mode(
                SiloMode.CONTROL, can_be_monolith=False
            ):
                parser.get_response()
                assert mock_response_from_control.called
                assert not get_response_from_outbox_creation.called

            parser_integration = parser.get_integration_from_request()
            assert parser_integration.id == self.integration.id

    @patch("sentry.middleware.integrations.parsers.discord.convert_to_async_discord_response")
    @patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_triggers_async_response(self, mock_verify_signature, mock_discord_task):
        mock_verify_signature.return_value = None
        response_url = "https://discord.com/api/v10/webhooks/application_id/token"
        data = {
            "application_id": "application_id",
            "token": "token",
            "guild_id": self.integration.external_id,
            "data": {"name": "command_name"},
            "type": int(DiscordRequestTypes.COMMAND),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        response = parser.get_response()
        webhook_payload = ControlOutbox.get_webhook_payload_from_request(request=self.request)
        payload = dataclasses.asdict(webhook_payload)
        mock_discord_task.apply_async.assert_called_once_with(
            kwargs={
                "region_names": ["us"],
                "payload": payload,
                "response_url": response_url,
            }
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert json.loads(response.content) == parser.async_response_data


@control_silo_test
class End2EndTest(APITestCase):
    def test_validation_failure(self):
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            response = self.client.post(
                reverse("sentry-integration-discord-interactions"),
                data={"type": DiscordRequestTypes.PING},
            )
            assert response.status_code == 401
            assert not response.content

    @patch("sentry.integrations.discord.requests.base.verify_signature", return_value=None)
    def test_discord_interaction_endpoint(self, mock_verify_signature):
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
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

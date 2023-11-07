from __future__ import annotations

from typing import Any, Mapping
from unittest.mock import MagicMock, patch

import pytest
from django.test import RequestFactory
from django.urls import reverse

from sentry.integrations.discord.requests.base import DiscordRequestTypes
from sentry.middleware.integrations.parsers.discord import DiscordRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.region import Region, RegionCategory
from sentry.utils.signing import sign


@control_silo_test(stable=True)
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
        self.request = self.factory.post(path, data=data, content_type="application/json")
        return DiscordRequestParser(self.request, self.get_response)

    def test_interactions_endpoint_routing_ping(self):
        data = {"guild_id": self.integration.external_id, "type": DiscordRequestTypes.PING}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        integration = parser.get_integration_from_request()
        assert integration == self.integration
        with patch.object(
            parser, "get_response_from_control_silo"
        ) as mock_response_from_control, assume_test_silo_mode(
            SiloMode.CONTROL, can_be_monolith=False
        ):
            parser.get_response()
            assert mock_response_from_control.called

    def test_interactions_endpoint_routing_command(self):
        data = {"guild_id": self.integration.external_id, "type": int(DiscordRequestTypes.COMMAND)}
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        integration = parser.get_integration_from_request()
        assert integration == self.integration
        with patch.object(
            parser, "get_response_from_first_region"
        ) as mock_respond_from_first, assume_test_silo_mode(
            SiloMode.CONTROL, can_be_monolith=False
        ):
            parser.get_response()
            assert mock_respond_from_first.called

    def test_interactions_endpoint_routing_message_component(self):
        data = {
            "guild_id": self.integration.external_id,
            "type": int(DiscordRequestTypes.MESSAGE_COMPONENT),
        }
        parser = self.get_parser(reverse("sentry-integration-discord-interactions"), data=data)
        integration = parser.get_integration_from_request()
        assert integration == self.integration
        with patch.object(
            parser, "get_response_from_all_regions"
        ) as mock_response_from_all, assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            parser.get_response()
            assert mock_response_from_all.called

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
            parser_integration = parser.get_integration_from_request()
            assert parser_integration.id == self.integration.id

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

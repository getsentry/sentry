from __future__ import annotations

from typing import Any
from unittest import mock

import orjson
import pytest
from django.test import override_settings

from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.taskworker.adapters import ViewerContextHook
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)


@control_silo_test
class DiscordRequestTest(TestCase):
    def mock_request(self, request_data: dict[str, Any] | None = None) -> DiscordRequest:
        self.request = mock.Mock()
        self.request.data = (
            {
                "type": 1,
                "guild_id": "guild-id",
                "channel_id": "channel-id",
                "member": {
                    "user": {
                        "id": "user-id",
                    },
                },
            }
            if request_data is None
            else request_data
        )
        self.request.body = orjson.dumps(self.request.data)
        self.request.META = {
            "HTTP_X_SIGNATURE_ED25519": "signature",
            "HTTP_X_SIGNATURE_TIMESTAMP": "timestamp",
        }
        return DiscordRequest(self.request)

    def test_exposes_guild_id(self) -> None:
        discord_request = self.mock_request()
        assert discord_request.guild_id == "guild-id"

    def test_collects_logging_data(self) -> None:
        discord_request = self.mock_request()
        assert discord_request.logging_data == {
            "discord_guild_id": "guild-id",
            "discord_channel_id": "channel-id",
            "discord_user_id": "user-id",
        }

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_collects_logging_data_with_integration_id(
        self, mock_get_integration: mock.MagicMock
    ) -> None:
        discord_request = self.mock_request()
        mock_get_integration.return_value = RpcIntegration(
            id=1,
            provider="discord",
            external_id="guild-id",
            name="Cool server",
            metadata={},
            status=1,
        )
        discord_request.validate_integration()
        assert discord_request.logging_data == {
            "discord_guild_id": "guild-id",
            "discord_channel_id": "channel-id",
            "discord_user_id": "user-id",
            "integration_id": 1,
        }

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_validate_integration(self, mock_get_integration: mock.MagicMock) -> None:
        discord_request = self.mock_request()
        mock_get_integration.return_value = RpcIntegration(
            id=1,
            provider="discord",
            external_id="guild-id",
            name="Cool server",
            metadata={},
            status=1,
        )
        discord_request.validate_integration()
        assert mock_get_integration.call_count == 1
        assert discord_request.integration is not None

    @mock.patch("sentry.integrations.discord.requests.base.integration_service.get_integration")
    def test_validate_integration_no_integration(
        self, mock_get_integration: mock.MagicMock
    ) -> None:
        discord_request = self.mock_request()
        mock_get_integration.return_value = None
        discord_request.validate_integration()
        assert mock_get_integration.call_count == 1
        assert discord_request.integration is None

    def test_get_command_name(self) -> None:
        discord_request = self.mock_request(
            {
                "type": 2,
                "guild_id": "guild-id",
                "channel_id": "channel-id",
                "data": {
                    "name": "test_command",
                },
            }
        )
        res = discord_request.get_command_name()
        assert res == "test_command"

    def test_get_command_name_not_command(self) -> None:
        discord_request = self.mock_request()
        res = discord_request.get_command_name()
        assert res == ""

    def test_validate_identity_flow(self) -> None:
        integration = self.create_integration(
            self.organization, provider="discord", external_id="guild-id"
        )
        provider = self.create_identity_provider(integration=integration)
        self.create_identity(user=self.user, identity_provider=provider, external_id="user-id")

        discord_request = self.mock_request()
        discord_request._validate_identity()
        user = discord_request.get_identity_user()
        assert user is not None
        assert user.id == self.user.id

    def test_linked_user_preserves_scope(self) -> None:
        self.assert_validated_request_actor(True, True)

    def test_linked_user_without_scope(self) -> None:
        self.assert_validated_request_actor(True, False)

    def test_unlinked_user_preserves_scope(self) -> None:
        self.assert_validated_request_actor(False, True)

    def test_unlinked_user_without_scope(self) -> None:
        self.assert_validated_request_actor(False, False)

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def assert_validated_request_actor(self, linked: bool, scoped: bool) -> None:
        discord_request = self.mock_request()
        current = ViewerContext(
            actor=Actor(type=ActorType.USER, actor_id=self.user.id),
            organization_id=self.organization.id if scoped else None,
            project_id=self.project.id if scoped else None,
        )
        with (
            viewer_context_scope(current),
            mock.patch.object(discord_request, "authorize"),
            mock.patch.object(
                discord_request,
                "get_identity_user",
                return_value=serialize_rpc_user(self.user) if linked else None,
            ),
        ):
            discord_request.validate()
            headers: dict[str, str] = {}
            ViewerContextHook().on_dispatch(headers)
            ctx = ViewerContext.deserialize(orjson.loads(headers["sentry-viewer-context"]))
            assert ctx.actor.type == (ActorType.USER if linked else ActorType.INTEGRATION)
            assert ctx.actor.user_id == (self.user.id if linked else None)
            assert ctx.organization_id == current.organization_id
            assert ctx.project_id == current.project_id

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_invalid_signature_does_not_set_actor(self) -> None:
        discord_request = self.mock_request()
        current = ViewerContext(actor=Actor(type=ActorType.UNKNOWN))
        with (
            viewer_context_scope(current),
            mock.patch.object(discord_request, "authorize", side_effect=DiscordRequestError(401)),
            mock.patch.object(discord_request, "_set_viewer_context_actor") as set_actor,
        ):
            with pytest.raises(DiscordRequestError):
                discord_request.validate()
            set_actor.assert_not_called()
            assert get_viewer_context() is current

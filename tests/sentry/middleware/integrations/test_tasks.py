from unittest.mock import MagicMock, patch

import responses
from django.test import RequestFactory
from django.urls import reverse
from responses import matchers

from sentry.integrations.discord.client import DISCORD_BASE_URL
from sentry.integrations.discord.requests.base import DiscordRequestTypes
from sentry.integrations.middleware.hybrid_cloud.parser import create_async_request_payload
from sentry.integrations.slack.requests.event import SeerResolutionResult
from sentry.middleware.integrations.tasks import (
    convert_to_async_discord_response,
    convert_to_async_slack_response,
    route_slack_seer_event,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.silo import control_silo_test, create_test_cells
from sentry.types.cell import Cell, RegionCategory
from sentry.utils import json


@control_silo_test
class AsyncSlackResponseTest(TestCase):
    factory = RequestFactory()
    us = Cell("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    eu = Cell("eu", 2, "https://eu.testserver", RegionCategory.MULTI_TENANT)
    cell_config = (us, eu)

    def setUp(self) -> None:
        super().setUp()
        self.response_url = "https://hooks.slack.com/commands/TXXXXXXX1/1234567890123/something"
        slack_payload = {"team_id": "TXXXXXXX1", "response_url": self.response_url}
        data = {"payload": json.dumps(slack_payload)}
        action_request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        self.payload = create_async_request_payload(action_request)

    @responses.activate
    @override_cells(cell_config)
    def test_convert_to_async_slack_response_all_success(self) -> None:
        responses.add(
            responses.POST,
            "https://us.testserver/extensions/slack/action/",
            status=200,
            json={"ok": True, "region": "us"},
        )
        responses.add(
            responses.POST,
            "https://eu.testserver/extensions/slack/action/",
            status=200,
            json={"ok": True, "region": "eu"},
        )
        slack_response = responses.add(
            responses.POST,
            self.response_url,
            status=200,
        )
        convert_to_async_slack_response(
            cell_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert slack_response.call_count == 1

    @responses.activate
    @override_cells(cell_config)
    def test_convert_to_async_slack_response_mixed_success(self) -> None:
        responses.add(
            responses.POST,
            "https://us.testserver/extensions/slack/action/",
            status=404,
            json={"ok": False, "region": "us"},
        )
        responses.add(
            responses.POST,
            "https://eu.testserver/extensions/slack/action/",
            status=200,
            json={"ok": True, "region": "eu"},
        )
        slack_response = responses.add(
            responses.POST,
            self.response_url,
            status=200,
            # Matcher ensures successful EU response was sent to Slack
            match=[matchers.json_params_matcher({"ok": True, "region": "eu"})],
        )
        convert_to_async_slack_response(
            cell_names=["us", "eu"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert slack_response.call_count == 1

    @responses.activate
    @override_cells(cell_config)
    def test_convert_to_async_slack_response_no_success(self) -> None:
        responses.add(
            responses.POST,
            "https://us.testserver/extensions/slack/action/",
            status=404,
            json={"ok": False, "region": "us"},
        )
        responses.add(
            responses.POST,
            "https://eu.testserver/extensions/slack/action/",
            status=404,
            json={"ok": False, "region": "eu"},
        )
        slack_response = responses.add(
            responses.POST,
            self.response_url,
            status=200,
        )
        convert_to_async_slack_response(
            cell_names=["us", "eu"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert slack_response.call_count == 0

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.middleware.integrations.tasks.logger.info")
    def test_empty_request_bdoy(self, mock_logger_info: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://us.testserver/extensions/slack/action/",
            status=404,
        )
        responses.add(
            responses.POST,
            "https://eu.testserver/extensions/slack/action/",
            status=204,
        )
        slack_response = responses.add(
            responses.POST,
            self.response_url,
            status=200,
        )
        convert_to_async_slack_response(
            cell_names=["us", "eu"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert slack_response.call_count == 0
        mock_logger_info.assert_called


@control_silo_test
class AsyncDiscordResponseTest(TestCase):
    factory = RequestFactory()
    us = Cell("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    eu = Cell("eu", 2, "https://eu.testserver", RegionCategory.MULTI_TENANT)
    cell_config = (us, eu)

    def setUp(self) -> None:
        super().setUp()
        application_id = "some-app-id"
        token = "some-token"
        self.response_url = f"{DISCORD_BASE_URL}/webhooks/{application_id}/{token}"
        data = {
            "application_id": application_id,
            "token": token,
            "guild_id": self.integration.external_id,
            "data": {"name": "command_name"},
            "type": int(DiscordRequestTypes.COMMAND),
        }
        action_request = self.factory.post(
            reverse("sentry-integration-discord-interactions"),
            data=data,
            content_type="application/json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )
        self.payload = create_async_request_payload(action_request)

    @responses.activate
    @override_cells(cell_config)
    def test_convert_to_async_discord_response_all_success(self) -> None:
        responses.add(
            responses.POST,
            "https://us.testserver/extensions/discord/interactions/",
            status=200,
            json={"data": {"ok": True, "region": "us"}},
        )
        responses.add(
            responses.POST,
            "https://eu.testserver/extensions/discord/interactions/",
            status=200,
            json={"data": {"ok": True, "region": "eu"}},
        )
        discord_response = responses.add(
            responses.POST,
            self.response_url,
            status=200,
        )
        convert_to_async_discord_response(
            cell_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert discord_response.call_count == 1

    @responses.activate
    @override_cells(cell_config)
    def test_convert_to_async_discord_response_mixed_success(self) -> None:
        responses.add(
            responses.POST,
            "https://us.testserver/extensions/discord/interactions/",
            status=404,
            json={"data": {"ok": False, "region": "us"}},
        )
        responses.add(
            responses.POST,
            "https://eu.testserver/extensions/discord/interactions/",
            status=200,
            json={"data": {"ok": True, "region": "eu"}},
        )
        discord_response = responses.add(
            responses.POST,
            self.response_url,
            status=200,
            # Matcher ensures successful EU response was sent to Discord
            match=[matchers.json_params_matcher({"ok": True, "region": "eu"})],
        )
        convert_to_async_discord_response(
            cell_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert discord_response.call_count == 1

    @responses.activate
    @override_cells(cell_config)
    def test_convert_to_async_discord_response_no_success(self) -> None:
        responses.add(
            responses.POST,
            "https://us.testserver/extensions/discord/interactions/",
            status=404,
            json={"data": {"ok": False, "region": "us"}},
        )
        responses.add(
            responses.POST,
            "https://eu.testserver/extensions/discord/interactions/",
            status=404,
            json={"data": {"ok": False, "region": "eu"}},
        )
        discord_response = responses.add(
            responses.POST,
            self.response_url,
            status=200,
        )
        convert_to_async_discord_response(
            cell_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert discord_response.call_count == 0


@control_silo_test(cells=create_test_cells("us"))
class RouteSlackSeerEventTest(TestCase):
    factory = RequestFactory()

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="T1", provider="slack"
        )
        slack_body = {
            "type": "event_callback",
            "team_id": "T1",
            "event": {"type": "app_mention", "user": "U_SLACK", "channel": "C1", "ts": "1.0"},
        }
        event_request = self.factory.post(
            reverse("sentry-integration-slack-event"),
            data=json.dumps(slack_body),
            content_type="application/json",
        )
        self.payload = create_async_request_payload(event_request)

    def _run_task(self, *, integration_id: int | None = None) -> None:
        route_slack_seer_event(
            payload=self.payload,
            integration_id=integration_id if integration_id is not None else self.integration.id,
            slack_user_id="U_SLACK",
            channel_id="C1",
            thread_ts="",
        )

    @responses.activate
    @patch("sentry.middleware.integrations.tasks.resolve_seer_organization_for_slack_user")
    def test_forwards_to_resolved_cell(self, mock_resolve: MagicMock) -> None:
        mock_resolve.return_value = SeerResolutionResult(
            organization_id=self.organization.id, error_reason=None
        )
        cell_response = responses.add(
            responses.POST,
            "http://us.testserver/extensions/slack/event/",
            status=200,
            body=b"",
        )

        self._run_task()

        assert cell_response.call_count == 1

    @responses.activate
    @patch("sentry.middleware.integrations.tasks.send_halt_message")
    @patch("sentry.middleware.integrations.tasks.resolve_seer_organization_for_slack_user")
    def test_sends_halt_message_when_unresolved(
        self, mock_resolve: MagicMock, mock_send_halt: MagicMock
    ) -> None:
        from sentry.integrations.messaging.metrics import SeerSlackHaltReason

        mock_resolve.return_value = SeerResolutionResult(
            organization_id=None, error_reason=SeerSlackHaltReason.IDENTITY_NOT_LINKED
        )
        cell_response = responses.add(
            responses.POST,
            "http://us.testserver/extensions/slack/event/",
            status=200,
            body=b"",
        )

        self._run_task()

        assert cell_response.call_count == 0
        mock_send_halt.assert_called_once()
        assert mock_send_halt.call_args.kwargs["halt_reason"] == (
            SeerSlackHaltReason.IDENTITY_NOT_LINKED
        )

    @patch("sentry.middleware.integrations.tasks.resolve_seer_organization_for_slack_user")
    def test_missing_integration_is_noop(self, mock_resolve: MagicMock) -> None:
        self._run_task(integration_id=99999)
        mock_resolve.assert_not_called()

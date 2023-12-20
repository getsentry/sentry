import dataclasses

import responses
from django.test import RequestFactory
from django.urls import reverse
from responses import matchers

from sentry.integrations.discord.requests.base import DiscordRequestTypes
from sentry.middleware.integrations.tasks import (
    convert_to_async_discord_response,
    convert_to_async_slack_response,
)
from sentry.models.outbox import ControlOutbox
from sentry.testutils.cases import TestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory
from sentry.utils import json


@control_silo_test
class AsyncSlackResponseTest(TestCase):
    factory = RequestFactory()
    us = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    eu = Region("eu", 2, "https://eu.testserver", RegionCategory.MULTI_TENANT)
    region_config = (us, eu)

    def setUp(self):
        super().setUp()
        self.response_url = "https://hooks.slack.com/commands/TXXXXXXX1/1234567890123/something"
        slack_payload = {"team_id": "TXXXXXXX1", "response_url": self.response_url}
        data = {"payload": json.dumps(slack_payload)}
        action_request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        webhook_payload = ControlOutbox.get_webhook_payload_from_request(request=action_request)
        self.payload = dataclasses.asdict(webhook_payload)

    @responses.activate
    @override_regions(region_config)
    def test_convert_to_async_slack_response_all_success(self):
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
            region_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert slack_response.call_count == 1

    @responses.activate
    @override_regions(region_config)
    def test_convert_to_async_slack_response_mixed_success(self):
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
            region_names=["us", "eu"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert slack_response.call_count == 1

    @responses.activate
    @override_regions(region_config)
    def test_convert_to_async_slack_response_no_success(self):
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
            region_names=["us", "eu"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert slack_response.call_count == 0


@control_silo_test
class AsyncDiscordResponseTest(TestCase):
    factory = RequestFactory()
    us = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    eu = Region("eu", 2, "https://eu.testserver", RegionCategory.MULTI_TENANT)
    region_config = (us, eu)

    def setUp(self):
        super().setUp()
        application_id = "some-app-id"
        token = "some-token"
        self.response_url = f"https://discord.com/api/v10/webhooks/{application_id}/{token}"
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
        webhook_payload = ControlOutbox.get_webhook_payload_from_request(request=action_request)
        self.payload = dataclasses.asdict(webhook_payload)

    @responses.activate
    @override_regions(region_config)
    def test_convert_to_async_discord_response_all_success(self):
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
            region_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert discord_response.call_count == 1

    @responses.activate
    @override_regions(region_config)
    def test_convert_to_async_discord_response_mixed_success(self):
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
            region_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert discord_response.call_count == 1

    @responses.activate
    @override_regions(region_config)
    def test_convert_to_async_discord_response_no_success(self):
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
            region_names=["eu", "us"],
            payload=self.payload,
            response_url=self.response_url,
        )
        assert discord_response.call_count == 0

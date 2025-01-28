from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from unittest.mock import patch
from urllib.parse import urlencode

import orjson
import pytest
from django.http.response import HttpResponse
from django.urls import reverse
from rest_framework import status
from slack_sdk.web import SlackResponse
from slack_sdk.webhook import WebhookResponse

from sentry import options
from sentry.integrations.slack.utils.auth import set_signing_secret
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import install_slack, link_team, link_user
from sentry.testutils.silo import assume_test_silo_mode


class SlackCommandsTest(APITestCase, TestCase):
    endpoint = "sentry-integration-slack-commands"
    method = "post"

    def setUp(self):
        super().setUp()

        self.slack_id = "UXXXXXXX1"
        self.external_id = "new-slack-id"
        self.channel_name = "my-channel"
        self.channel_id = "my-channel_id"
        self.response_url = "http://example.slack.com/response_url"

        self.integration = install_slack(self.organization, self.external_id)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.idp = self.create_identity_provider(
                type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
                external_id=self.external_id,
                config={},
            )
        self.login_as(self.user)

    def send_slack_message(self, command: str, **kwargs: Any) -> dict[str, str]:
        response = self.get_slack_response(
            {
                "text": command,
                "team_id": self.external_id,
                "user_id": self.slack_id,
                "channel_id": self.channel_id,
                **kwargs,
            }
        )
        return orjson.loads(response.content)

    def link_user(self) -> None:
        return link_user(user=self.user, idp=self.idp, slack_id=self.slack_id)

    def link_team(self, team: Team | None = None) -> None:
        return link_team(
            team=team or self.team,
            integration=self.integration,
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )

    def get_slack_response(
        self, payload: Mapping[str, str], status_code: int | None = None
    ) -> HttpResponse:
        """Shadow get_success_response but with a non-JSON payload."""
        data = urlencode(payload).encode("utf-8")
        response = self.client.post(
            reverse(self.endpoint),
            content_type="application/x-www-form-urlencoded",
            data=data,
            **set_signing_secret(options.get("slack.signing-secret"), data),
        )
        assert response.status_code == (status_code or status.HTTP_200_OK)
        return response

    @pytest.fixture(autouse=True)
    def mock_webhook_send(self):
        with patch(
            "slack_sdk.webhook.WebhookClient.send",
            return_value=WebhookResponse(
                url="",
                body='{"ok": true}',
                headers={},
                status_code=200,
            ),
        ) as self.mock_webhook:
            yield

    @pytest.fixture(autouse=True)
    def mock_chat_postMessage(self):
        with patch(
            "slack_sdk.web.WebClient.chat_postMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield

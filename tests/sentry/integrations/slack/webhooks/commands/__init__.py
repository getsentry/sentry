from __future__ import annotations

from typing import Any, Mapping
from urllib.parse import urlencode

from django.http.response import HttpResponse
from django.urls import reverse
from rest_framework import status

from sentry import options
from sentry.integrations.slack.utils import set_signing_secret
from sentry.models.identity import Identity, IdentityProvider
from sentry.models.team import Team
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import find_identity, install_slack, link_team, link_user
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json


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
            self.idp = IdentityProvider.objects.create(
                type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
                external_id=self.external_id,
                config={},
            )
        self.login_as(self.user)

    def send_slack_message(self, command: str, **kwargs: Any) -> Mapping[str, str]:
        response = self.get_slack_response(
            {
                "text": command,
                "team_id": self.external_id,
                "user_id": self.slack_id,
                "channel_id": self.channel_id,
                **kwargs,
            }
        )
        return json.loads(str(response.content.decode("utf-8")))

    def find_identity(self) -> Identity | None:
        return find_identity(idp=self.idp, user=self.user)

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

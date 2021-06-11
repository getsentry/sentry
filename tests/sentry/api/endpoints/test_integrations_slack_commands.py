from typing import Mapping, Optional
from urllib.parse import urlencode

from django.urls import reverse
from requests import Response
from rest_framework import status

from sentry import options
from sentry.integrations.slack.util.auth import set_signing_secret
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils import json


def assert_is_help_text(response: Response) -> None:
    data = json.loads(str(response.content.decode("utf-8")))
    assert "Available Commands" in data["text"]


class SlackCommandsTest(APITestCase):
    endpoint = "sentry-integration-slack-commands"

    def get_slack_response(
        self, payload: Mapping[str, str], status_code: Optional[str] = None
    ) -> Response:
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

    def setUp(self):
        super().setUp()
        self.external_id = "slack:1"
        self.integration = Integration.objects.create(
            provider="slack", name="Slack", external_id=self.external_id
        )


class SlackCommandsGetTest(SlackCommandsTest):
    def test_method_get_not_allowed(self):
        self.get_error_response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED)


class SlackCommandsPostTest(SlackCommandsTest):
    method = "post"

    def test_invalid_signature(self):
        # The `get_error_response` method doesn't use a signature.
        self.get_error_response(status_code=status.HTTP_400_BAD_REQUEST)

    def test_missing_team(self):
        self.get_slack_response({"text": ""}, status_code=status.HTTP_403_FORBIDDEN)

    def test_missing_command(self):
        response = self.get_slack_response({"text": "", "team_id": self.external_id})
        assert_is_help_text(response)

    def test_invalid_command(self):
        response = self.get_slack_response({"text": "invalid command", "team_id": self.external_id})
        assert_is_help_text(response)

    def test_help_command(self):
        response = self.get_slack_response({"text": "help", "team_id": self.external_id})
        assert_is_help_text(response)

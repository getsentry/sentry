from typing import Mapping
from urllib.parse import urlencode

from django.urls import reverse
from requests import Response

from sentry.testutils import APITestCase
from sentry.utils import json


def assert_is_help_text(response: Response) -> None:
    data = json.loads(str(response.content))
    assert "Available Commands" in data["blocks"][0]["text"]["text"]


# TODO MARCOS FIRST don't send this to github again
def create_payload():
    return {}


class SlackCommandsTest(APITestCase):
    endpoint = "sentry-integration-slack-commands"

    def get_slack_response(self, payload: Mapping[str, str]) -> Response:
        """Shadow get_success_response but with a non-JSON payload."""
        response = self.client.post(
            reverse(self.endpoint),
            content_type="application/x-www-form-urlencoded",
            data=urlencode(payload).encode("utf-8"),
        )
        assert response.status_code == 200
        return response

    def setUp(self):
        pass


class SlackCommandsGetTest(SlackCommandsTest):
    def test_method_not_allowed(self):
        self.get_error_response(status_code=405)


class SlackCommandsPostTest(SlackCommandsTest):
    method = "post"

    def test_invalid_signature(self):
        # The `get_error_response` method doesn't use a signature.
        self.get_error_response(status_code=400)

    def test_missing_command(self):
        response = self.get_slack_response({"text": ""})
        assert_is_help_text(response)

    def test_invalid_command(self):
        response = self.get_slack_response({"text": "invalid command"})
        assert_is_help_text(response)

    def test_help_command(self):
        response = self.get_slack_response({"text": "help"})
        assert_is_help_text(response)

    def test_link_command(self):
        self.get_slack_response({"text": "link"})

    def test_unlink_command(self):
        self.get_slack_response({"text": "unlink"})

    def test_link_command_already_linked(self):
        self.get_slack_response({"text": "link"})

    def test_unlink_command_already_unlinked(self):
        self.get_slack_response({"text": "unlink"})

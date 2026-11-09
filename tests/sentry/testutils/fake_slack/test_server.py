import threading
from collections.abc import Generator
from pathlib import Path
from urllib.request import Request, urlopen

import pytest
from django.test import override_settings
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from sentry.integrations.slack.sdk_client import SlackSdkClient, slack_api_base_url
from sentry.testutils.cases import TestCase
from sentry.testutils.fake_slack.server import FakeSlack, make_server
from sentry.utils import json


class FakeSlackServerTest(TestCase):
    @pytest.fixture(autouse=True)
    def _fake_slack(self, tmp_path: Path) -> Generator[None]:
        self.state_file = tmp_path / "fake-slack.json"
        self.slack = FakeSlack(self.state_file, "https://fake-slack.example.com")
        server = make_server("127.0.0.1", 0, self.slack)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        self.url = f"http://127.0.0.1:{server.server_address[1]}"
        try:
            yield
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_slack_client_posts_to_fake_slack(self) -> None:
        assert slack_api_base_url() == WebClient.BASE_URL

        integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            external_id="T0FAKE",
            metadata={"access_token": "xoxb-fake-slack"},
        )
        blocks = [{"type": "section", "text": {"type": "mrkdwn", "text": "*Issue* alert"}}]
        with override_settings(SENTRY_SLACK_API_BASE_URL=f"{self.url}/api/"):
            client = SlackSdkClient(integration_id=integration.id)
            assert client.base_url == f"{self.url}/api/"

            posted = client.chat_postMessage(channel="#alerts", text="Issue alert", blocks=blocks)
            reply = client.chat_postMessage(channel="C0ALERTS", thread_ts=posted["ts"], text="Re")
            client.chat_update(channel="#alerts", ts=posted["ts"], text="Issue resolved")
            permalink = client.chat_getPermalink(channel="#alerts", message_ts=reply["ts"])
            new_channel = client.chat_postMessage(channel="#new-channel", text="Hello")
            with pytest.raises(SlackApiError, match="message_not_found"):
                client.chat_update(channel="#alerts", ts="1.0", text="Missing")

        assert posted["channel"] == "C0ALERTS"
        assert permalink["permalink"] == (
            f"https://fake-slack.example.com/#C0ALERTS/{posted['ts']}/{reply['ts']}"
        )

        with urlopen(f"{self.url}/state.json") as response:
            state = json.loads(response.read())
        assert state["team"]["id"] == "T0FAKE"
        assert state["channels"][new_channel["channel"]] == "new-channel"
        root, thread_reply, hello = state["messages"]
        assert root["text"] == "Issue resolved"
        assert root["blocks"] == blocks
        assert root["edited"] is not None
        assert thread_reply["thread_ts"] == posted["ts"]
        assert hello["channel"] == new_channel["channel"]
        assert FakeSlack(self.state_file, self.url).snapshot() == state

        with urlopen(self.url) as response:
            assert b"<title>Fake Slack</title>" in response.read()
        urlopen(Request(f"{self.url}/reset", method="POST")).close()
        assert self.slack.snapshot()["messages"] == []

    def test_unsimulated_methods_succeed(self) -> None:
        assert self.slack.call("views.open", {"trigger_id": "123"}) == {
            "ok": True,
            "fake_slack": "views.open is not simulated",
        }

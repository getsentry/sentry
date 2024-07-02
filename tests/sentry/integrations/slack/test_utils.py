from unittest.mock import patch

import orjson
import responses

from sentry.integrations.slack.sdk_client import SLACK_DATADOG_METRIC
from sentry.integrations.slack.utils import get_channel_id
from sentry.integrations.slack.utils.channel import (
    CHANNEL_PREFIX,
    MEMBER_PREFIX,
    SlackChannelIdData,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class GetChannelIdTest(TestCase):
    def setUp(self):
        self.resp = responses.mock
        self.resp.__enter__()

        self.integration = install_slack(self.event.project.organization)

        self.response_json = {
            "ok": True,
            "members": [
                {
                    "id": "UXXXXXXX1",
                    "name": "patrick-jane",
                },
                {
                    "id": "UXXXXXXX2",
                    "name": "theresa-lisbon",
                },
                {
                    "id": "UXXXXXXX3",
                    "name": "kimball-cho",
                },
                {
                    "id": "UXXXXXXX4",
                    "name": "grace-van-pelt",
                },
                {
                    "id": "UXXXXXXX4",
                    "name": "wayne-rigsby",
                },
            ],
            "response_metadata": {"next_cursor": ""},
        }

    def run_valid_test(self, channel, expected_prefix, expected_id, timed_out):
        assert SlackChannelIdData(expected_prefix, expected_id, timed_out) == get_channel_id(
            self.organization, self.integration, channel
        )

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_valid_channel_selected(self, mock_api_call, mock_metrics):
        # Tests chat_scheduleMessage and chat_deleteScheduledMessage
        mock_api_call.return_value = {
            "body": orjson.dumps(
                {"ok": True, "channel": "m-c", "scheduled_message_id": "Q1298393284"}
            ).decode(),
            "headers": {},
            "status": 200,
        }

        self.run_valid_test("#My-Channel", CHANNEL_PREFIX, "m-c", False)

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": True, "status": 200},
        )

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_valid_private_channel_selected(self, mock_api_call, mock_metrics):
        # Tests chat_scheduleMessage and chat_deleteScheduledMessage
        mock_api_call.return_value = {
            "body": orjson.dumps(
                {"ok": True, "channel": "m-p-c", "scheduled_message_id": "Q1298393284"}
            ).decode(),
            "headers": {},
            "status": 200,
        }

        self.run_valid_test("#my-private-channel", CHANNEL_PREFIX, "m-p-c", False)

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": True, "status": 200},
        )

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_invalid_channel_selected(self, mock_api_call, mock_metrics):
        # Tests chat_scheduleMessage and chat_deleteScheduledMessage
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": False, "error": "channel_not_found"}).decode(),
            "headers": {},
            "status": 200,
        }

        assert (
            get_channel_id(self.organization, self.integration, "#fake-channel").channel_id is None
        )
        assert get_channel_id(self.organization, self.integration, "@fake-user").channel_id is None

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_rate_limiting(self, mock_api_call):
        """Should handle 429 from Slack when searching for users"""
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": False, "error": "ratelimited"}).decode(),
            "headers": {},
            "status": 429,
        }

        assert get_channel_id(
            self.organization, self.integration, "@fake-user"
        ) == SlackChannelIdData(prefix="", channel_id=None, timed_out=False)

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_user_list_pagination(self, mock_api_call):
        self.response_json["response_metadata"] = {"next_cursor": "dXNlcjpVMEc5V0ZYTlo"}
        mock_api_call.return_value = {
            "body": orjson.dumps(self.response_json).decode(),
            "headers": {},
            "status": 200,
        }

        self.run_valid_test("@wayne-rigsby", MEMBER_PREFIX, "UXXXXXXX4", False)

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_user_list_multi_pagination(self, mock_api_call):
        self.response_json["response_metadata"] = {"next_cursor": "dXNlcjpVMEc5V0ZYTlo"}
        mock_api_call.side_effect = [
            {
                "body": orjson.dumps(self.response_json).decode(),
                "headers": {},
                "status": 200,
            },
            {
                "body": orjson.dumps(
                    {
                        "ok": True,
                        "members": [
                            {
                                "id": "UXXXXXXX5",
                                "name": "red-john",
                            },
                        ],
                        "response_metadata": {"next_cursor": ""},
                    }
                ).decode(),
                "headers": {},
                "status": 200,
            },
        ]

        self.run_valid_test("@red-john", MEMBER_PREFIX, "UXXXXXXX5", False)

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_user_list_pagination_failure(self, mock_api_call):
        self.response_json["response_metadata"] = {"next_cursor": "dXNlcjpVMEc5V0ZYTlo"}
        mock_api_call.side_effect = [
            {
                "body": orjson.dumps(self.response_json).decode(),
                "headers": {},
                "status": 200,
            },
            {
                "body": orjson.dumps({"ok": False}).decode(),
                "headers": {},
                "status": 200,
            },
        ]

        assert get_channel_id(
            self.organization, self.integration, "@red-john"
        ) == SlackChannelIdData(prefix="", channel_id=None, timed_out=False)

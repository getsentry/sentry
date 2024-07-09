from unittest.mock import patch

import orjson
import pytest
import responses
from slack_sdk.web.slack_response import SlackResponse

from sentry.integrations.slack.sdk_client import SLACK_DATADOG_METRIC
from sentry.integrations.slack.utils import get_channel_id
from sentry.integrations.slack.utils.channel import (
    CHANNEL_PREFIX,
    MEMBER_PREFIX,
    SlackChannelIdData,
)
from sentry.shared_integrations.exceptions import ApiRateLimitedError, DuplicateDisplayNameError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.helpers.features import with_feature
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

    def tearDown(self):
        self.resp.__exit__(None, None, None)

    def add_list_response(self, list_type, channels, result_name="channels"):
        self.resp = responses.mock
        self.resp.add(
            method=responses.GET,
            url="https://slack.com/api/%s.list" % list_type,
            status=200,
            content_type="application/json",
            body=orjson.dumps({"ok": "true", result_name: channels}),
        )

    def add_msg_response(self, channel_id, result_name="channel"):
        if channel_id == "channel_not_found":
            bodydict = {"ok": False, "error": "channel_not_found"}
        else:
            bodydict = {"ok": True, result_name: channel_id, "scheduled_message_id": "Q1298393284"}

        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=orjson.dumps(bodydict),
        )

    def patch_mock_list(self, list_type, channels, result_name="channels"):
        return patch(
            "slack_sdk.web.client.WebClient.%s_list" % list_type,
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/%s.list" % list_type,
                req_args={},
                data={"ok": True, result_name: channels},
                headers={},
                status_code=200,
            ),
        )

    def patch_msg_response(self, channel_id, result_name="channel"):
        if channel_id == "channel_not_found":
            bodydict = {"ok": False, "error": "channel_not_found"}
        else:
            bodydict = {
                "ok": True,
                result_name: channel_id,
                "scheduled_message_id": "Q1298393284",
            }
        return patch(
            "slack_sdk.web.client.WebClient.chat_scheduleMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.scheduleMessage",
                req_args={},
                data=bodydict,
                headers={},
                status_code=200,
            ),
        )

    def run_valid_test(self, channel, expected_prefix, expected_id, timed_out):
        assert SlackChannelIdData(expected_prefix, expected_id, timed_out) == get_channel_id(
            self.organization, self.integration, channel
        )

    def test_valid_channel_selected(self):
        self.add_msg_response("m-c")
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=orjson.dumps({"ok": True}),
        )
        self.run_valid_test("#My-Channel", CHANNEL_PREFIX, "m-c", False)

    @with_feature("organizations:slack-sdk-get-channel-id")
    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_valid_channel_selected_sdk(self, mock_api_call, mock_metrics):
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

    def test_valid_private_channel_selected(self):
        self.add_msg_response("m-p-c")
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=orjson.dumps({"ok": True}),
        )
        self.run_valid_test("#my-private-channel", CHANNEL_PREFIX, "m-p-c", False)

    @with_feature("organizations:slack-sdk-get-channel-id")
    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_valid_private_channel_selected_sdk(self, mock_api_call, mock_metrics):
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

    def test_valid_member_selected(self):
        self.add_msg_response("channel_not_found")
        self.add_list_response(
            "users",
            [
                {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
                {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
                {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
            ],
            result_name="members",
        )
        self.run_valid_test("@first-morty", MEMBER_PREFIX, "m", False)

    @with_feature("organizations:slack-sdk-get-channel-id")
    def test_valid_member_selected_sdk_client(self):
        response_list = [
            {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
            {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
            {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
        ]

        with self.patch_msg_response("channel_not_found"):
            with self.patch_mock_list("users", response_list, "members"):
                self.run_valid_test("@first-morty", MEMBER_PREFIX, "m", False)

    def test_valid_member_selected_display_name(self):
        self.add_msg_response("channel_not_found")
        self.add_list_response(
            "users",
            [
                {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
                {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
                {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
            ],
            result_name="members",
        )
        self.run_valid_test("@Jimbob", MEMBER_PREFIX, "o-u", False)

    @with_feature("organizations:slack-sdk-get-channel-id")
    def test_valid_member_selected_display_name_sdk_client(self):
        response_list = [
            {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
            {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
            {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
        ]

        with self.patch_msg_response("channel_not_found"):
            with self.patch_mock_list("users", response_list, "members"):
                self.run_valid_test("@Jimbob", MEMBER_PREFIX, "o-u", False)

    def test_invalid_member_selected_display_name(self):
        self.add_msg_response("channel_not_found")
        self.add_list_response(
            "users",
            [
                {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
                {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
                {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
            ],
            result_name="members",
        )
        with pytest.raises(DuplicateDisplayNameError):
            get_channel_id(self.organization, self.integration, "@Morty")

    @with_feature("organizations:slack-sdk-get-channel-id")
    def test_invalid_member_selected_display_name_sdk_client(self):
        response_list = [
            {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
            {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
            {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
        ]

        with self.patch_msg_response("channel_not_found"):
            with self.patch_mock_list("users", response_list, "members"):
                with pytest.raises(DuplicateDisplayNameError):
                    get_channel_id(self.organization, self.integration, "@Morty")

    def test_invalid_channel_selected(self):
        self.add_msg_response("channel_not_found")
        assert (
            get_channel_id(self.organization, self.integration, "#fake-channel").channel_id is None
        )
        assert get_channel_id(self.organization, self.integration, "@fake-user").channel_id is None

    @with_feature("organizations:slack-sdk-get-channel-id")
    def test_invalid_channel_selected_sdk_client(self):
        with self.patch_msg_response("channel_not_found"):
            assert (
                get_channel_id(self.organization, self.integration, "#fake-channel").channel_id
                is None
            )
            assert (
                get_channel_id(self.organization, self.integration, "@fake-user").channel_id is None
            )

    def test_rate_limiting(self):
        """Should handle 429 from Slack when searching for users"""
        self.add_msg_response("channel_not_found")
        self.resp.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=429,
            content_type="application/json",
            body=orjson.dumps({"ok": False, "error": "ratelimited"}),
        )
        with pytest.raises(ApiRateLimitedError):
            get_channel_id(self.organization, self.integration, "@user")

    @with_feature("organizations:slack-sdk-get-channel-id")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_rate_limiting_sdk_client(self, mock_api_call):
        """Should handle 429 from Slack when searching for users"""

        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": False, "error": "ratelimited"}).decode(),
            "headers": {},
            "status": 429,
        }

        with self.patch_msg_response("channel_not_found"):
            with pytest.raises(ApiRateLimitedError):
                get_channel_id(self.organization, self.integration, "@user")

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @with_feature("organizations:slack-sdk-get-channel-id")
    def test_user_list_pagination_sdk_client(self, mock_api_call):
        self.response_json["response_metadata"] = {"next_cursor": "dXNlcjpVMEc5V0ZYTlo"}
        mock_api_call.return_value = {
            "body": orjson.dumps(self.response_json).decode(),
            "headers": {},
            "status": 200,
        }

        self.run_valid_test("@wayne-rigsby", MEMBER_PREFIX, "UXXXXXXX4", False)

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @with_feature("organizations:slack-sdk-get-channel-id")
    def test_user_list_multi_pagination_sdk_client(self, mock_api_call):
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
    @with_feature("organizations:slack-sdk-get-channel-id")
    def test_user_list_pagination_failure_sdk_client(self, mock_api_call):
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

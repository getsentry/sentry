from unittest.mock import MagicMock, patch

import orjson
import pytest
from django.core.exceptions import ValidationError
from slack_sdk.errors import SlackApiError
from slack_sdk.web.slack_response import SlackResponse

from sentry.integrations.slack.sdk_client import SLACK_DATADOG_METRIC
from sentry.integrations.slack.utils.channel import (
    CHANNEL_PREFIX,
    MEMBER_PREFIX,
    SlackChannelIdData,
    get_channel_id,
    is_input_a_user_id,
    validate_user_id,
)
from sentry.shared_integrations.exceptions import (
    ApiRateLimitedError,
    DuplicateDisplayNameError,
    IntegrationError,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class GetChannelIdTest(TestCase):
    def setUp(self) -> None:
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

    def patch_msg_response_not_found(self):
        return patch(
            "slack_sdk.web.client.WebClient.chat_scheduleMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.scheduleMessage",
                req_args={},
                data={"ok": False, "error": "channel_not_found"},
                headers={},
                status_code=200,
            ),
        )

    def run_valid_test(self, channel, expected_prefix, expected_id, timed_out):
        assert SlackChannelIdData(expected_prefix, expected_id, timed_out) == get_channel_id(
            self.integration, channel
        )

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_valid_channel_selected_sdk(
        self, mock_api_call: MagicMock, mock_metrics: MagicMock
    ) -> None:
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
    def test_valid_private_channel_selected_sdk(
        self, mock_api_call: MagicMock, mock_metrics: MagicMock
    ) -> None:
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

    def test_valid_member_selected_sdk_client(self) -> None:
        response_list = [
            {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
            {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
            {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
        ]

        with self.patch_msg_response_not_found():
            with self.patch_mock_list("users", response_list, "members"):
                self.run_valid_test("@first-morty", MEMBER_PREFIX, "m", False)

    def test_valid_member_selected_display_name_sdk_client(self) -> None:
        response_list = [
            {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
            {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
            {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
        ]

        with self.patch_msg_response_not_found():
            with self.patch_mock_list("users", response_list, "members"):
                self.run_valid_test("@Jimbob", MEMBER_PREFIX, "o-u", False)

    def test_invalid_member_selected_display_name_sdk_client(self) -> None:
        response_list = [
            {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
            {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
            {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
        ]

        with self.patch_msg_response_not_found():
            with self.patch_mock_list("users", response_list, "members"):
                with pytest.raises(DuplicateDisplayNameError):
                    get_channel_id(self.integration, "@Morty")

    def test_invalid_channel_selected_sdk_client(self) -> None:
        with self.patch_msg_response_not_found():
            assert get_channel_id(self.integration, "#fake-channel").channel_id is None
            assert get_channel_id(self.integration, "@fake-user").channel_id is None

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_rate_limiting_sdk_client(self, mock_api_call: MagicMock) -> None:
        """Should handle 429 from Slack when searching for users"""

        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": False, "error": "ratelimited"}).decode(),
            "headers": {},
            "status": 429,
        }

        with self.patch_msg_response_not_found():
            with pytest.raises(ApiRateLimitedError):
                get_channel_id(self.integration, "@user")

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_user_list_pagination_sdk_client(self, mock_api_call: MagicMock) -> None:
        self.response_json["response_metadata"] = {"next_cursor": "dXNlcjpVMEc5V0ZYTlo"}
        mock_api_call.return_value = {
            "body": orjson.dumps(self.response_json).decode(),
            "headers": {},
            "status": 200,
        }

        self.run_valid_test("@wayne-rigsby", MEMBER_PREFIX, "UXXXXXXX4", False)

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_user_list_multi_pagination_sdk_client(self, mock_api_call: MagicMock) -> None:
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
    def test_user_list_pagination_failure_sdk_client(self, mock_api_call: MagicMock) -> None:
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

        assert get_channel_id(self.integration, "@red-john") == SlackChannelIdData(
            prefix="", channel_id=None, timed_out=False
        )


class IsInputAUserIdTest(TestCase):
    def test_behavior_for_known_slack_identifiers(self) -> None:
        # User IDs
        assert is_input_a_user_id("U12345678")
        assert is_input_a_user_id("W12345678")
        # Non-user IDs
        assert not is_input_a_user_id("C12345678")  # Channel ID
        assert not is_input_a_user_id("T12345678")  # Team ID
        assert not is_input_a_user_id("A12345678")  # App ID
        assert not is_input_a_user_id("F12345678")  # File ID


def create_user_response(*, user):
    return SlackResponse(
        client=None,
        http_verb="POST",
        api_url="https://slack.com/api/users.info",
        req_args={},
        data={"ok": True, "user": user},
        headers={},
        status_code=200,
    )


def create_user_error(*, error, status_code: int = 400):
    return SlackApiError(
        message=error,
        response=SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/users.info",
            req_args={},
            data={"ok": False, "error": error},
            headers={},
            status_code=status_code,
        ),
    )


class ValidateUserIdTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="sentry-workspace",
            provider="slack",
            metadata={"access_token": "abc-123"},
        )
        self.input_id = "U12345678"
        self.slack_user = {
            "id": self.input_id,
            "name": "carmen.sandiego",
            "profile": {
                "display_name": "Carmen Sandiego 🔍",
                "display_name_normalized": "Carmen Sandiego",
            },
        }

    @patch(
        "slack_sdk.web.client.WebClient.users_info",
        side_effect=create_user_error(error="user_not_found"),
    )
    def test_invalid_user(self, mock_client_call: MagicMock) -> None:
        with pytest.raises(ValidationError, match="User not found. Invalid ID provided."):
            validate_user_id(
                input_name="waldo", input_user_id=self.input_id, integration_id=self.integration.id
            )
        assert mock_client_call.call_count == 1

    @patch(
        "slack_sdk.web.client.WebClient.users_info",
        side_effect=create_user_error(error="user_not_visible"),
    )
    def test_user_not_visible(self, mock_client_call: MagicMock) -> None:
        with pytest.raises(
            ValidationError, match="User not visible, you may need to modify your Slack settings."
        ):
            validate_user_id(
                input_name="waldo", input_user_id=self.input_id, integration_id=self.integration.id
            )
        assert mock_client_call.call_count == 1

    @patch(
        "slack_sdk.web.client.WebClient.users_info",
        side_effect=create_user_error(error="ratelimited", status_code=429),
    )
    def test_rate_limited(self, mock_client_call: MagicMock) -> None:
        with pytest.raises(ValidationError, match="Rate limited"):
            validate_user_id(
                input_name="waldo", input_user_id=self.input_id, integration_id=self.integration.id
            )
        assert mock_client_call.call_count == 1

    @patch(
        "slack_sdk.web.client.WebClient.users_info",
        side_effect=create_user_error(error="some-unknown-error", status_code=500),
    )
    def test_unknown_error(self, mock_client_call: MagicMock) -> None:
        with pytest.raises(ValidationError, match="Could not retrieve Slack user information."):
            validate_user_id(
                input_name="waldo", input_user_id=self.input_id, integration_id=self.integration.id
            )
        assert mock_client_call.call_count == 1

    @patch(
        "slack_sdk.web.client.WebClient.users_info",
        return_value=SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/users.info",
            req_args={},
            data="<!doctype html><html><body>why is this html</body></html>",  # type: ignore[arg-type]
            headers={},
            status_code=200,
        ),
    )
    def test_bad_slack_response(self, mock_client_call: MagicMock) -> None:
        with pytest.raises(IntegrationError, match="Bad slack user list response."):
            validate_user_id(
                input_name="waldo",
                input_user_id=self.input_id,
                integration_id=self.integration.id,
            )
        assert mock_client_call.call_count == 1

    def test_no_names_from_slack(self) -> None:
        with patch(
            "slack_sdk.web.client.WebClient.users_info",
            return_value=create_user_response(user={"id": self.input_id}),
        ) as mock_client_call:
            with pytest.raises(ValidationError, match="Did not receive user name from API results"):
                validate_user_id(
                    input_name="waldo",
                    input_user_id=self.input_id,
                    integration_id=self.integration.id,
                )
            assert mock_client_call.call_count == 1

    def test_username_auto_corrected_from_slack(self) -> None:
        """
        When user provides a username that doesn't match what Slack returns,
        the function should return the actual username from Slack (auto-correction).
        This is part of the fix for issue #105478.
        """
        with patch(
            "slack_sdk.web.client.WebClient.users_info",
            return_value=create_user_response(user=self.slack_user),
        ) as mock_client_call:
            # Instead of raising ValidationError, it should return the actual username
            result = validate_user_id(
                input_name="waldo",
                input_user_id=self.input_id,
                integration_id=self.integration.id,
            )
            # Should return the actual username from Slack
            assert result == "carmen.sandiego"
            assert mock_client_call.call_count == 1

    def test_happy_path_does_not_raise(self) -> None:
        with patch(
            "slack_sdk.web.client.WebClient.users_info",
            return_value=create_user_response(user=self.slack_user),
        ) as mock_client_call:
            validate_user_id(
                input_name="Carmen Sandiego",
                input_user_id=self.input_id,
                integration_id=self.integration.id,
            )
            assert mock_client_call.call_count == 1

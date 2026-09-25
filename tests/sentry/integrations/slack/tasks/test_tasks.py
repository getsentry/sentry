from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses

from sentry.integrations.slack.sdk_client import SLACK_DATADOG_METRIC
from sentry.integrations.slack.tasks import post_message
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.skips import requires_snuba
from tests.sentry.integrations.slack.utils.test_mock_slack_response import mock_slack_response

pytestmark = [requires_snuba]


class SlackTasksTest(TestCase):
    def setUp(self) -> None:
        self.integration = install_slack(self.organization)

    @pytest.fixture(autouse=True)
    def mock_chat_scheduleMessage(self):
        with mock_slack_response(
            "chat_scheduleMessage",
            body={"ok": True, "channel": "chan-id", "scheduled_message_id": "Q1298393284"},
        ) as self.mock_schedule:
            yield

    @pytest.fixture(autouse=True)
    def mock_chat_deleteScheduledMessage(self):
        with mock_slack_response(
            "chat_deleteScheduledMessage", body={"ok": True}
        ) as self.mock_delete:
            yield

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @responses.activate
    def test_post_message_success(self, mock_api_call: MagicMock, mock_metrics: MagicMock) -> None:
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        with self.tasks():
            post_message.apply_async(
                kwargs={
                    "integration_id": self.integration.id,
                    "payload": {"blocks": ["hello"], "text": "text", "channel": "channel"},
                    "log_error_message": "my_message",
                    "log_params": {"log_key": "log_value"},
                }
            )

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": True, "status": 200},
        )

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @responses.activate
    def test_post_message_failure_sdk(self, mock_metrics: MagicMock) -> None:
        with self.tasks():
            post_message.apply_async(
                kwargs={
                    "integration_id": self.integration.id,
                    "payload": {
                        "blocks": ["hello"],
                        "text": "text",
                        "channel": "channel",
                        "callback_id": "123",
                    },
                    "log_error_message": "my_message",
                    "log_params": {"log_key": "log_value"},
                }
            )

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": False, "status": 200},
        )

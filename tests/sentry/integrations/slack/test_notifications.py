from unittest.mock import patch

import orjson
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse

from sentry.integrations.slack.metrics import (
    SLACK_NOTIFY_RECIPIENT_FAILURE_DATADOG_METRIC,
    SLACK_NOTIFY_RECIPIENT_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.notifications import send_notification_as_slack
from sentry.integrations.types import ExternalProviders
from sentry.notifications.additional_attachment_manager import manager
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import DummyNotification


def additional_attachment_generator_block_kit(integration, organization):
    return [
        {"type": "section", "text": {"type": "mrkdwn", "text": organization.slug}},
        {"type": "section", "text": {"type": "mrkdwn", "text": integration.id}},
    ]


class SlackNotificationsTest(SlackActivityNotificationTest):
    def setUp(self):
        super().setUp()
        self.notification = DummyNotification(self.organization)

    @patch("sentry.integrations.slack.service.metrics")
    def test_additional_attachment(self, mock_metrics):
        with (
            patch.dict(
                manager.attachment_generators,
                {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
            ),
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

            blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
            text = self.mock_post.call_args.kwargs["text"]

            assert text == "Notification Title"

            assert len(blocks) == 5

            assert blocks[0]["text"]["text"] == "Notification Title"
            assert blocks[1]["text"]["text"] == "*My Title*  \n"
            # Message actions
            assert blocks[2] == {
                "elements": [
                    {
                        "text": {"text": "Go to Zombo.com", "type": "plain_text"},
                        "type": "button",
                        "url": "http://zombo.com",
                        "value": "link_clicked",
                    },
                    {
                        "text": {"text": "Go to Sentry", "type": "plain_text"},
                        "type": "button",
                        "url": "http://sentry.io",
                        "value": "link_clicked",
                    },
                ],
                "type": "actions",
            }
            assert blocks[3]["text"]["text"] == self.organization.slug
            assert blocks[4]["text"]["text"] == self.integration.id

        mock_metrics.incr.assert_called_with(
            SLACK_NOTIFY_RECIPIENT_SUCCESS_DATADOG_METRIC,
            sample_rate=1.0,
        )

    @patch("sentry.integrations.slack.service.metrics")
    def test_no_additional_attachment(self, mock_metrics):
        with self.tasks():
            send_notification_as_slack(self.notification, [self.user], {}, {})

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        text = self.mock_post.call_args.kwargs["text"]

        assert text == "Notification Title"
        assert len(blocks) == 3

        assert blocks[0]["text"]["text"] == "Notification Title"
        assert blocks[1]["text"]["text"] == "*My Title*  \n"
        # Message actions
        assert blocks[2] == {
            "elements": [
                {
                    "text": {"text": "Go to Zombo.com", "type": "plain_text"},
                    "type": "button",
                    "url": "http://zombo.com",
                    "value": "link_clicked",
                },
                {
                    "text": {"text": "Go to Sentry", "type": "plain_text"},
                    "type": "button",
                    "url": "http://sentry.io",
                    "value": "link_clicked",
                },
            ],
            "type": "actions",
        }

    @patch("sentry.integrations.slack.service.metrics")
    def test_send_notification_as_slack(self, mock_metrics):
        with patch.dict(
            manager.attachment_generators,
            {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

        mock_metrics.incr.assert_called_with(
            SLACK_NOTIFY_RECIPIENT_SUCCESS_DATADOG_METRIC,
            sample_rate=1.0,
        )

    @patch("sentry.integrations.slack.service.metrics")
    def test_send_notification_as_slack_error(self, mock_metrics):
        mock_slack_response = SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": False},
            headers={},
            status_code=200,
        )

        with (
            patch.dict(
                manager.attachment_generators,
                {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
            ),
            patch(
                "slack_sdk.web.client.WebClient.chat_postMessage",
                side_effect=SlackApiError("error", mock_slack_response),
            ),
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

        mock_metrics.incr.assert_called_with(
            SLACK_NOTIFY_RECIPIENT_FAILURE_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": False, "status": 200},
        )

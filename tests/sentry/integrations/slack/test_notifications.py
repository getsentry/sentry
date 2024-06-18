from unittest import mock
from urllib.parse import parse_qs

import orjson
import responses

from sentry.integrations.slack.notifications import send_notification_as_slack
from sentry.integrations.slack.sdk_client import SLACK_DATADOG_METRIC
from sentry.integrations.types import ExternalProviders
from sentry.notifications.additional_attachment_manager import manager
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.features import with_feature
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

    @responses.activate
    def test_additional_attachment_block_kit(self):
        with (
            mock.patch.dict(
                manager.attachment_generators,
                {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
            ),
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

            data = parse_qs(responses.calls[0].request.body)

            assert "blocks" in data
            assert "text" in data
            assert data["text"][0] == "Notification Title"

            blocks = orjson.loads(data["blocks"][0])
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

    @responses.activate
    def test_no_additional_attachment_block_kit(self):
        with self.tasks():
            send_notification_as_slack(self.notification, [self.user], {}, {})

        data = parse_qs(responses.calls[0].request.body)

        assert "blocks" in data
        assert "text" in data
        assert data["text"][0] == "Notification Title"

        blocks = orjson.loads(data["blocks"][0])
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

    @mock.patch("sentry.integrations.slack.sdk_client.metrics")
    @mock.patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @with_feature("organizations:slack-sdk-notify-recipient")
    def test_send_notification_as_slack_sdk(self, mock_api_call, mock_metrics):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }
        with (
            mock.patch.dict(
                manager.attachment_generators,
                {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
            ),
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": True, "status": 200},
        )

    @mock.patch("sentry.integrations.slack.sdk_client.metrics")
    @with_feature("organizations:slack-sdk-notify-recipient")
    def test_send_notification_as_slack_sdk_error(self, mock_metrics):
        with (
            mock.patch.dict(
                manager.attachment_generators,
                {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
            ),
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": False, "status": 200},
        )

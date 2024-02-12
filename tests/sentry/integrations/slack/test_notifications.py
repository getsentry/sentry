from unittest import mock
from urllib.parse import parse_qs

import responses

from sentry.integrations.slack.notifications import _get_attachments, send_notification_as_slack
from sentry.notifications.additional_attachment_manager import manager
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import DummyNotification
from sentry.testutils.silo import region_silo_test
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


def additional_attachment_generator(integration, organization):
    # nonsense to make sure we pass in the right fields
    return {"title": organization.slug, "text": integration.id}


def additional_attachment_generator_block_kit(integration, organization):
    return [
        {"type": "section", "text": {"type": "mrkdwn", "text": organization.slug}},
        {"type": "section", "text": {"type": "mrkdwn", "text": integration.id}},
    ]


@region_silo_test
class SlackNotificationsTest(SlackActivityNotificationTest):
    def setUp(self):
        super().setUp()
        self.notification = DummyNotification(self.organization)

    @responses.activate
    def test_additional_attachment(self):
        with mock.patch.dict(
            manager.attachment_generators,
            {ExternalProviders.SLACK: additional_attachment_generator},
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

            data = parse_qs(responses.calls[0].request.body)

            assert "attachments" in data
            assert data["text"][0] == "Notification Title"

            attachments = json.loads(data["attachments"][0])
            assert len(attachments) == 2

            assert attachments[0]["title"] == "My Title"
            assert attachments[1]["title"] == self.organization.slug
            assert attachments[1]["text"] == self.integration.id

    @responses.activate
    def test_additional_attachment_block_kit(self):
        with self.feature("organizations:slack-block-kit"), mock.patch.dict(
            manager.attachment_generators,
            {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
        ):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

            data = parse_qs(responses.calls[0].request.body)

            assert "blocks" in data
            assert "text" in data
            assert data["text"][0] == "Notification Title"

            blocks = json.loads(data["blocks"][0])
            assert len(blocks) == 4

            assert blocks[0]["text"]["text"] == "Notification Title"
            assert blocks[1]["text"]["text"] == "*My Title*  \n"
            assert blocks[2]["text"]["text"] == self.organization.slug
            assert blocks[3]["text"]["text"] == self.integration.id

    @responses.activate
    def test_no_additional_attachment(self):
        with self.tasks():
            send_notification_as_slack(self.notification, [self.user], {}, {})

        data = parse_qs(responses.calls[0].request.body)

        assert "attachments" in data
        assert data["text"][0] == "Notification Title"

        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1

        assert attachments[0]["title"] == "My Title"

    @responses.activate
    def test_no_additional_attachment_block_kit(self):
        with self.feature("organizations:slack-block-kit"):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

            data = parse_qs(responses.calls[0].request.body)

            assert "blocks" in data
            assert "text" in data
            assert data["text"][0] == "Notification Title"

            blocks = json.loads(data["blocks"][0])
            assert len(blocks) == 2

            assert blocks[0]["text"]["text"] == "Notification Title"
            assert blocks[1]["text"]["text"] == "*My Title*  \n"

    @responses.activate
    @mock.patch("sentry.integrations.slack.notifications._get_attachments")
    def test_attachment_with_block_kit_flag(self, mock_attachment):
        """
        Tests that notifications built with the legacy system can still send successfully with
        the block kit flag enabled.
        """
        mock_attachment.return_value = _get_attachments(self.notification, self.user, {}, {})

        with self.feature("organizations:slack-block-kit"):
            with self.tasks():
                send_notification_as_slack(self.notification, [self.user], {}, {})

            data = parse_qs(responses.calls[0].request.body)

            assert "attachments" in data
            assert data["text"][0] == "Notification Title"

            attachments = json.loads(data["attachments"][0])
            assert len(attachments) == 1

            assert attachments[0]["title"] == "My Title"

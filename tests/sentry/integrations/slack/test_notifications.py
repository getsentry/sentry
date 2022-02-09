from urllib.parse import parse_qs

import responses

from sentry.integrations.slack.notifications import send_notification_as_slack
from sentry.notifications.additional_attachment_manager import manager
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import DummyNotification
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


def additional_attachment_generator(integration, organization):
    # nonsense to make sure we pass in the right fields
    return {"title": organization.slug, "text": integration.id}


class SlackNotificationsTest(SlackActivityNotificationTest):
    def tearDown(self):
        manager.attachment_generators[ExternalProviders.SLACK] = None

    def setUp(self):
        super().setUp()
        self.notification = DummyNotification(self.organization)

    @responses.activate
    def test_additional_attachment(self):
        manager.attachment_generators[ExternalProviders.SLACK] = additional_attachment_generator
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
    def test_no_additional_attachment(self):
        with self.tasks():
            send_notification_as_slack(self.notification, [self.user], {}, {})

        data = parse_qs(responses.calls[0].request.body)

        assert "attachments" in data
        assert data["text"][0] == "Notification Title"

        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1

        assert attachments[0]["title"] == "My Title"

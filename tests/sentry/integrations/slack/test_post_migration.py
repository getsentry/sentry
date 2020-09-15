from __future__ import absolute_import

import responses


from sentry.utils import json
from sentry.utils.compat.mock import patch
from sentry.models import Integration
from sentry.testutils.cases import TestCase

from sentry.integrations.slack.post_migration import run_post_migration


class SlackPostMigrationTest(TestCase):
    def setUp(self):
        self.org = self.create_organization(name="foo", owner=self.user)
        self.project1 = self.create_project(organization=self.org)
        self.integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={"old_access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        self.integration.add_organization(self.org, self.user)
        self.data = {
            "integration_id": self.integration.id,
            "organization_id": self.org.id,
            "user_id": self.user.id,
        }

    @responses.activate
    @patch("sentry.utils.email.MessageBuilder")
    def test_basic(self, builder):
        def request_callback(request):
            payload = json.loads(request.body)
            if payload["channel"] == "good_channel_id":
                return (200, {}, json.dumps({"ok": True}))
            else:
                return (200, {}, json.dumps({"ok": False}))

        responses.add_callback(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            callback=request_callback,
            content_type="application/json",
        )

        self.data["private_channels"] = [
            {"name": "#good_channel", "id": "good_channel_id"},
            {"name": "#bad_channel", "id": "bad_channel_id"},
        ]

        self.data["missing_channels"] = [
            {"name": "#missing_channel", "id": "missing_channel_id"},
        ]

        with self.tasks():
            run_post_migration(**self.data)

        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

        expected_email_args = {
            "subject": u"Your Slack Sentry Integration has been upgraded",
            "type": "slack_migration.summary",
            "template": "sentry/emails/slack-migration.txt",
            "html_template": "sentry/emails/slack-migration.html",
            "context": {
                "good_channels": [{"name": "#good_channel", "id": "good_channel_id"}],
                "failing_channels": [{"name": "#bad_channel", "id": "bad_channel_id"}],
                "missing_channels": [{"name": "#missing_channel", "id": "missing_channel_id"}],
                "doc_link": "https://docs.sentry.io/product/integrations/slack/#upgrading-slack",
                "integration": self.integration,
                "organization": self.org,
            },
        }
        builder.assert_called_with(**expected_email_args)
        integration = Integration.objects.get(id=self.integration.id)
        assert "old_access_token" not in integration.metadata

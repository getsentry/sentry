from unittest import mock
from unittest.mock import patch
from urllib.parse import parse_qs

import responses
from django.core import mail

import sentry
from sentry.digests.backends.base import Backend
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.models import ProjectOwnership, Rule
from sentry.tasks.digests import deliver_digest
from sentry.testutils import TestCase
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.slack import send_notification
from sentry.utils import json

USER_COUNT = 2


class DigestNotificationTest(TestCase):
    def add_event(self, fingerprint: str, backend: Backend) -> None:
        event = self.store_event(
            data={"timestamp": iso_format(before_now(days=1)), "fingerprint": [fingerprint]},
            project_id=self.project.id,
        )
        backend.add(
            self.key, event_to_record(event, [self.rule]), increment_delay=0, maximum_delay=0
        )

    @patch.object(sentry, "digests")
    def run_test(self, digests, event_count: int):
        backend = RedisBackend()
        digests.digest = backend.digest

        for i in range(event_count):
            self.add_event(f"group-{i}", backend)

        with self.tasks():
            deliver_digest(self.key)

        assert len(mail.outbox) == USER_COUNT

    def setUp(self):
        super().setUp()
        self.rule = Rule.objects.create(project=self.project, label="Test Rule", data={})
        self.key = f"mail:p:{self.project.id}"
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        for i in range(USER_COUNT - 1):
            self.create_member(
                organization=self.organization,
                user=self.create_user(),
                role="member",
                teams=[self.team],
            )

    def test_sends_digest_to_every_member(self):
        event_count = 2
        self.run_test(event_count=event_count)
        assert f"{event_count} new alerts since" in mail.outbox[0].subject

    def test_sends_alert_rule_notification_to_each_member(self):
        self.run_test(event_count=1)

        # It is an alert rule notification, not a digest
        assert "new alerts since" not in mail.outbox[0].subject


class DigestSlackNotification(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    @mock.patch.object(sentry, "digests")
    def test_slack_digest_notification(self, digests, mock_func):
        """
        Test that with digests enabled, but Slack notification settings
        (and not email settings), we send a Slack notification
        """
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        backend = RedisBackend()
        digests.digest = backend.digest
        digests.enabled.return_value = True
        timestamp_raw = before_now(days=1)
        timestamp_secs = int(timestamp_raw.timestamp())
        timestamp = iso_format(timestamp_raw)
        key = f"slack:p:{self.project.id}"
        rule = Rule.objects.create(project=self.project, label="my rule")
        event = self.store_event(
            data={
                "timestamp": timestamp,
                "message": "Hello world",
                "level": "error",
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={
                "timestamp": timestamp,
                "message": "Goodbye world",
                "level": "error",
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        backend.add(key, event_to_record(event, [rule]), increment_delay=0, maximum_delay=0)
        backend.add(key, event_to_record(event2, [rule]), increment_delay=0, maximum_delay=0)
        with self.tasks():
            deliver_digest(key)

        assert len(responses.calls) >= 1
        data = parse_qs(responses.calls[0].request.body)
        assert "text" in data
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])
        assert (
            data["text"][0]
            == f"<!date^{timestamp_secs}^2 issues detected {{date_pretty}} in| Digest Report for> <http://testserver/organizations/{self.organization.slug}/projects/{self.project.slug}/|{self.project.name}>"
        )
        assert len(attachments) == 2

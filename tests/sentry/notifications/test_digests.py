from unittest.mock import patch

from django.core import mail

import sentry
from sentry.digests.backends.base import Backend
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.models.rule import Rule
from sentry.tasks.digests import deliver_digest
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format

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

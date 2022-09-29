from unittest.mock import patch

from django.core import mail

import sentry
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.models import ProjectOwnership, Rule
from sentry.tasks.digests import deliver_digest
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class DeliverDigestTest(TestCase):
    @patch.object(sentry, "digests")
    def run_test(self, key: str, digests):
        """Simple integration test to make sure that digests are firing as expected."""
        backend = RedisBackend()
        digests.digest = backend.digest

        rule = Rule.objects.create(project=self.project, label="Test Rule", data={})
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        event = self.store_event(
            data={"timestamp": iso_format(before_now(days=1)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={"timestamp": iso_format(before_now(days=1)), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        backend.add(key, event_to_record(event, [rule]), increment_delay=0, maximum_delay=0)
        backend.add(key, event_to_record(event_2, [rule]), increment_delay=0, maximum_delay=0)
        with self.tasks():
            deliver_digest(key)
        assert "2 new alerts since" in mail.outbox[0].subject

    def test_old_key(self):
        self.run_test(f"mail:p:{self.project.id}")

    def test_new_key(self):
        self.run_test(f"mail:p:{self.project.id}:IssueOwners:")

    def test_member_key(self):
        self.run_test(f"mail:p:{self.project.id}:Member:{self.user.id}")

    def test_no_records(self):
        # This shouldn't error if no records are present
        deliver_digest(f"mail:p:{self.project.id}:IssueOwners:")

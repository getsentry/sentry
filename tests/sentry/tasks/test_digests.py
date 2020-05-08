from __future__ import absolute_import

from mock import patch

from django.core import mail

import sentry
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.models.rule import Rule
from sentry.tasks.digests import deliver_digest
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class DeliverDigestTest(TestCase):
    def run_test(self, key, digests):
        """
        Simple integration test to make sure that digests are firing as expected.
        """
        backend = RedisBackend()
        rule = Rule.objects.create(project=self.project, label="Test Rule", data={})
        event = self.store_event(
            data={"timestamp": iso_format(before_now(days=1)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={"timestamp": iso_format(before_now(days=1)), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        key = "mail:p:{}".format(self.project.id)
        backend.add(key, event_to_record(event, [rule]), increment_delay=0, maximum_delay=0)
        backend.add(key, event_to_record(event_2, [rule]), increment_delay=0, maximum_delay=0)
        digests.digest = backend.digest
        with self.tasks():
            deliver_digest(key)
        assert "2 new alerts since" in mail.outbox[0].subject

    @patch.object(sentry, "digests")
    def test_old_key(self, digests):
        self.run_test("mail:p:{}".format(self.project.id), digests)

    @patch.object(sentry, "digests")
    def test_new_key(self, digests):
        self.run_test("mail:p:{}:IssueOwners:".format(self.project.id), digests)

    @patch.object(sentry, "digests")
    def test_member_key(self, digests):
        self.run_test("mail:p:{}:Member:{}".format(self.project.id, self.user.id), digests)

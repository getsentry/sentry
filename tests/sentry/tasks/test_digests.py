import uuid
from contextlib import contextmanager
from unittest import mock

import pytest
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives

import sentry
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.models.projectownership import ProjectOwnership
from sentry.tasks.digests import deliver_digest
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils.locking import UnableToAcquireLock

pytestmark = [requires_snuba]


class DeliverDigestTest(TestCase):
    def run_test(self, key: str) -> None:
        """Simple integration test to make sure that digests are firing as expected."""
        with mock.patch.object(sentry, "digests") as digests:
            backend = RedisBackend()
            digests.backend.digest = backend.digest

            rule = self.create_project_rule(project=self.project)
            ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
            event = self.store_event(
                data={"timestamp": before_now(days=1).isoformat(), "fingerprint": ["group-1"]},
                project_id=self.project.id,
            )
            event_2 = self.store_event(
                data={"timestamp": before_now(days=1).isoformat(), "fingerprint": ["group-2"]},
                project_id=self.project.id,
            )
            notification_uuid = str(uuid.uuid4())
            backend.add(
                key,
                event_to_record(event, [rule], notification_uuid),
                increment_delay=0,
                maximum_delay=0,
            )
            backend.add(
                key,
                event_to_record(event_2, [rule], notification_uuid),
                increment_delay=0,
                maximum_delay=0,
            )
            with self.tasks():
                deliver_digest(key)

    def test_old_key(self) -> None:
        self.run_test(f"mail:p:{self.project.id}")
        assert len(mail.outbox) == 0

    def test_new_key(self) -> None:
        self.run_test(f"mail:p:{self.project.id}:IssueOwners:")
        assert len(mail.outbox) == 0

    def test_fallthrough_choice_key(self) -> None:
        self.run_test(f"mail:p:{self.project.id}:IssueOwners::AllMembers")
        assert "2 new alerts since" in mail.outbox[0].subject
        message = mail.outbox[0]
        assert isinstance(message, EmailMultiAlternatives)
        assert isinstance(message.alternatives[0][0], str)
        assert "notification_uuid" in message.alternatives[0][0]

    def test_member_key(self) -> None:
        self.run_test(f"mail:p:{self.project.id}:Member:{self.user.id}")
        assert "2 new alerts since" in mail.outbox[0].subject
        message = mail.outbox[0]
        assert isinstance(message, EmailMultiAlternatives)
        assert isinstance(message.alternatives[0][0], str)
        assert "notification_uuid" in message.alternatives[0][0]

    def test_no_records(self) -> None:
        # This shouldn't error if no records are present
        deliver_digest(f"mail:p:{self.project.id}:IssueOwners:")

    def test_unable_to_acquire_lock_propagates(self) -> None:
        @contextmanager
        def raise_lock_error(*args, **kwargs):
            raise UnableToAcquireLock("test lock contention")
            yield  # type: ignore[unreachable]

        with mock.patch.object(sentry, "digests") as digests:
            digests.backend.digest = raise_lock_error
            key = f"mail:p:{self.project.id}:IssueOwners::AllMembers"
            with pytest.raises(UnableToAcquireLock):
                deliver_digest(key)

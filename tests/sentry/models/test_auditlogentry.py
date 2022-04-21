from django.utils import timezone

from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import TestCase


class AuditLogEntryTest(TestCase):
    def test_plan_changed(self):
        entry = AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.PLAN_CHANGED,
            actor=self.user,
            datetime=timezone.now(),
            data={"plan_name": "Team"},
        )

        assert entry.get_note() == "changed plan to Team"

    def test_plan_changed_with_quotas(self):
        entry = AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.PLAN_CHANGED,
            actor=self.user,
            datetime=timezone.now(),
            data={
                "plan_name": "Team",
                "quotas": "50K errors, 100K transactions, and 1 GB of attachments",
            },
        )

        assert (
            entry.get_note()
            == "changed plan to Team with 50K errors, 100K transactions, and 1 GB of attachments"
        )

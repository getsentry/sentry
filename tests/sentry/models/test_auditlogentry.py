from django.utils import timezone

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuditLogEntryTest(TestCase):
    def test_audit_log_entry(self):
        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("TEAM_ADD"),
            actor=self.user,
            datetime=timezone.now(),
            data={"slug": "New Team"},
        )
        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("TEAM_REMOVE"),
            actor=self.user,
            datetime=timezone.now(),
            data={"slug": "Old Team"},
        )
        assert AuditLogEntry.objects.filter(event=audit_log.get_event_id("TEAM_ADD")).exists()
        assert AuditLogEntry.objects.filter(event=audit_log.get_event_id("TEAM_REMOVE")).exists()

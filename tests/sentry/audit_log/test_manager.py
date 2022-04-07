from django.utils import timezone

from sentry.audit_log import AuditLogEvent, audit_log_manager
from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import TestCase


class AuditLogEventManagerTest(TestCase):
    def test_audit_log_manager(self):
        log_event = AuditLogEvent(
            event_id=1,
            name="member_invite",
            api_name="member.invite",
            render=lambda audit_log_entry: "invited member {email}".format(**audit_log_entry.data),
        )

        log_entry = AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.MEMBER_INVITE,
            actor=self.user,
            datetime=timezone.now(),
            data={"email": "my_email@mail.com"},
        )

        audit_log_manager.add(log_event)

        assert audit_log_manager.get(event_id=1) == log_event
        assert audit_log_manager.get_event_id(name="member_invite") == 1
        assert audit_log_manager.get_api_names() == ["member.invite"]

        assert log_event.render(log_entry) == "invited member my_email@mail.com"

from django.utils import timezone

from sentry.audit_log import AuditLogEvent, AuditLogEventManager
from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import TestCase


class AuditLogEventManagerTest(TestCase):
    def test_audit_log_manager(self):
        test_manager = AuditLogEventManager()

        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="test_log_entry",
                api_name="test-log.entry",
                render=lambda audit_log_event: "test member {email} is {role}".format(
                    **audit_log_event.data
                ),
            )
        )

        log_event = test_manager.get(event_id=500)

        log_entry = AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.MEMBER_INVITE,
            actor=self.user,
            datetime=timezone.now(),
            data={"email": "my_email@mail.com", "role": "admin"},
        )

        assert test_manager.get_event_id(name="test_log_entry") == 500
        assert "test-log.entry" in test_manager.get_api_names()

        assert log_event.render(log_entry) == "test member my_email@mail.com is admin"

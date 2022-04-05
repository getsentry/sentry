from unittest import mock

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
            template="invited member {email}",
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
        assert audit_log_manager.get_note(log_entry) == "invited member my_email@mail.com"

    @mock.patch("sentry.audit_log.manager.sentry_sdk")
    def test_for_duplicate_events(self, mock_sentry_sdk):
        log_event = AuditLogEvent(
            event_id=1,
            name="member_invite",
            api_name="member.invite",
            template="invited member {email}",
        )
        log_event_duplicate_id = AuditLogEvent(
            event_id=1,
            name="member_add",
            api_name="member.add",
            template="invited member {email}",
        )
        audit_log_manager.add(log_event)
        audit_log_manager.add(log_event_duplicate_id)

        assert mock_sentry_sdk.capture_message.called

from unittest import mock

from django.utils import timezone

from sentry.audit_log import AuditLogEvent, AuditLogEventManager, AuditLogEventNotRegistered
from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import TestCase


class AuditLogEventManagerTest(TestCase):
    def test_audit_log_manager(self):
        test_manager = AuditLogEventManager()

        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="TEST_LOG_ENTRY",
                api_name="test-log.entry",
                template="test member {email} is {role}",
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

        assert test_manager.get_event_id(name="TEST_LOG_ENTRY") == 500
        assert "test-log.entry" in test_manager.get_api_names()

        assert log_event.render(log_entry) == "test member my_email@mail.com is admin"

    @mock.patch("sentry.audit_log.manager.capture_exception")
    def test_duplicate_event_id(self, mock_capture_exception):
        test_manager = AuditLogEventManager()

        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="TEST_LOG_ENTRY",
                api_name="test-log.entry",
                template="test member {email} is {role}",
            )
        )
        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="TEST_DUPLICATE",
                api_name="test.duplicate",
                template="test duplicate",
            )
        )
        assert mock_capture_exception.called
        assert test_manager.get_event_id(name="TEST_LOG_ENTRY") == 500

        with self.assertRaises(AuditLogEventNotRegistered):
            test_manager.get_event_id(name="TEST_DUPLICATE")

    @mock.patch("sentry.audit_log.manager.capture_exception")
    def test_duplicate_event(self, mock_capture_exception):
        test_manager = AuditLogEventManager()

        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="TEST_LOG_ENTRY",
                api_name="test-log.entry",
                template="test member {email} is {role}",
            )
        )
        test_manager.add(
            AuditLogEvent(
                event_id=501,
                name="TEST_LOG_ENTRY",
                api_name="test.duplicate",
                template="test duplicate",
            )
        )
        assert mock_capture_exception.called
        assert test_manager.get_event_id(name="TEST_LOG_ENTRY") == 500
        assert "test.duplicate" not in test_manager.get_api_names()

        with self.assertRaises(AuditLogEventNotRegistered):
            test_manager.get(501)

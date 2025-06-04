import pytest
from django.utils import timezone

from sentry import audit_log
from sentry.audit_log import (
    AuditLogEvent,
    AuditLogEventManager,
    AuditLogEventNotRegistered,
    DuplicateAuditLogEvent,
)
from sentry.models.auditlogentry import AuditLogEntry
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
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
            organization_id=self.organization.id,
            event=audit_log.get_event_id("MEMBER_INVITE"),
            actor=self.user,
            datetime=timezone.now(),
            data={"email": "my_email@mail.com", "role": "admin"},
        )

        assert test_manager.get_event_id(name="TEST_LOG_ENTRY") == 500
        assert "test-log.entry" in test_manager.get_api_names()
        assert test_manager.get_event_id_from_api_name("test-log.entry") == 500

        assert log_event.render(log_entry) == "test member my_email@mail.com is admin"

    def test_duplicate_event_id(self):
        test_manager = AuditLogEventManager()

        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="TEST_LOG_ENTRY",
                api_name="test-log.entry",
                template="test member {email} is {role}",
            )
        )
        with pytest.raises(DuplicateAuditLogEvent):
            test_manager.add(
                AuditLogEvent(
                    event_id=500,
                    name="TEST_DUPLICATE",
                    api_name="test.duplicate",
                    template="test duplicate",
                )
            )
        assert test_manager.get_event_id(name="TEST_LOG_ENTRY") == 500

        with pytest.raises(AuditLogEventNotRegistered):
            test_manager.get_event_id(name="TEST_DUPLICATE")

    def test_duplicate_event_name(self):
        test_manager = AuditLogEventManager()

        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="TEST_LOG_ENTRY",
                api_name="test-log.entry",
                template="test member {email} is {role}",
            )
        )
        with pytest.raises(DuplicateAuditLogEvent):
            test_manager.add(
                AuditLogEvent(
                    event_id=501,
                    name="TEST_LOG_ENTRY",
                    api_name="test.duplicate",
                    template="test duplicate",
                )
            )
        assert test_manager.get_event_id(name="TEST_LOG_ENTRY") == 500
        assert "test.duplicate" not in test_manager.get_api_names()

        with pytest.raises(AuditLogEventNotRegistered):
            test_manager.get(501)

    def test_duplicate_api_name(self):
        test_manager = AuditLogEventManager()

        test_manager.add(
            AuditLogEvent(
                event_id=500,
                name="TEST_LOG_ENTRY",
                api_name="test-log.entry",
                template="test member {email} is {role}",
            )
        )
        with pytest.raises(DuplicateAuditLogEvent):
            test_manager.add(
                AuditLogEvent(
                    event_id=501,
                    name="TEST_DUPLICATE",
                    api_name="test-log.entry",
                    template="test duplicate",
                )
            )
        assert test_manager.get_event_id_from_api_name(api_name="test-log.entry") == 500

        with pytest.raises(AuditLogEventNotRegistered):
            test_manager.get(501)

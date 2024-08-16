from unittest import mock

from sentry import audit_log
from sentry.audit_log import AuditLogEvent
from sentry.testutils.cases import TestCase


class AuditLogEventRegisterTest(TestCase):
    def test_get_api_names(self):
        self._event_registry: dict[str, AuditLogEvent] = {}
        self._event_id_lookup: dict[int, AuditLogEvent] = {}
        self._api_name_lookup: dict[str, AuditLogEvent] = {}

        with (
            mock.patch("sentry.audit_log.default_manager._event_registry", new={}),
            mock.patch("sentry.audit_log.default_manager._event_id_lookup", new={}),
            mock.patch("sentry.audit_log.default_manager._api_name_lookup", new={}),
        ):
            events = [
                AuditLogEvent(
                    event_id=10000,
                    name="UPTIME_MONITOR_ADD",
                    api_name="uptime_monitor.add",
                    template="added uptime monitor {name}",
                ),
                AuditLogEvent(
                    event_id=20000,
                    name="UPTIME_MONITOR_EDIT",
                    api_name="uptime_monitor.edit",
                    template="edited uptime monitor {name}",
                ),
                AuditLogEvent(
                    event_id=30000,
                    name="UPTIME_MONITOR_REMOVE",
                    api_name="uptime_monitor.remove",
                    template="removed uptime monitor {name}",
                ),
            ]
            for event in events:
                audit_log.add(event)

            assert set(audit_log.get_api_names()) == {e.api_name for e in events}

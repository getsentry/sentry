from dataclasses import dataclass
from typing import Callable, List

import sentry_sdk

from sentry.models.auditlogentry import AuditLogEntry


@dataclass
class AuditLogEvent:
    event_id: int
    name: str
    api_name: str
    # render holds a function that will determine the message to be displayed in the audit log
    render: Callable[[AuditLogEntry], str]


class AuditLogEventManager:
    _event_registry = {}
    _event_id_lookup = {}

    def add(self, audit_log_event: AuditLogEvent):
        if (
            audit_log_event.name in self._event_registry
            or audit_log_event.event_id in self._event_id_lookup
        ):
            # TODO(mbauer404): raise exception once getsentry specific audit logs
            # have been permanently moved from sentry into getsentry
            with sentry_sdk.push_scope() as scope:
                scope.level = "warning"
                sentry_sdk.capture_message(
                    f"Duplicate audit log: {audit_log_event.name} with ID {audit_log_event.event_id}"
                )
            return

        self._event_registry[audit_log_event.name] = audit_log_event
        self._event_id_lookup[audit_log_event.event_id] = audit_log_event

    def get(self, event_id: int) -> "AuditLogEvent":
        if event_id not in self._event_id_lookup:
            raise Exception("Event ID does not exist")
        return self._event_id_lookup[event_id]

    def get_event_id(self, name: str) -> int:
        if name not in self._event_registry:
            raise Exception("Event does not exist")
        return self._event_registry[name].event_id

    def get_api_names(self) -> List[str]:
        # returns a list of all the api names
        api_names: list = []
        for audit_log_event in self._event_registry.values():
            api_names.append(audit_log_event.api_name)
        return api_names


audit_log_manager = AuditLogEventManager()

from dataclasses import dataclass
from typing import Callable, List

from sentry_sdk import capture_exception

from sentry.models.auditlogentry import AuditLogEntry


class DuplicateAuditLogEvent(Exception):
    pass


class AuditLogEventNotRegistered(Exception):
    pass


@dataclass
class AuditLogEvent:
    event_id: int
    name: str
    api_name: str
    # render holds a function that will determine the message to be displayed in the audit log
    render: Callable[[AuditLogEntry], str]


class AuditLogEventManager:
    def __init__(self) -> None:
        self._event_registry = {}
        self._event_id_lookup = {}

    def add(self, audit_log_event: AuditLogEvent):
        if (
            audit_log_event.name in self._event_registry
            or audit_log_event.event_id in self._event_id_lookup
        ):
            capture_exception(
                DuplicateAuditLogEvent(
                    f"Duplicate audit log: {audit_log_event.name} with ID {audit_log_event.event_id}"
                )
            )
            return

        self._event_registry[audit_log_event.name] = audit_log_event
        self._event_id_lookup[audit_log_event.event_id] = audit_log_event

    def get(self, event_id: int) -> "AuditLogEvent":
        if event_id not in self._event_id_lookup:
            raise AuditLogEventNotRegistered(f"Event ID {event_id} does not exist")
        return self._event_id_lookup[event_id]

    def get_event_id(self, name: str) -> int:
        if name not in self._event_registry:
            raise AuditLogEventNotRegistered(f"Event {name} does not exist")
        return self._event_registry[name].event_id

    def get_api_names(self) -> List[str]:
        # returns a list of all the api names
        api_names: list = []
        for audit_log_event in self._event_registry.values():
            api_names.append(audit_log_event.api_name)
        return api_names


audit_log_manager = AuditLogEventManager()

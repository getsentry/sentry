from dataclasses import dataclass
from typing import Callable, List, Optional

import sentry_sdk

from sentry.models.auditlogentry import AuditLogEntry


@dataclass
class AuditLogEvent:
    event_id: int
    name: str
    api_name: str

    # Use `template` OR `get_template` for each AuditLogEvent.

    # For audit log events using one string format to display the log's message,
    # use `temaplate`.
    # Add any new variables to `template_variables` in `AuditLogEventManager.get_note`.
    template: Optional[str] = None

    # For audit log events that need a function to determine the log's message,
    # use `get_template` to store that function.
    get_template: Optional[Callable[["AuditLogEntry"], str]] = None


class AuditLogEventManager:
    _event_registry = {}
    _event_id_lookup = {}

    def add(self, audit_log_event: "AuditLogEvent"):
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
        if not audit_log_event.template and not audit_log_event.get_template:
            raise Exception("AuditLogEvent must include either a `template` or `get_template`")

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

    def get_note(self, audit_log_entry: "AuditLogEntry") -> str:
        # Takes an AuditLogEntry and returns the formatted log message to be displayed in the audit log.
        audit_log_event = self.get(audit_log_entry.event)

        if audit_log_event.get_template:
            return audit_log_event.get_template(audit_log_entry)

        if audit_log_event.template:
            actor = audit_log_entry.actor if audit_log_entry.actor else None
            target_user = audit_log_entry.target_user if audit_log_entry.target_user else None
            target_user_display_name = target_user.get_display_name() if target_user else None

            template_variables = {
                **audit_log_entry.data,
                "actor": actor,
                "target_user": target_user,
                "target_user_display_name": target_user_display_name,
            }
            return audit_log_event.template.format(**template_variables)
        return ""


audit_log_manager = AuditLogEventManager()

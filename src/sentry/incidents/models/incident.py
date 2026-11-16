from enum import Enum


class IncidentType(Enum):
    ALERT_TRIGGERED = 2


class IncidentStatus(Enum):
    OPEN = 1
    CLOSED = 2
    WARNING = 10
    CRITICAL = 20


class IncidentStatusMethod(Enum):
    MANUAL = 1  # not in use
    RULE_UPDATED = 2  # always corresponds with IncidentStatus.CLOSED
    RULE_TRIGGERED = 3


INCIDENT_STATUS = {
    IncidentStatus.OPEN: "Open",
    IncidentStatus.CLOSED: "Resolved",
    IncidentStatus.CRITICAL: "Critical",
    IncidentStatus.WARNING: "Warning",
}


class IncidentActivityType(Enum):
    """Numeric activity types retained for legacy-compatible response payloads."""

    CREATED = 1
    STATUS_CHANGE = 2
    DETECTED = 4


class TriggerStatus(Enum):
    ACTIVE = 0
    RESOLVED = 1

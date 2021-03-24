from enum import Enum


class IncidentType(Enum):
    DETECTED = 0
    ALERT_TRIGGERED = 2


class IncidentStatus(Enum):
    OPEN = 1
    CLOSED = 2
    WARNING = 10
    CRITICAL = 20


class IncidentStatusMethod(Enum):
    MANUAL = 1
    RULE_UPDATED = 2
    RULE_TRIGGERED = 3


INCIDENT_STATUS = {
    IncidentStatus.OPEN: "Open",
    IncidentStatus.CLOSED: "Resolved",
    IncidentStatus.CRITICAL: "Critical",
    IncidentStatus.WARNING: "Warning",
}


class AlertRuleActivityType(Enum):
    CREATED = 1
    DELETED = 2
    UPDATED = 3
    ENABLED = 4
    DISABLED = 5
    SNAPSHOT = 6


class TriggerStatus(Enum):
    ACTIVE = 0
    RESOLVED = 1


class AlertRuleStatus(Enum):
    PENDING = 0
    SNAPSHOT = 4
    DISABLED = 5


class AlertRuleThresholdType(Enum):
    ABOVE = 0
    BELOW = 1


class IncidentActivityType(Enum):
    CREATED = 1
    STATUS_CHANGE = 2
    COMMENT = 3
    DETECTED = 4

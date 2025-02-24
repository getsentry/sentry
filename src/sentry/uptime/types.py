from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum


class IncidentStatus(IntEnum):
    """
    Used to identify what the current status of a uptime monitor is.
    """

    NO_INCIDENT = 0
    IN_INCIDENT = 1


@dataclass(frozen=True)
class EapCheckEntry:
    """
    Represents a check entry response from the EAP API.
    """

    uptime_check_id: str
    uptime_subscription_id: int
    timestamp: datetime
    scheduled_check_time: datetime
    check_status: str
    check_status_reason: str
    http_status_code: int | None
    duration_ms: int
    trace_id: str
    incident_status: IncidentStatus
    environment: str
    region: str

from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum

from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckStatus, CheckStatusReasonType


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
    check_status: CheckStatus
    check_status_reason: CheckStatusReasonType | None
    http_status_code: int | None
    duration_ms: int
    trace_id: str
    incident_status: IncidentStatus
    environment: str
    region: str

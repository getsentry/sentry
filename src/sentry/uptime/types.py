import enum
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum
from typing import Literal, Required, TypedDict

from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckStatus, CheckStatusReasonType

DATA_SOURCE_UPTIME_SUBSCRIPTION = "uptime_subscription"
"""
The workflow engine DataSource type used for registering handlers and fetching
the uptime sbuscription data source.
"""

GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE = "uptime_domain_failure"
"""
The GroupType slug for UptimeDomainCheckFailure GroupTypes.
"""

DEFAULT_RECOVERY_THRESHOLD = 1
"""
Default number of consecutive successful checks required to mark monitor as recovered.
"""

DEFAULT_DOWNTIME_THRESHOLD = 3
"""
Default number of consecutive failed checks required to mark monitor as down.
"""

RegionScheduleMode = Literal["round_robin"]
"""
Defines how we'll schedule checks based on other active regions.
"""

CheckInterval = Literal[60, 300, 600, 1200, 1800, 3600]
"""
The interval between each check run in seconds.
"""

RequestHeader = tuple[str, str]
"""
An individual header, consisting of a name and value as a tuple.
"""

RequestMethod = Literal["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"]
"""
The HTTP method to use for the request.
"""


class CheckConfig(TypedDict, total=False):
    """
    A message containing the configuration for a check to scheduled and
    executed by the uptime-checker.
    """

    subscription_id: Required[str]
    """
    UUID of the subscription that this check config represents.
    """

    interval_seconds: Required[CheckInterval]
    """
    The interval between each check run in seconds.
    """

    timeout_ms: Required[int | float]
    """
    The total time we will allow to make the request in milliseconds.
    """

    url: Required[str]
    """
    The actual HTTP URL to check.
    """

    request_method: RequestMethod
    """
    The HTTP method to use for the request.
    """

    request_headers: Sequence[RequestHeader]
    """
    Additional HTTP headers to send with the request.
    """

    request_body: str
    """
    Additional HTTP headers to send with the request.
    """

    trace_sampling: bool
    """
    Whether to allow for sampled trace spans for the request.
    """

    active_regions: Sequence[str]
    """
    A list of region slugs the uptime check is configured to run in.
    """

    region_schedule_mode: "RegionScheduleMode"
    """
    Defines how we'll schedule checks based on other active regions.
    """

    assertion: any
    """
    The runtime assertion to execute, or null.
    """


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


@dataclass(frozen=True)
class UptimeSummary:
    """
    Represents data used for uptime summary
    """

    total_checks: int
    failed_checks: int
    downtime_checks: int
    missed_window_checks: int
    avg_duration_us: float


class UptimeMonitorMode(enum.IntEnum):
    # Manually created by a user
    MANUAL = 1
    # Auto-detected by our system and in the onboarding stage
    AUTO_DETECTED_ONBOARDING = 2
    # Auto-detected by our system and actively monitoring
    AUTO_DETECTED_ACTIVE = 3

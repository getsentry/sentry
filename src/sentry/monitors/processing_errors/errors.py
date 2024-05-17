from __future__ import annotations

import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Literal, TypedDict, Union

from sentry.monitors.models import Monitor
from sentry.monitors.types import CheckinItem, CheckinItemData


class ProcessingErrorType(IntEnum):
    """
    Enum used as a discriminate tag for each type of processing error
    """

    CHECKIN_ENVIRONMENT_MISMATCH = 0
    CHECKIN_FINISHED = 1
    CHECKIN_GUID_PROJECT_MISMATCH = 2
    CHECKIN_INVALID_DURATION = 3
    CHECKIN_INVALID_GUID = 4
    CHECKIN_VALIDATION_FAILED = 5
    MONITOR_DISABLED = 6
    MONITOR_DISABLED_NO_QUOTA = 7
    MONITOR_INVALID_CONFIG = 8
    MONITOR_INVALID_ENVIRONMENT = 9
    MONITOR_LIMIT_EXCEEDED = 10
    MONITOR_NOT_FOUND = 11
    MONITOR_OVER_QUOTA = 12
    MONITOR_ENVIRONMENT_LIMIT_EXCEEDED = 13
    MONITOR_ENVIRONMENT_RATELIMITED = 14
    ORGANIZATION_KILLSWITCH_ENABLED = 15


class CheckinEnvironmentMismatch(TypedDict):
    """
    The environment sent with the checkin update doesn't match the environment
    already associated with the checkin
    """

    type: Literal[ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH]

    existingEnvironment: str
    """
    Name of the environment that is already associated with the check-in
    """


class CheckinFinished(TypedDict):
    """
    The checkin was already completed and we attempted to modify it
    """

    type: Literal[ProcessingErrorType.CHECKIN_FINISHED]


class CheckinGuidProjectMismatch(TypedDict):
    """
    The guid for the checkin matched a checkin that was related to a different
    project than the one provided in the DSN
    """

    type: Literal[ProcessingErrorType.CHECKIN_GUID_PROJECT_MISMATCH]

    guid: str
    """
    The guid which is assoicated to a different project
    """


class CheckinInvalidDuration(TypedDict):
    """
    We dropped a checkin due to invalid duration
    """

    type: Literal[ProcessingErrorType.CHECKIN_INVALID_DURATION]

    duration: str
    """
    The user provided duration
    """


class CheckinInvalidGuid(TypedDict):
    """
    GUID passed with checkin is invalid
    """

    type: Literal[ProcessingErrorType.CHECKIN_INVALID_GUID]


class CheckinValidationFailed(TypedDict):
    """
    Checkin format was invalid
    """

    type: Literal[ProcessingErrorType.CHECKIN_VALIDATION_FAILED]

    errors: Mapping[str, Sequence[str]]
    """
    Mapping of check-in field name to the problems with that field
    """


class MonitorDisabled(TypedDict):
    """
    Monitor was disabled for a non-billing related reason
    """

    type: Literal[ProcessingErrorType.MONITOR_DISABLED]


class MonitorDisabledNoQuota(TypedDict):
    """
    Monitor was disabled and we couldn't assign a seat
    """

    type: Literal[ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA]


class MonitorInvalidConfig(TypedDict):
    """
    A monitor wasn't found, and we failed to upsert due to invalid config
    """

    type: Literal[ProcessingErrorType.MONITOR_INVALID_CONFIG]

    errors: Mapping[str, Sequence[str]]
    """
    Mapping of monitor config field name to the problems with that field
    """


class MonitorInvalidEnvironment(TypedDict):
    """
    The environment information passed with the checkin was invalid
    """

    type: Literal[ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT]
    reason: str


class MonitorLimitExceeded(TypedDict):
    """
    The maximum number of monitors allowed per project has been exceeded
    """

    type: Literal[ProcessingErrorType.MONITOR_LIMIT_EXCEEDED]
    reason: str


class MonitorNotFound(TypedDict):
    """
    Monitor with the provided slug doesn't exist, and either no or invalid
    upsert data provided
    """

    type: Literal[ProcessingErrorType.MONITOR_NOT_FOUND]


class MonitorOverQuota(TypedDict):
    """
    This monitor can't accept checkins and is over quota
    """

    type: Literal[ProcessingErrorType.MONITOR_OVER_QUOTA]


class MonitorEnvironmentLimitExceeded(TypedDict):
    """
    The monitor has too many environments associated with it already, can't add
    another
    """

    type: Literal[ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED]
    reason: str


class MonitorEnviromentRateLimited(TypedDict):
    """
    This monitor environment is sending checkins too frequently
    """

    type: Literal[ProcessingErrorType.MONITOR_ENVIRONMENT_RATELIMITED]


class OrganizationKillswitchEnabled(TypedDict):
    """
    We have disabled checkin ingestion for this org. Contact support for details
    """

    type: Literal[ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED]


ProcessingError = Union[
    CheckinEnvironmentMismatch,
    CheckinFinished,
    CheckinGuidProjectMismatch,
    CheckinInvalidDuration,
    CheckinInvalidGuid,
    CheckinValidationFailed,
    MonitorDisabled,
    MonitorDisabledNoQuota,
    MonitorInvalidConfig,
    MonitorInvalidEnvironment,
    MonitorLimitExceeded,
    MonitorNotFound,
    MonitorOverQuota,
    MonitorEnvironmentLimitExceeded,
    MonitorEnviromentRateLimited,
    OrganizationKillswitchEnabled,
]


class ProcessingErrorsException(Exception):
    """
    This exception should be raised wtih a list of ProcessingError representing
    the problems which occured while processing a monitor check-in.
    """

    def __init__(
        self,
        processing_errors: Sequence[ProcessingError],
        monitor: Monitor | None = None,
    ):
        self.processing_errors = processing_errors

        # Monitor is optional, since we don't always have the monitor related
        # to the checkin available
        self.monitor = monitor


class CheckinProcessingErrorData(TypedDict):
    id: str
    checkin: CheckinItemData
    errors: Sequence[ProcessingError]


@dataclass(frozen=True)
class CheckinProcessingError:
    errors: Sequence[ProcessingError]
    checkin: CheckinItem
    id: uuid.UUID = field(default_factory=uuid.uuid4)

    def to_dict(self) -> CheckinProcessingErrorData:
        return {
            "id": self.id.hex,
            "checkin": self.checkin.to_dict(),
            "errors": self.errors,
        }

    @classmethod
    def from_dict(cls, data: CheckinProcessingErrorData) -> CheckinProcessingError:
        return cls(
            id=uuid.UUID(data["id"]),
            checkin=CheckinItem.from_dict(data["checkin"]),
            errors=data["errors"],
        )

    def __hash__(self):
        return hash(self.id.hex)

    def __eq__(self, other):
        if isinstance(other, CheckinProcessingError):
            return self.id.hex == other.id.hex
        return False

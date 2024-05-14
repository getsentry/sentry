from __future__ import annotations

import dataclasses
import logging
import uuid
from enum import Enum
from typing import Any, TypedDict

from sentry.monitors.models import Monitor
from sentry.monitors.types import CheckinItem, CheckinItemData

logger = logging.getLogger(__name__)


class ProcessingErrorType(Enum):
    CHECKIN_ENVIRONMENT_MISMATCH = 0
    """The environment sent with the checkin update doesn't match the environment already associated with the checkin"""
    CHECKIN_FINISHED = 1
    """The checkin was already completed and we attempted to modify it"""
    CHECKIN_GUID_PROJECT_MISMATCH = 2
    """The guid for the checkin matched a checkin that was related to a different project than the one provided in the DSN"""
    CHECKIN_INVALID_DURATION = 3
    """We dropped a checkin due to invalid duration"""
    CHECKIN_INVALID_GUID = 4
    """GUID passed with checkin is invalid"""
    CHECKIN_VALIDATION_FAILED = 5
    """Checkin format was invalid"""
    MONITOR_DISABLED = 6
    """Monitor was disabled for a non-billing related reason"""
    MONITOR_DISABLED_NO_QUOTA = 7
    """Monitor was disabled and we couldn't assign a seat"""
    MONITOR_INVALID_CONFIG = 8
    """A monitor wasn't found, and we failed to upsert due to invalid config"""
    MONITOR_INVALID_ENVIRONMENT = 9
    """The environment information passed with the checkin was invalid"""
    MONITOR_LIMIT_EXCEEDED = 10
    """The maximum number of monitors allowed per project has been exceeded"""
    MONITOR_NOT_FOUND = 11
    """Monitor with the provided slug doesn't exist, and either no or invalid upsert data provided"""
    MONITOR_OVER_QUOTA = 12
    """This monitor can't accept checkins and is over quota"""
    MONITOR_ENVIRONMENT_LIMIT_EXCEEDED = 13
    """The monitor has too many environments associated with it already, can't add another"""
    MONITOR_ENVIRONMENT_RATELIMITED = 14
    """This monitor environment is sending checkins too frequently"""
    ORGANIZATION_KILLSWITCH_ENABLED = 15
    """We have disabled checkin ingestion for this org. Contact support for details"""


class CheckinValidationError(Exception):
    def __init__(self, processing_errors: list[ProcessingError], monitor: Monitor | None = None):
        # Monitor is optional, since we don't always have the monitor related to the checkin available
        self.processing_errors = processing_errors
        self.monitor = monitor


class ProcessingErrorData(TypedDict):
    type: str
    data: dict[str, Any]


@dataclasses.dataclass(frozen=True)
class ProcessingError:
    type: ProcessingErrorType
    data: dict[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> ProcessingErrorData:
        return {
            "type": self.type.name,
            "data": self.data,
        }

    @classmethod
    def from_dict(cls, processing_error_data: ProcessingErrorData) -> ProcessingError:
        return cls(
            ProcessingErrorType[processing_error_data["type"]],
            processing_error_data["data"],
        )


class CheckinProcessingErrorData(TypedDict):
    errors: list[ProcessingErrorData]
    checkin: CheckinItemData
    id: str


@dataclasses.dataclass(frozen=True)
class CheckinProcessingError:
    errors: list[ProcessingError]
    checkin: CheckinItem
    id: uuid.UUID = dataclasses.field(default_factory=uuid.uuid4)

    def to_dict(self) -> CheckinProcessingErrorData:
        return {
            "errors": [error.to_dict() for error in self.errors],
            "checkin": self.checkin.to_dict(),
            "id": self.id.hex,
        }

    @classmethod
    def from_dict(cls, data: CheckinProcessingErrorData) -> CheckinProcessingError:
        return cls(
            errors=[ProcessingError.from_dict(error) for error in data["errors"]],
            checkin=CheckinItem.from_dict(data["checkin"]),
            id=uuid.UUID(data["id"]),
        )

    def __hash__(self):
        return hash(self.id.hex)

    def __eq__(self, other):
        if isinstance(other, CheckinProcessingError):
            return self.id.hex == other.id.hex
        return False

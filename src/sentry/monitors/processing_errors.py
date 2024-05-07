from __future__ import annotations

import dataclasses
import logging
from datetime import timedelta
from enum import Enum
from typing import Any, TypedDict

from django.conf import settings

from sentry import features
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.models import Monitor
from sentry.monitors.types import CheckinItem, CheckinItemData
from sentry.utils import json, metrics, redis

logger = logging.getLogger(__name__)

MAX_ERRORS_PER_SET = 10
MONITOR_ERRORS_LIFETIME = timedelta(days=1)


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


@dataclasses.dataclass(frozen=True)
class CheckinProcessingError:
    errors: list[ProcessingError]
    checkin: CheckinItem

    def to_dict(self) -> CheckinProcessingErrorData:
        return {
            "errors": [error.to_dict() for error in self.errors],
            "checkin": self.checkin.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: CheckinProcessingErrorData) -> CheckinProcessingError:
        return cls(
            errors=[ProcessingError.from_dict(error) for error in data["errors"]],
            checkin=CheckinItem.from_dict(data["checkin"]),
        )


class CheckinProcessErrorsManager:
    def _get_cluster(self):
        return redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    def store(self, error: CheckinProcessingError, monitor: Monitor | None):
        if monitor is None:
            # Attempt to get the monitor from the checkin info if we failed to retrieve it during ingestion
            try:
                monitor = Monitor.objects.get(
                    project_id=error.checkin.message["project_id"],
                    slug=error.checkin.payload["monitor_slug"],
                )
            except Monitor.DoesNotExist:
                pass
        if monitor:
            error_identifier = f"monitor:{monitor.id}"
        else:
            error_identifier = f'project:{error.checkin.message["project_id"]}'

        error_key = f"monitors.processing_errors.{error_identifier}"
        serialized_error = json.dumps(error.to_dict())
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        pipeline = redis_client.pipeline(transaction=False)
        pipeline.zadd(error_key, {serialized_error: error.checkin.ts.timestamp()})
        # Cap the error list to the `MAX_ERRORS_PER_SET` most recent errors
        pipeline.zremrangebyrank(error_key, 0, -(MAX_ERRORS_PER_SET + 1))
        pipeline.expire(error_key, MONITOR_ERRORS_LIFETIME)
        pipeline.execute()

    def build_monitor_identifier(self, monitor: Monitor) -> str:
        return f"monitor:{monitor.id}"

    def get_for_monitor(self, monitor: Monitor) -> list[CheckinProcessingError]:
        return self._get_for_entity(self.build_monitor_identifier(monitor))

    def build_project_identifier(self, project: Project) -> str:
        return f"project:{project.id}"

    def get_for_project(self, project: Project) -> list[CheckinProcessingError]:
        return self._get_for_entity(self.build_project_identifier(project))

    def _get_for_entity(self, identifier: str) -> list[CheckinProcessingError]:
        redis = self._get_cluster()
        error_key = f"monitors.processing_errors.{identifier}"
        raw_errors = redis.zrange(error_key, 0, MAX_ERRORS_PER_SET, desc=True)
        return [CheckinProcessingError.from_dict(json.loads(raw_error)) for raw_error in raw_errors]


def handle_processing_errors(item: CheckinItem, error: CheckinValidationError):
    try:
        organization = Organization.objects.get(project__id=item.message["project_id"])
        if not features.has("organizations:crons-write-user-feedback", organization):
            return

        metrics.incr(
            "monitors.checkin.handle_processing_error",
            tags={
                "source": "consumer",
                "sdk_platform": item.message["sdk"],
            },
        )

        checkin_processing_error = CheckinProcessingError(error.processing_errors, item)
        manager = CheckinProcessErrorsManager()
        manager.store(checkin_processing_error, error.monitor)
    except Exception:
        logger.exception("Failed to log processing error")

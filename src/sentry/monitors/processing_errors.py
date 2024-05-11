from __future__ import annotations

import abc
import dataclasses
import logging
import uuid
from collections.abc import Mapping
from datetime import timedelta
from enum import Enum
from itertools import chain
from typing import Generic, TypedDict, TypeVar

from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry import features
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.models import Monitor
from sentry.monitors.types import CheckinItem, CheckinItemData
from sentry.utils import json, metrics, redis

logger = logging.getLogger(__name__)

MAX_ERRORS_PER_SET = 10
MONITOR_ERRORS_LIFETIME = timedelta(days=7)


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
    def __init__(
        self, processing_errors: list[ProcessingErrorBase], monitor: Monitor | None = None
    ):
        # Monitor is optional, since we don't always have the monitor related to the checkin available
        self.processing_errors = processing_errors
        self.monitor = monitor


T = TypeVar("T", bound=Mapping[str, object])


class ProcessingErrorData(TypedDict, Generic[T]):
    type: str
    data: T


class ProcessingErrorRegistry(Generic[T]):
    registry: dict[ProcessingErrorType, type[ProcessingErrorBase[T]]]

    def __init__(self):
        self.registry = {}

    def register(self, type: ProcessingErrorType, error_cls: type[ProcessingErrorBase[T]]):
        self.registry[type] = error_cls

    def get(self, type: ProcessingErrorType) -> type[ProcessingErrorBase[T]]:
        return self.registry[type]


processing_error_registry: ProcessingErrorRegistry = ProcessingErrorRegistry()


class ProcessingErrorBase(abc.ABC, Generic[T]):
    data: T
    type: ProcessingErrorType

    def __init__(self, data: T):
        self.data = data

    def to_dict(self) -> ProcessingErrorData[T]:
        return {
            "type": self.type.name,
            "data": self.data,
        }

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__()
        if hasattr(cls, "type"):
            processing_error_registry.register(cls.type, cls)

    @classmethod
    def from_dict(cls, processing_error_data: ProcessingErrorData[T]) -> ProcessingErrorBase[T]:
        error_cls = processing_error_registry.get(
            ProcessingErrorType[processing_error_data["type"]]
        )
        return error_cls(processing_error_data["data"])

    def __eq__(self, other):
        if isinstance(other, ProcessingErrorBase):
            return self.type == other.type and self.data == other.data
        return False


class ProcessingErrorNoData(ProcessingErrorBase[Mapping[str, object]]):
    def __init__(self, data=None):
        if data is None:
            data = {}
        self.data = data


class CheckinEnvironmentMismatchData(TypedDict):
    existing_environment: str


class CheckinEnvironmentMismatch(ProcessingErrorBase[CheckinEnvironmentMismatchData]):
    type = ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH


class CheckinFinished(ProcessingErrorNoData):
    type = ProcessingErrorType.CHECKIN_FINISHED


class CheckinGuidProjectMismatchData(TypedDict):
    guid: str


class CheckinGuidProjectMismatch(ProcessingErrorBase[CheckinGuidProjectMismatchData]):
    type = ProcessingErrorType.CHECKIN_GUID_PROJECT_MISMATCH


class CheckinInvalidDurationData(TypedDict):
    duration: str


class CheckinInvalidDuration(ProcessingErrorBase[CheckinInvalidDurationData]):
    type = ProcessingErrorType.CHECKIN_INVALID_DURATION


class CheckinInvalidGuid(ProcessingErrorNoData):
    type = ProcessingErrorType.CHECKIN_INVALID_GUID


class CheckinValidationFailedData(TypedDict):
    errors: list[str]


class CheckinValidationFailed(ProcessingErrorBase[CheckinValidationFailedData]):
    type = ProcessingErrorType.CHECKIN_VALIDATION_FAILED


class MonitorDisabled(ProcessingErrorNoData):
    type = ProcessingErrorType.MONITOR_DISABLED


class MonitorDisabledNoQuota(ProcessingErrorNoData):
    type = ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA


class MonitorInvalidConfigData(TypedDict):
    errors: list[dict[str, list[str]]]


class MonitorInvalidConfig(ProcessingErrorBase[MonitorInvalidConfigData]):
    type = ProcessingErrorType.MONITOR_INVALID_CONFIG


class MonitorInvalidEnvironmentData(TypedDict):
    reason: str


class MonitorInvalidEnvironment(ProcessingErrorBase[MonitorInvalidEnvironmentData]):
    type = ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT


class MonitorLimitExceededData(TypedDict):
    reason: str


class MonitorLimitExceeded(ProcessingErrorBase[MonitorLimitExceededData]):
    type = ProcessingErrorType.MONITOR_LIMIT_EXCEEDED


class MonitorNotFound(ProcessingErrorNoData):
    type = ProcessingErrorType.MONITOR_NOT_FOUND


class MonitorOverQuota(ProcessingErrorNoData):
    type = ProcessingErrorType.MONITOR_OVER_QUOTA


class MonitorEnvironmentLimitExceededData(TypedDict):
    reason: str


class MonitorEnvironmentLimitExceeded(ProcessingErrorBase[MonitorEnvironmentLimitExceededData]):
    type = ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED


class MonitorEnviromentRateLimited(ProcessingErrorNoData):
    type = ProcessingErrorType.MONITOR_ENVIRONMENT_RATELIMITED


class OrganizationKillswitchEnabled(ProcessingErrorNoData):
    type = ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED


class CheckinProcessingErrorData(TypedDict):
    errors: list[ProcessingErrorData]
    checkin: CheckinItemData
    id: str


@dataclasses.dataclass(frozen=True)
class CheckinProcessingError:
    errors: list[ProcessingErrorBase]
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
            errors=[ProcessingErrorBase.from_dict(error) for error in data["errors"]],
            checkin=CheckinItem.from_dict(data["checkin"]),
            id=uuid.UUID(data["id"]),
        )

    def __hash__(self):
        return hash(self.id.hex)

    def __eq__(self, other):
        if isinstance(other, CheckinProcessingError):
            return self.id.hex == other.id.hex
        return False


class InvalidProjectError(Exception):
    pass


class CheckinProcessErrorsManager:
    def _get_cluster(self) -> RedisCluster[str] | StrictRedis[str]:
        return redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    def _get_entity_identifier_from_error(
        self, error: CheckinProcessingError, monitor: Monitor | None = None
    ) -> str:
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
            entity_identifier = self.build_monitor_identifier(monitor)
        else:
            entity_identifier = self.build_project_identifier(error.checkin.message["project_id"])

        return entity_identifier

    def store(self, error: CheckinProcessingError, monitor: Monitor | None):
        entity_identifier = self._get_entity_identifier_from_error(error, monitor)
        error_set_key = self.build_set_identifier(entity_identifier)
        error_key = self.build_error_identifier(error.id)
        serialized_error = json.dumps(error.to_dict())
        redis_client = self._get_cluster()
        pipeline = redis_client.pipeline(transaction=False)
        pipeline.zadd(error_set_key, {error.id.hex: error.checkin.ts.timestamp()})
        pipeline.set(error_key, serialized_error, ex=MONITOR_ERRORS_LIFETIME)
        # Cap the error list to the `MAX_ERRORS_PER_SET` most recent errors
        pipeline.zremrangebyrank(error_set_key, 0, -(MAX_ERRORS_PER_SET + 1))
        pipeline.expire(error_set_key, MONITOR_ERRORS_LIFETIME)
        pipeline.execute()

    def build_set_identifier(self, entity_identifier: str) -> str:
        return f"monitors.processing_errors_set.{entity_identifier}"

    def build_error_identifier(self, uuid: uuid.UUID) -> str:
        return f"monitors.processing_errors.{uuid.hex}"

    def build_monitor_identifier(self, monitor: Monitor) -> str:
        return f"monitor:{monitor.id}"

    def get_for_monitor(self, monitor: Monitor) -> list[CheckinProcessingError]:
        return self._get_for_entities([self.build_monitor_identifier(monitor)])

    def build_project_identifier(self, project_id: int) -> str:
        return f"project:{project_id}"

    def get_for_projects(self, projects: list[Project]) -> list[CheckinProcessingError]:
        return self._get_for_entities(
            [self.build_project_identifier(project.id) for project in projects]
        )

    def delete(self, project: Project, uuid: uuid.UUID):
        error_identifier = self.build_error_identifier(uuid)
        redis = self._get_cluster()
        raw_error = redis.get(error_identifier)
        if raw_error is None:
            return
        error = CheckinProcessingError.from_dict(json.loads(raw_error))
        if error.checkin.message["project_id"] != project.id:
            # TODO: Better exception class
            raise InvalidProjectError()

        entity_identifier = self._get_entity_identifier_from_error(error)
        self._delete_for_entity(entity_identifier, uuid)

    def _get_for_entities(self, entity_identifiers: list[str]) -> list[CheckinProcessingError]:
        redis = self._get_cluster()
        pipeline = redis.pipeline()
        for identifier in entity_identifiers:
            pipeline.zrange(self.build_set_identifier(identifier), 0, MAX_ERRORS_PER_SET, desc=True)
        error_identifiers = [
            self.build_error_identifier(uuid.UUID(error_identifier))
            for error_identifier in chain(*pipeline.execute())
        ]
        errors = [
            CheckinProcessingError.from_dict(json.loads(raw_error))
            for raw_error in redis.mget(error_identifiers)
            if raw_error is not None
        ]
        errors.sort(key=lambda error: error.checkin.ts.timestamp(), reverse=True)
        return errors

    def _delete_for_entity(self, entity_identifier: str, uuid: uuid.UUID) -> None:
        pipeline = self._get_cluster().pipeline()
        pipeline.zrem(self.build_set_identifier(entity_identifier), uuid.hex)
        pipeline.delete(self.build_error_identifier(uuid))
        pipeline.execute()


def handle_processing_errors(item: CheckinItem, error: CheckinValidationError):
    try:
        project = Project.objects.get_from_cache(id=item.message["project_id"])
        organization = Organization.objects.get_from_cache(id=project.organization_id)
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

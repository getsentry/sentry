from __future__ import annotations

import logging
import random
import uuid
from datetime import timedelta
from itertools import chain

from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry import analytics
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.models import Monitor
from sentry.monitors.types import CheckinItem
from sentry.utils import json, metrics, redis

from .errors import CheckinProcessingError, ProcessingErrorsException, ProcessingErrorType

logger = logging.getLogger(__name__)

MAX_ERRORS_PER_SET = 10
MONITOR_ERRORS_LIFETIME = timedelta(days=7)

# Sample processing error analytics due to a high volume of processing errors stored
ANALYTICS_SAMPLING_RATE = 0.01


class InvalidProjectError(Exception):
    pass


def _get_cluster() -> RedisCluster | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)


def build_set_identifier(entity_identifier: str) -> str:
    return f"monitors.processing_errors_set.{entity_identifier}"


def build_error_identifier(uuid: uuid.UUID) -> str:
    return f"monitors.processing_errors.{uuid.hex}"


def build_monitor_identifier(monitor: Monitor) -> str:
    return f"monitor:{monitor.id}"


def build_project_identifier(project_id: int) -> str:
    return f"project:{project_id}"


def _get_entity_identifier_from_error(
    error: CheckinProcessingError,
    monitor: Monitor | None = None,
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
        entity_identifier = build_monitor_identifier(monitor)
    else:
        entity_identifier = build_project_identifier(error.checkin.message["project_id"])

    return entity_identifier


def _get_for_entities(entity_identifiers: list[str]) -> list[CheckinProcessingError]:
    redis = _get_cluster()
    pipeline = redis.pipeline()
    for identifier in entity_identifiers:
        pipeline.zrange(build_set_identifier(identifier), 0, MAX_ERRORS_PER_SET, desc=True)
    error_identifiers = [
        build_error_identifier(uuid.UUID(error_identifier))
        for error_identifier in chain(*pipeline.execute())
    ]
    errors = [
        CheckinProcessingError.from_dict(json.loads(raw_error))
        for raw_error in redis.mget(error_identifiers)
        if raw_error is not None
    ]
    errors.sort(key=lambda error: error.checkin.ts.timestamp(), reverse=True)
    return errors


def _delete_for_entity(entity_identifier: str, uuid: uuid.UUID) -> None:
    pipeline = _get_cluster().pipeline()
    pipeline.zrem(build_set_identifier(entity_identifier), uuid.hex)
    pipeline.delete(build_error_identifier(uuid))
    pipeline.execute()


def _delete_for_entity_by_type(entity_identifier: str, type: ProcessingErrorType) -> None:
    checkin_errors = _get_for_entities([entity_identifier])
    redis = _get_cluster()
    pipeline = redis.pipeline()
    for checkin_error in checkin_errors:
        errors = checkin_error.errors
        if not any(error["type"] == type for error in errors):
            continue

        # If the processing error only holds this one type of error, remove the whole error
        if len(errors) == 1:
            pipeline.zrem(build_set_identifier(entity_identifier), checkin_error.id.hex)
            pipeline.delete(build_error_identifier(checkin_error.id))
        # If the processing error has other errors, filter out the matching error and update the redis value
        else:
            filtered_errors = list(filter(lambda error: error["type"] != type, errors))
            new_checkin_error = CheckinProcessingError(filtered_errors, checkin_error.checkin)
            new_serialized_checkin_error = json.dumps(new_checkin_error.to_dict())
            error_key = build_error_identifier(checkin_error.id)
            pipeline.set(error_key, new_serialized_checkin_error, ex=MONITOR_ERRORS_LIFETIME)

    pipeline.execute()


def store_error(error: CheckinProcessingError, monitor: Monitor | None):
    entity_identifier = _get_entity_identifier_from_error(error, monitor)
    error_set_key = build_set_identifier(entity_identifier)
    error_key = build_error_identifier(error.id)
    serialized_error = json.dumps(error.to_dict())
    redis_client = _get_cluster()
    pipeline = redis_client.pipeline(transaction=False)
    pipeline.zadd(error_set_key, {error.id.hex: error.checkin.ts.timestamp()})
    pipeline.set(error_key, serialized_error, ex=MONITOR_ERRORS_LIFETIME)
    pipeline.expire(error_set_key, MONITOR_ERRORS_LIFETIME)
    pipeline.zrange(error_set_key, 0, -(MAX_ERRORS_PER_SET + 1))
    processing_errors_to_remove = pipeline.execute()[-1]
    # Cap the error list to the `MAX_ERRORS_PER_SET` most recent errors
    if processing_errors_to_remove:
        pipeline = redis_client.pipeline(transaction=False)
        # XXX: We need to make individual delete commands here since pipeline
        # doesn't support passing multiple identifiers to delete
        for result in processing_errors_to_remove:
            pipeline.delete(build_error_identifier(uuid.UUID(result)))
        pipeline.zrem(error_set_key, *processing_errors_to_remove)
        pipeline.execute()


def delete_error(project: Project, uuid: uuid.UUID):
    error_identifier = build_error_identifier(uuid)
    redis = _get_cluster()
    raw_error = redis.get(error_identifier)
    if raw_error is None:
        return
    error = CheckinProcessingError.from_dict(json.loads(raw_error))
    if error.checkin.message["project_id"] != project.id:
        # TODO: Better exception class
        raise InvalidProjectError()

    entity_identifier = _get_entity_identifier_from_error(error)
    _delete_for_entity(entity_identifier, uuid)


def delete_errors_for_monitor_by_type(monitor: Monitor, type: ProcessingErrorType):
    _delete_for_entity_by_type(build_monitor_identifier(monitor), type)


def delete_errors_for_project_by_type(project: Project, type: ProcessingErrorType):
    _delete_for_entity_by_type(build_project_identifier(project.id), type)


def get_errors_for_monitor(monitor: Monitor) -> list[CheckinProcessingError]:
    return _get_for_entities([build_monitor_identifier(monitor)])


def get_errors_for_projects(projects: list[Project]) -> list[CheckinProcessingError]:
    return _get_for_entities([build_project_identifier(project.id) for project in projects])


def handle_processing_errors(item: CheckinItem, error: ProcessingErrorsException):
    try:
        project = Project.objects.get_from_cache(id=item.message["project_id"])
        organization = Organization.objects.get_from_cache(id=project.organization_id)

        metrics.incr(
            "monitors.checkin.handle_processing_error",
            tags={
                "source": "consumer",
                "sdk_platform": item.message["sdk"],
            },
        )

        if random.random() < ANALYTICS_SAMPLING_RATE:
            analytics.record(
                "checkin_processing_error.stored",
                organization_id=organization.id,
                project_id=project.id,
                monitor_slug=item.payload["monitor_slug"],
                error_types=[process_error["type"] for process_error in error.processing_errors],
            )

        checkin_processing_error = CheckinProcessingError(error.processing_errors, item)
        store_error(checkin_processing_error, error.monitor)
    except Exception:
        logger.exception("Failed to log processing error")

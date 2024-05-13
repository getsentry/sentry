from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from itertools import chain

from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry import features
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.models import Monitor
from sentry.monitors.types import CheckinItem
from sentry.utils import json, metrics, redis

from .errors import CheckinProcessingError, CheckinValidationError

logger = logging.getLogger(__name__)

MAX_ERRORS_PER_SET = 10
MONITOR_ERRORS_LIFETIME = timedelta(days=7)


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


def store_error(error: CheckinProcessingError, monitor: Monitor | None):
    entity_identifier = _get_entity_identifier_from_error(error, monitor)
    error_set_key = build_set_identifier(entity_identifier)
    error_key = build_error_identifier(error.id)
    serialized_error = json.dumps(error.to_dict())
    redis_client = _get_cluster()
    pipeline = redis_client.pipeline(transaction=False)
    pipeline.zadd(error_set_key, {error.id.hex: error.checkin.ts.timestamp()})
    pipeline.set(error_key, serialized_error, ex=MONITOR_ERRORS_LIFETIME)
    # Cap the error list to the `MAX_ERRORS_PER_SET` most recent errors
    pipeline.zremrangebyrank(error_set_key, 0, -(MAX_ERRORS_PER_SET + 1))
    pipeline.expire(error_set_key, MONITOR_ERRORS_LIFETIME)
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


def get_errors_for_monitor(monitor: Monitor) -> list[CheckinProcessingError]:
    return _get_for_entities([build_monitor_identifier(monitor)])


def get_errors_for_projects(projects: list[Project]) -> list[CheckinProcessingError]:
    return _get_for_entities([build_project_identifier(project.id) for project in projects])


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
        store_error(checkin_processing_error, error.monitor)
    except Exception:
        logger.exception("Failed to log processing error")

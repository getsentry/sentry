from __future__ import annotations

import dataclasses
from collections.abc import Mapping
from datetime import datetime
from typing import Any

from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
    TimeseriesAnnotation,
)
from sentry.utils import metrics
from sentry.viewer_context import ActorId, ActorType


@dataclasses.dataclass(frozen=True)
class TimeseriesAnnotationData:
    """
    A timeseries annotation as data
    """

    organization_id: int
    annotation_type: AnnotationType
    description: str
    start_timestamp: datetime

    project_id: int | None = None
    environment_id: int | None = None
    end_timestamp: datetime | None = None
    interval_type: IntervalType = IntervalType.POINT
    scope: AnnotationScope = AnnotationScope.GLOBAL
    severity: Severity = Severity.LOW
    tags: Mapping[str, Any] | None = None

    created_by: ActorId | None = None
    created_by_label: str | None = None

    id: int | None = None
    date_added: datetime | None = None
    date_updated: datetime | None = None

    @classmethod
    def from_model(cls, annotation: TimeseriesAnnotation) -> TimeseriesAnnotationData:
        return cls(
            id=annotation.id,
            organization_id=annotation.organization_id,
            project_id=annotation.project_id,
            environment_id=annotation.environment_id,
            annotation_type=AnnotationType(annotation.annotation_type),
            description=annotation.description,
            start_timestamp=annotation.start_timestamp,
            end_timestamp=annotation.end_timestamp,
            interval_type=IntervalType(annotation.interval_type),
            scope=AnnotationScope(annotation.scope),
            severity=Severity(annotation.severity),
            tags=annotation.tags,
            created_by=_actor_from_model(annotation),
            created_by_label=annotation.created_by_label,
            date_added=annotation.date_added,
            date_updated=annotation.date_updated,
        )


def _actor_from_model(annotation: TimeseriesAnnotation) -> ActorId | None:
    if annotation.created_by_id is not None:
        return ActorId(ActorType.USER, annotation.created_by_id)
    if annotation.created_by_service_account_id is not None:
        return ActorId(ActorType.SERVICE_ACCOUNT, annotation.created_by_service_account_id)
    return None


def _actor_columns(actor: ActorId | None) -> tuple[int | None, int | None]:
    """Map an ``ActorId`` to the ``(created_by_id, created_by_service_account_id)`` columns."""
    if actor is None:
        return None, None
    if actor.type == ActorType.USER:
        return actor.id, None
    if actor.type == ActorType.SERVICE_ACCOUNT:
        return None, actor.id
    return None, None


def create_timeseries_annotation(data: TimeseriesAnnotationData) -> TimeseriesAnnotation:
    """Create a timeseries annotation."""
    created_by_id, created_by_service_account_id = _actor_columns(data.created_by)

    annotation = TimeseriesAnnotation.objects.create(
        organization_id=data.organization_id,
        project_id=data.project_id,
        environment_id=data.environment_id,
        start_timestamp=data.start_timestamp,
        end_timestamp=data.end_timestamp,
        interval_type=data.interval_type,
        annotation_type=data.annotation_type,
        scope=data.scope,
        severity=data.severity,
        description=data.description,
        tags=dict(data.tags) if data.tags is not None else None,
        created_by_id=created_by_id,
        created_by_service_account_id=created_by_service_account_id,
        created_by_label=data.created_by_label,
        updated_by_id=created_by_id,
        updated_by_service_account_id=created_by_service_account_id,
        updated_by_label=data.created_by_label,
    )
    metrics.incr(
        "timeseries_annotations.created",
        tags={
            "annotation_type": AnnotationType(annotation.annotation_type).name.lower(),
            "interval_type": IntervalType(annotation.interval_type).name.lower(),
            "severity": Severity(annotation.severity).name.lower(),
        },
    )
    return annotation
